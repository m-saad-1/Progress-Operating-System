/**
 * Feedback Service — Renderer Process
 *
 * Sends feedback via IPC to the main process, which handles email delivery
 * through Nodemailer (SMTP) or a backend URL. No API keys are exposed in
 * the renderer process.
 *
 * Falls back to localStorage-based queuing if IPC is unavailable (e.g. when
 * running in standalone Vite dev mode without Electron).
 */

export type FeedbackType =
  | 'bug-report'
  | 'suggestion'
  | 'feature-request'
  | 'general-feedback'

export interface FeedbackMetadata {
  appVersion: string
  operatingSystem: string
  submittedAtIso: string
  currentPage: string
}

export interface FeedbackPayload {
  feedbackType: FeedbackType
  message: string
  userEmail?: string
  screenshotName?: string
  screenshotDataUrl?: string
  metadata: FeedbackMetadata
}

export interface FeedbackResult {
  success: boolean
  error?: string
  cachedForRetry?: boolean
  retried?: number
  transport?: 'smtp' | 'backend'
}

// ─── Metadata helper ────────────────────────────────────────────────────────────

export const getFeedbackRuntimeMetadata = async (
  currentPage: string,
): Promise<FeedbackMetadata> => {
  let appVersion = 'unknown'

  if (window.electronAPI?.getVersion) {
    try {
      const v = await window.electronAPI.getVersion()
      if (typeof v === 'string' && v.trim()) {
        appVersion = v.trim()
      }
    } catch {
      // ignore
    }
  }

  return {
    appVersion,
    operatingSystem: navigator.platform || 'unknown',
    submittedAtIso: new Date().toISOString(),
    currentPage,
  }
}

// ─── Offline queue (localStorage fallback for non-Electron or IPC failure) ──────

const FEEDBACK_RETRY_STORAGE_KEY = 'feedback-retry-queue'
const MAX_RETRY_ITEMS = 25

const readLocalRetryQueue = (): FeedbackPayload[] => {
  try {
    const raw = localStorage.getItem(FEEDBACK_RETRY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item: any) => item && typeof item === 'object' && typeof item.message === 'string',
    )
  } catch {
    return []
  }
}

const writeLocalRetryQueue = (items: FeedbackPayload[]) => {
  try {
    localStorage.setItem(
      FEEDBACK_RETRY_STORAGE_KEY,
      JSON.stringify(items.slice(-MAX_RETRY_ITEMS)),
    )
  } catch {
    // ignore storage errors
  }
}

export const queueFeedbackForRetry = (payload: FeedbackPayload) => {
  const queue = readLocalRetryQueue()
  queue.push(payload)
  writeLocalRetryQueue(queue)
}

// ─── IPC-based submission ───────────────────────────────────────────────────────

const hasElectronIpc = (): boolean =>
  typeof window !== 'undefined' &&
  window.electronAPI != null &&
  typeof window.electronAPI.submitFeedback === 'function'

/**
 * Submit feedback through the main process (IPC → Nodemailer).
 * If IPC is unavailable, queues to localStorage.
 */
export const submitFeedback = async (
  payload: FeedbackPayload,
): Promise<FeedbackResult> => {
  if (!hasElectronIpc()) {
    // Fallback: queue locally (standalone dev mode or broken IPC)
    queueFeedbackForRetry(payload)
    return {
      success: false,
      error: 'Electron IPC unavailable. Feedback has been saved for retry.',
      cachedForRetry: true,
    }
  }

  try {
    const result = await window.electronAPI.submitFeedback(payload)
    return result as FeedbackResult
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    // Queue locally as fallback
    queueFeedbackForRetry(payload)

    return {
      success: false,
      error: message,
      cachedForRetry: true,
    }
  }
}

/**
 * Retry all locally queued feedback items through the main process.
 */
export const retryQueuedFeedback = async (): Promise<{
  sent: number
  remaining: number
}> => {
  // First, try to retry items queued in the main process
  if (hasElectronIpc()) {
    try {
      await window.electronAPI.retryFailedFeedback()
    } catch {
      // ignore main-process retry errors
    }
  }

  // Then retry any items queued locally in localStorage
  const localQueue = readLocalRetryQueue()
  if (!localQueue.length) {
    return { sent: 0, remaining: 0 }
  }

  if (!hasElectronIpc()) {
    return { sent: 0, remaining: localQueue.length }
  }

  const remaining: FeedbackPayload[] = []
  let sent = 0

  for (const item of localQueue) {
    try {
      const result = await window.electronAPI.submitFeedback(item)
      if (result?.success) {
        sent++
      } else {
        remaining.push(item)
      }
    } catch {
      remaining.push(item)
    }
  }

  writeLocalRetryQueue(remaining)
  return { sent, remaining: remaining.length }
}

/**
 * Get the count of feedback items queued for retry.
 */
export const getQueuedFeedbackCount = async (): Promise<number> => {
  let mainCount = 0
  if (hasElectronIpc()) {
    try {
      mainCount = (await window.electronAPI.getFeedbackQueueCount()) || 0
    } catch {
      // ignore
    }
  }

  const localCount = readLocalRetryQueue().length
  return mainCount + localCount
}
