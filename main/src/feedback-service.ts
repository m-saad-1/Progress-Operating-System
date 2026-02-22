/**
 * Feedback Service — Main Process
 *
 * Sends user feedback via Nodemailer (SMTP) from the Electron main process.
 * This bypasses EmailJS's "non-browser applications" restriction entirely.
 *
 * Supports:
 *  - SMTP transport (Gmail, Outlook, SendGrid SMTP, etc.)
 *  - Optional backend URL transport (for future SaaS)
 *  - File-based offline queue with automatic retry
 *  - Screenshot attachments and user metadata
 *
 * Configuration via environment variables (loaded from .env):
 *  FEEDBACK_SMTP_HOST, FEEDBACK_SMTP_PORT, FEEDBACK_SMTP_SECURE,
 *  FEEDBACK_SMTP_USER, FEEDBACK_SMTP_PASS,
 *  FEEDBACK_TO_EMAIL, FEEDBACK_FROM_EMAIL, FEEDBACK_FROM_NAME
 *  FEEDBACK_BACKEND_URL, FEEDBACK_BACKEND_API_KEY  (optional, for SaaS)
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { app } from 'electron';
import path from 'path';
import fs from 'fs-extra';
import { randomUUID } from 'crypto';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type FeedbackType =
  | 'bug-report'
  | 'suggestion'
  | 'feature-request'
  | 'general-feedback';

const FEEDBACK_TYPES: FeedbackType[] = [
  'bug-report',
  'suggestion',
  'feature-request',
  'general-feedback',
];

export interface FeedbackMetadata {
  appVersion: string;
  operatingSystem: string;
  submittedAtIso: string;
  currentPage: string;
}

export interface FeedbackPayload {
  feedbackType: FeedbackType;
  message: string;
  userEmail?: string;
  screenshotName?: string;
  screenshotDataUrl?: string;
  metadata: FeedbackMetadata;
}

export interface FeedbackResult {
  success: boolean;
  error?: string;
  cachedForRetry?: boolean;
  retried?: number;
  transport?: 'smtp' | 'backend';
}

interface FailedFeedbackItem {
  id: string;
  payload: FeedbackPayload;
  failedAtIso: string;
  retryCount: number;
  lastError: string;
}

// ─── Configuration ──────────────────────────────────────────────────────────────

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  toEmail: string;
  fromEmail: string;
  fromName: string;
}

interface BackendConfig {
  url: string;
  apiKey: string;
}

const getSmtpConfig = (): SmtpConfig | null => {
  const host = process.env.FEEDBACK_SMTP_HOST?.trim();
  const user = process.env.FEEDBACK_SMTP_USER?.trim();
  const pass = process.env.FEEDBACK_SMTP_PASS?.trim();

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port: parseInt(process.env.FEEDBACK_SMTP_PORT || '587', 10),
    secure: process.env.FEEDBACK_SMTP_SECURE === 'true',
    user,
    pass,
    toEmail: process.env.FEEDBACK_TO_EMAIL?.trim() || user,
    fromEmail: process.env.FEEDBACK_FROM_EMAIL?.trim() || user,
    fromName: process.env.FEEDBACK_FROM_NAME?.trim() || 'PersonalOS Feedback',
  };
};

const getBackendConfig = (): BackendConfig | null => {
  const url = process.env.FEEDBACK_BACKEND_URL?.trim();
  if (!url) return null;

  return {
    url,
    apiKey: process.env.FEEDBACK_BACKEND_API_KEY?.trim() || '',
  };
};

// ─── Retry Queue (file-based) ───────────────────────────────────────────────────

const FEEDBACK_RETRY_FILE = 'feedback-retry-queue.json';
const MAX_RETRY_ITEMS = 50;
const MAX_RETRY_COUNT = 10;

const getFeedbackRetryFilePath = () =>
  path.join(app.getPath('userData'), FEEDBACK_RETRY_FILE);

export const readFeedbackRetryQueue = async (): Promise<FailedFeedbackItem[]> => {
  try {
    const queuePath = getFeedbackRetryFilePath();
    if (!(await fs.pathExists(queuePath))) return [];

    const raw = await fs.readFile(queuePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item: any) => item?.id && item?.payload && item.retryCount < MAX_RETRY_COUNT,
    );
  } catch (error) {
    console.warn('[Feedback] Failed to read retry queue:', error);
    return [];
  }
};

export const writeFeedbackRetryQueue = async (items: FailedFeedbackItem[]): Promise<void> => {
  const queuePath = getFeedbackRetryFilePath();
  await fs.outputJson(queuePath, items.slice(-MAX_RETRY_ITEMS), { spaces: 2 });
};

const queueFailedFeedback = async (
  payload: FeedbackPayload,
  errorMessage: string,
): Promise<void> => {
  const queue = await readFeedbackRetryQueue();
  queue.push({
    id: randomUUID(),
    payload,
    failedAtIso: new Date().toISOString(),
    retryCount: 0,
    lastError: errorMessage,
  });
  await writeFeedbackRetryQueue(queue);
};

// ─── Payload normalization ──────────────────────────────────────────────────────

const toSafe = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : value == null ? fallback : String(value);

export const normalizeFeedbackPayload = (
  raw: Partial<FeedbackPayload> | null | undefined,
): FeedbackPayload => {
  const feedbackType = FEEDBACK_TYPES.includes(raw?.feedbackType as FeedbackType)
    ? (raw!.feedbackType as FeedbackType)
    : 'general-feedback';

  return {
    feedbackType,
    message: toSafe(raw?.message).trim(),
    userEmail: toSafe(raw?.userEmail).trim() || undefined,
    screenshotName: raw?.screenshotName
      ? toSafe(raw.screenshotName).slice(0, 255)
      : undefined,
    screenshotDataUrl: raw?.screenshotDataUrl
      ? toSafe(raw.screenshotDataUrl)
      : undefined,
    metadata: {
      appVersion: toSafe(raw?.metadata?.appVersion, app.getVersion()),
      operatingSystem: toSafe(raw?.metadata?.operatingSystem, process.platform),
      submittedAtIso: toSafe(
        raw?.metadata?.submittedAtIso,
        new Date().toISOString(),
      ),
      currentPage: toSafe(raw?.metadata?.currentPage, 'unknown').slice(0, 255),
    },
  };
};

// ─── Transport: SMTP via Nodemailer ─────────────────────────────────────────────

let smtpTransporter: Transporter | null = null;

const getOrCreateSmtpTransporter = (config: SmtpConfig): Transporter => {
  if (smtpTransporter) return smtpTransporter;

  smtpTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });

  return smtpTransporter;
};

const feedbackTypeLabel = (type: FeedbackType): string => {
  const labels: Record<FeedbackType, string> = {
    'bug-report': 'Bug Report',
    suggestion: 'Suggestion',
    'feature-request': 'Feature Request',
    'general-feedback': 'General Feedback',
  };
  return labels[type] || type;
};

const buildEmailHtml = (payload: FeedbackPayload): string => {
  const { metadata } = payload;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">PersonalOS Feedback</h1>
        <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">${feedbackTypeLabel(payload.feedbackType)}</p>
      </div>
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
        <h2 style="font-size: 16px; color: #374151; margin: 0 0 12px;">Message</h2>
        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 20px; white-space: pre-wrap; line-height: 1.6; color: #1f2937;">
${payload.message}
        </div>

        <h2 style="font-size: 16px; color: #374151; margin: 0 0 12px;">Details</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 8px 0; color: #6b7280; width: 140px;">User Email</td>
            <td style="padding: 8px 0; color: #1f2937;">${payload.userEmail || 'Not provided'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 8px 0; color: #6b7280;">App Version</td>
            <td style="padding: 8px 0; color: #1f2937;">${metadata.appVersion}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 8px 0; color: #6b7280;">Operating System</td>
            <td style="padding: 8px 0; color: #1f2937;">${metadata.operatingSystem}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 8px 0; color: #6b7280;">Submitted At</td>
            <td style="padding: 8px 0; color: #1f2937;">${metadata.submittedAtIso}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Current Page</td>
            <td style="padding: 8px 0; color: #1f2937;">${metadata.currentPage}</td>
          </tr>
        </table>

        ${payload.screenshotName ? `
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 13px; color: #6b7280; margin: 0;">📎 Screenshot attached: ${payload.screenshotName}</p>
        </div>
        ` : ''}
      </div>
      <p style="text-align: center; font-size: 11px; color: #9ca3af; margin-top: 16px;">
        Sent from PersonalOS Desktop App
      </p>
    </div>
  `;
};

const sendViaSmtp = async (payload: FeedbackPayload): Promise<void> => {
  const config = getSmtpConfig();
  if (!config) {
    throw new Error(
      'SMTP is not configured. Set FEEDBACK_SMTP_HOST, FEEDBACK_SMTP_USER, and FEEDBACK_SMTP_PASS in your .env file.',
    );
  }

  const transporter = getOrCreateSmtpTransporter(config);
  const typeLabel = feedbackTypeLabel(payload.feedbackType);

  // Build attachments from data URL
  const attachments: Array<{
    filename: string;
    content: string;
    encoding: string;
    contentType?: string;
  }> = [];

  if (payload.screenshotDataUrl && payload.screenshotName) {
    const match = payload.screenshotDataUrl.match(
      /^data:(image\/[a-zA-Z+]+);base64,(.+)$/,
    );
    if (match) {
      attachments.push({
        filename: payload.screenshotName,
        content: match[2],
        encoding: 'base64',
        contentType: match[1],
      });
    }
  }

  const subject = `[PersonalOS] ${typeLabel} — ${payload.metadata.submittedAtIso.slice(0, 10)}`;

  await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: config.toEmail,
    replyTo: payload.userEmail || undefined,
    subject,
    html: buildEmailHtml(payload),
    text: [
      `PersonalOS Feedback — ${typeLabel}`,
      '',
      `Message:`,
      payload.message,
      '',
      `User Email: ${payload.userEmail || 'Not provided'}`,
      `App Version: ${payload.metadata.appVersion}`,
      `OS: ${payload.metadata.operatingSystem}`,
      `Submitted: ${payload.metadata.submittedAtIso}`,
      `Page: ${payload.metadata.currentPage}`,
      payload.screenshotName ? `Screenshot: ${payload.screenshotName} (attached)` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    attachments,
  });
};

// ─── Transport: Backend URL (future SaaS) ───────────────────────────────────────

const sendViaBackend = async (payload: FeedbackPayload): Promise<void> => {
  const config = getBackendConfig();
  if (!config) {
    throw new Error('Backend URL not configured. Set FEEDBACK_BACKEND_URL in .env.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(config.url, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Backend returned ${response.status}: ${body}`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Backend request timed out after 20 seconds.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Send a feedback email. Tries backend URL first (if configured), then SMTP.
 * On failure, queues for later retry.
 */
