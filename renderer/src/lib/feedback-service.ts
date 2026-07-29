/**
 * Feedback Service — Renderer Process
 *
 * Sends feedback via Tauri invoke to the backend, which handles email delivery.
 * Falls back to localStorage queuing if Tauri is unavailable (dev mode).
 */

import { invoke } from '@tauri-apps/api/core'

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

// ─── Metadata helper ─────────────────────────────────────────────────────────

export const getFeedbackRuntimeMetadata = async (
  currentPage: string,
): Promise<FeedbackMetadata> => {
  let appVersion = import.meta.env.VITE_APP_VERSION || 'unknown'

  try {
    const v = await invoke<string>('get_app_version')
    if (typeof v === 'string' && v.trim()) {
      appVersion = v.trim()
    }
  } catch {
    // not fatal — leave default
  }

  return {
    appVersion,
    operatingSystem: navigator.platform || 'unknown',
    submittedAtIso: new Date().toISOString(),
    currentPage,
  }
}

// ─── Offline queue (localStorage fallback) ───────────────────────────────────

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

// ─── Tauri-based submission ───────────────────────────────────────────────────

const isTauriAvailable = (): boolean =>
  typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__

/**
 * Submit feedback through Tauri (invoke → backend email delivery).
 * If Tauri is unavailable (standalone dev), queues to localStorage.
 */
export const submitFeedback = async (
  payload: FeedbackPayload,
): Promise<FeedbackResult> => {
  if (!isTauriAvailable()) {
    queueFeedbackForRetry(payload)
    return {
      success: false,
      error: 'Tauri not available. Feedback has been saved for retry.',
      cachedForRetry: true,
    }
  }

  try {
    const result = await invoke<FeedbackResult>('submit_feedback', { payload })
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    queueFeedbackForRetry(payload)
    return {
      success: false,
      error: message,
      cachedForRetry: true,
    }
  }
}

/**
 * Retry all locally queued feedback items.
 */
export const retryQueuedFeedback = async (): Promise<{
  sent: number
  remaining: number
}> => {
  const localQueue = readLocalRetryQueue()
  if (!localQueue.length) {
    return { sent: 0, remaining: 0 }
  }

  if (!isTauriAvailable()) {
    return { sent: 0, remaining: localQueue.length }
  }

  const remaining: FeedbackPayload[] = []
  let sent = 0

  for (const item of localQueue) {
    try {
      const result = await invoke<FeedbackResult>('submit_feedback', { payload: item })
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
 * Get count of feedback items queued for retry.
 */
export const getQueuedFeedbackCount = (): number => {
  return readLocalRetryQueue().length
}
