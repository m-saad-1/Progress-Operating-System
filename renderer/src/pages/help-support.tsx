import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, MessageSquare, Paperclip } from 'lucide-react'
import { useStore } from '@/store'
import { useToaster } from '@/hooks/use-toaster'
import { getFeedbackRuntimeMetadata, queueFeedbackForRetry, retryQueuedFeedback, submitFeedback } from '@/lib/feedback-service'

export default function HelpSupportPage() {
  const store = useStore()
  const { success, info, error } = useToaster()

  const [feedbackType, setFeedbackType] = useState<'bug-report' | 'suggestion' | 'feature-request' | 'general-feedback'>('general-feedback')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackEmail, setFeedbackEmail] = useState(store.userProfile?.email || '')
  const [feedbackEmailTouched, setFeedbackEmailTouched] = useState(false)
  const [feedbackScreenshotName, setFeedbackScreenshotName] = useState('')
  const [feedbackScreenshotDataUrl, setFeedbackScreenshotDataUrl] = useState('')
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)
  const [hasRetriedQueuedFeedback, setHasRetriedQueuedFeedback] = useState(false)
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine)
  const [feedbackSubmitStatus, setFeedbackSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (!feedbackEmailTouched) {
      setFeedbackEmail(store.userProfile?.email || '')
    }
  }, [store.userProfile, feedbackEmailTouched])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const handleFeedbackScreenshotChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      setFeedbackScreenshotName('')
      setFeedbackScreenshotDataUrl('')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      error('Screenshot must be 2MB or smaller')
      event.target.value = ''
      return
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('Failed to read screenshot file'))
        reader.readAsDataURL(file)
      })

      setFeedbackScreenshotName(file.name)
      setFeedbackScreenshotDataUrl(dataUrl)
    } catch {
      error('Failed to process screenshot file')
    }
  }

  const handleSubmitFeedback = async () => {
    setFeedbackSubmitStatus(null)

    if (!isOnline) {
      error('No internet connection. Please reconnect and try again.')
      setFeedbackSubmitStatus({ type: 'error', message: 'No internet connection. Please reconnect and try again.' })
      return
    }

    if (!feedbackMessage.trim()) {
      error('Message is required')
      setFeedbackSubmitStatus({ type: 'error', message: 'Message is required.' })
      return
    }

    if (feedbackEmail.trim() && !isValidEmail(feedbackEmail.trim())) {
      error('Please enter a valid email address')
      setFeedbackSubmitStatus({ type: 'error', message: 'Please enter a valid email address.' })
      return
    }

    setIsSubmittingFeedback(true)

    try {
      const metadata = await getFeedbackRuntimeMetadata(window.location.pathname)

      const result = await submitFeedback({
        feedbackType,
        message: feedbackMessage.trim(),
        userEmail: feedbackEmail.trim(),
        screenshotName: feedbackScreenshotName || undefined,
        screenshotDataUrl: feedbackScreenshotDataUrl || undefined,
        metadata,
      })

      if (result.success) {
        success('Feedback sent successfully. Thank you for helping us improve.')
        setFeedbackSubmitStatus({ type: 'success', message: 'Feedback sent successfully. Thank you for helping us improve.' })
        setFeedbackMessage('')
        setFeedbackScreenshotName('')
        setFeedbackScreenshotDataUrl('')
      } else if (result.cachedForRetry) {
        info('Feedback was saved and will retry automatically.')
        setFeedbackSubmitStatus({ type: 'error', message: `Feedback could not be sent right now. ${result.error || ''} It was saved for automatic retry.`.trim() })
      } else {
        error('Feedback could not be sent. Please try again.')
        setFeedbackSubmitStatus({ type: 'error', message: result.error || 'Feedback could not be sent.' })
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unknown error'
      console.error('Feedback submit threw error:', submitError)
      const metadata = await getFeedbackRuntimeMetadata(window.location.pathname)
      queueFeedbackForRetry({
        feedbackType,
        message: feedbackMessage.trim(),
        userEmail: feedbackEmail.trim(),
        screenshotName: feedbackScreenshotName || undefined,
        screenshotDataUrl: feedbackScreenshotDataUrl || undefined,
        metadata,
      })

      info('Feedback was saved and will retry automatically.')
      setFeedbackSubmitStatus({ type: 'error', message: `Could not send feedback. ${message}. Saved for retry.` })
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  useEffect(() => {
    if (hasRetriedQueuedFeedback || !isOnline) {
      return
    }

    setHasRetriedQueuedFeedback(true)
    retryQueuedFeedback()
      .then((result) => {
        if (typeof result.sent === 'number' && result.sent > 0) {
          success(`Sent ${result.sent} queued feedback submission(s)`)
        }
      })
      .catch(() => {
      })
  }, [hasRetriedQueuedFeedback, isOnline, success])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Help & Support</h1>
          <p className="text-muted-foreground">
            Report bugs, share suggestions, and request features.
          </p>
        </div>
      </div>

      <Card className="border-none shadow-lg bg-gradient-to-br from-blue-50/50 to-cyan-50/30 dark:from-blue-950/20 dark:to-cyan-950/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Team Contact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-2">For general inquiries, bug reports, and team support, reach out to us at:</p>
          <a href="mailto:progressoshelp@gmail.com" className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-sm">
            progressoshelp@gmail.com
          </a>
        </CardContent>
      </Card>

      <Card className="border-none shadow-lg bg-gradient-to-br from-card to-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Feedback
          </CardTitle>
          <CardDescription>
            Submissions include app diagnostics to help troubleshooting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="feedback-type">Feedback Type</Label>
            <Select value={feedbackType} onValueChange={(value: 'bug-report' | 'suggestion' | 'feature-request' | 'general-feedback') => setFeedbackType(value)}>
              <SelectTrigger id="feedback-type" className="bg-secondary/30 border border-green-500/20 focus-visible:border-green-500/40 dark:bg-secondary/20 dark:border-green-500/15">
                <SelectValue placeholder="Select feedback type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug-report">Bug Report</SelectItem>
                <SelectItem value="suggestion">Suggestion</SelectItem>
                <SelectItem value="feature-request">Feature Request</SelectItem>
                <SelectItem value="general-feedback">General Feedback</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-message">Message <span className="text-destructive">*</span></Label>
            <Textarea
              id="feedback-message"
              value={feedbackMessage}
              onChange={(event) => setFeedbackMessage(event.target.value)}
              placeholder="Describe the issue or idea in detail..."
              className="min-h-[140px] bg-secondary/30 border border-green-500/20 focus-visible:border-green-500/40 dark:bg-secondary/20 dark:border-green-500/15"
              required
              aria-required="true"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="feedback-screenshot" className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                Screenshot Upload (optional)
              </Label>
              <Input
                id="feedback-screenshot"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFeedbackScreenshotChange}
                className="bg-secondary/30 border border-green-500/20 focus-visible:border-green-500/40 dark:bg-secondary/20 dark:border-green-500/15"
              />
              {feedbackScreenshotName && (
                <p className="text-xs text-muted-foreground">Attached: {feedbackScreenshotName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-email">User Email</Label>
              <Input
                id="feedback-email"
                type="email"
                value={feedbackEmail}
                onChange={(event) => {
                  setFeedbackEmailTouched(true)
                  setFeedbackEmail(event.target.value)
                }}
                placeholder="your@email.com"
                className="bg-secondary/30 border border-green-500/20 focus-visible:border-green-500/40 dark:bg-secondary/20 dark:border-green-500/15"
              />
              <p className="text-xs text-muted-foreground">Auto-filled from your profile; you can edit before submitting.</p>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
            Metadata included automatically: App Version, Operating System, Date/Time, and Current Tab/Page.
          </div>

          {!isOnline && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              No internet connection. Please reconnect and try again.
            </div>
          )}

          {feedbackSubmitStatus && (
            <div
              className={feedbackSubmitStatus.type === 'success'
                ? 'rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-700 dark:text-green-300'
                : 'rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300'}
            >
              {feedbackSubmitStatus.message}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleSubmitFeedback}
              disabled={isSubmittingFeedback || !isOnline}
              className="bg-green-500/90 hover:bg-green-600 text-white shadow-sm hover:shadow-md border-none transition-all"
            >
              {isSubmittingFeedback ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </span>
              ) : 'Submit Feedback'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