export const submitFeedback = async (
  rawPayload: Partial<FeedbackPayload>,
): Promise<FeedbackResult> => {
  const payload = normalizeFeedbackPayload(rawPayload);

  if (!payload.message) {
    return { success: false, error: 'Message is required.' };
  }

  let transport: 'smtp' | 'backend' = 'smtp';

  try {
    // Prefer backend URL if configured (for SaaS mode)
    const backendConfig = getBackendConfig();
    if (backendConfig) {
      transport = 'backend';
      await sendViaBackend(payload);
    } else {
      transport = 'smtp';
      await sendViaSmtp(payload);
    }

    // Try to send any previously queued items
    const retryResult = await retryFailedFeedbackQueue();

    return {
      success: true,
      transport,
      retried: retryResult.sent,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Feedback] Send failed (${transport}):`, message);

    // Queue for retry
    await queueFailedFeedback(payload, message);

    return {
      success: false,
      error: message,
      cachedForRetry: true,
    };
  }
};

/**
 * Retry all items in the failed feedback queue.
 */
export const retryFailedFeedbackQueue = async (): Promise<{
  sent: number;
  remaining: number;
}> => {
  const queue = await readFeedbackRetryQueue();
  if (!queue.length) return { sent: 0, remaining: 0 };

  const remaining: FailedFeedbackItem[] = [];
  let sent = 0;

  for (const item of queue) {
    try {
      const backendConfig = getBackendConfig();
      if (backendConfig) {
        await sendViaBackend(item.payload);
      } else {
        await sendViaSmtp(item.payload);
      }
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      remaining.push({
        ...item,
        retryCount: item.retryCount + 1,
        lastError: message,
      });
    }
  }

  await writeFeedbackRetryQueue(remaining);
  return { sent, remaining: remaining.length };
};

/**
 * Get the number of items currently in the retry queue.
 */
export const getFeedbackQueueCount = async (): Promise<number> => {
  const queue = await readFeedbackRetryQueue();
  return queue.length;
};

/**
 * Verify that feedback configuration is valid.
 * Returns a diagnostic object.
 */
export const verifyFeedbackConfig = async (): Promise<{
  configured: boolean;
  transport: 'backend' | 'smtp' | 'none';
  details: string;
}> => {
  const backendConfig = getBackendConfig();
  if (backendConfig) {
    return {
      configured: true,
      transport: 'backend',
      details: `Backend URL: ${backendConfig.url}`,
    };
  }

  const smtpConfig = getSmtpConfig();
  if (smtpConfig) {
    try {
      const transporter = getOrCreateSmtpTransporter(smtpConfig);
      await transporter.verify();
      return {
        configured: true,
        transport: 'smtp',
        details: `SMTP: ${smtpConfig.host}:${smtpConfig.port} (verified)`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        configured: true,
        transport: 'smtp',
        details: `SMTP: ${smtpConfig.host}:${smtpConfig.port} (verification failed: ${message})`,
      };
    }
  }

  return {
    configured: false,
    transport: 'none',
    details: 'No feedback transport configured. Set FEEDBACK_SMTP_* or FEEDBACK_BACKEND_URL in .env.',
  };
};

/**
 * Initialize automatic retry (call once on app startup).
 */
export const initFeedbackAutoRetry = (): void => {
  // Retry queued items 5 seconds after startup
  setTimeout(() => {
    void retryFailedFeedbackQueue().then((result) => {
      if (result.sent > 0) {
        console.log(`[Feedback] Auto-retry sent ${result.sent} queued item(s)`);
      }
    });
  }, 5_000);

  // Retry every 5 minutes
  setInterval(() => {
    void retryFailedFeedbackQueue().catch(() => {});
  }, 5 * 60 * 1000);
};
