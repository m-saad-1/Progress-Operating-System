export type FeedbackType = 'bug-report' | 'suggestion' | 'feature-request' | 'general-feedback'

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

interface EmailJsConfig {
  serviceId: string
  templateId: string
  publicKey: string
  adminEmail: string
}

const FEEDBACK_RETRY_STORAGE_KEY = 'feedback-retry-queue'
const MAX_RETRY_ITEMS = 25

const getRendererEmailJsConfig = (): EmailJsConfig | null => {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID?.trim()
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID?.trim()
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY?.trim()
  const adminEmail = import.meta.env.VITE_EMAILJS_ADMIN_EMAIL?.trim() || 'mhsaad23305@gmail.com'

  if (!serviceId || !templateId || !publicKey) {
    return null
  }

  return {
    serviceId,
    templateId,
    publicKey,
    adminEmail,
  }
}

const readRetryQueue = (): FeedbackPayload[] => {
  try {
    const raw = localStorage.getItem(FEEDBACK_RETRY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => item && typeof item === 'object' && typeof item.message === 'string')
  } catch {
    return []
  }
}

const writeRetryQueue = (items: FeedbackPayload[]) => {
  try {
    localStorage.setItem(FEEDBACK_RETRY_STORAGE_KEY, JSON.stringify(items.slice(-MAX_RETRY_ITEMS)))
  } catch {
  }
}

export const queueFeedbackForRetry = (payload: FeedbackPayload) => {
  const queue = readRetryQueue()
  queue.push(payload)
  writeRetryQueue(queue)
}

export const getFeedbackRuntimeMetadata = async (currentPage: string): Promise<FeedbackMetadata> => {
  let appVersion = import.meta.env.VITE_APP_VERSION || 'unknown'

  if (window.electronAPI?.invoke) {
    try {
      const versionResult = await window.electronAPI.invoke('app:getVersion')
      if (typeof versionResult === 'string' && versionResult.trim()) {
        appVersion = versionResult.trim()
      }
    } catch {
    }
  }

  return {
    appVersion,
    operatingSystem: navigator.platform || 'unknown',
    submittedAtIso: new Date().toISOString(),
    currentPage,
  }
}

export const sendFeedbackWithEmailJs = async (payload: FeedbackPayload): Promise<{ status: number; body: string }> => {
  const config = getRendererEmailJsConfig()
  if (!config) {
    throw new Error('EmailJS is not configured in renderer env. Missing VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, or VITE_EMAILJS_PUBLIC_KEY.')
  }

  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), 15_000)

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: abortController.signal,
      body: JSON.stringify({
        service_id: config.serviceId,
        template_id: config.templateId,
        user_id: config.publicKey,
        template_params: {
          feedback_type: payload.feedbackType,
          message: payload.message,
          admin_email: config.adminEmail,
          user_email: payload.userEmail || 'Not provided',
          screenshot_name: payload.screenshotName || 'Not provided',
          screenshot_data_url: payload.screenshotDataUrl || '',
          app_version: payload.metadata.appVersion,
          operating_system: payload.metadata.operatingSystem,
          submitted_at: payload.metadata.submittedAtIso,
          current_page: payload.metadata.currentPage,
        },
      }),
    })

    const responseText = (await response.text()).trim()
    if (!response.ok) {
      throw new Error(`EmailJS send failed (${response.status}): ${responseText}`)
    }

    return {
      status: response.status,
      body: responseText || 'OK',
    }
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError'
    if (isAbort) {
      throw new Error('Feedback request timed out. Please check your connection and try again.')
    }

    const message = error instanceof Error ? error.message : String(error)
    throw new Error(message || 'Failed to send feedback')
  } finally {
    clearTimeout(timeout)
  }
}

export const retryQueuedRendererFeedback = async (): Promise<{ sent: number; remaining: number }> => {
  const queuedItems = readRetryQueue()
  if (!queuedItems.length) {
    return { sent: 0, remaining: 0 }
  }

  const remaining: FeedbackPayload[] = []
  let sent = 0

  for (const item of queuedItems) {
    try {
      await sendFeedbackWithEmailJs(item)
      sent += 1
    } catch {
      remaining.push(item)
    }
  }

  writeRetryQueue(remaining)
  return { sent, remaining: remaining.length }
}