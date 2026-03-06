import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type TipsSection = {
  title: string
  points: readonly string[]
}

interface ContextTipsDialogProps {
  title: string
  description?: string
  sections: readonly TipsSection[]
  triggerLabel?: string
  triggerClassName?: string
  contentClassName?: string
  onboardingKey?: string
  showOnboardingIndicator?: boolean
  reminderIntervalDays?: number
}

export function ContextTipsDialog({
  title,
  description,
  sections,
  triggerLabel = 'Open tips',
  triggerClassName,
  contentClassName,
  onboardingKey,
  showOnboardingIndicator = true,
  reminderIntervalDays = 30,
}: ContextTipsDialogProps) {
  const storageKey = useMemo(
    () => `tips-onboarding-state:${onboardingKey || title.toLowerCase().replace(/\s+/g, '-')}`,
    [onboardingKey, title]
  )
  const [showIndicator, setShowIndicator] = useState(false)

  type ReminderState = {
    hasSeenOnce?: boolean
    lastPromptAt?: number
    promptCount?: number
  }

  const resolveIndicatorState = useMemo(() => {
    const monthlyIntervalMs = Math.max(1, reminderIntervalDays) * 24 * 60 * 60 * 1000
    const initialReturnIntervalMs = 21 * 24 * 60 * 60 * 1000

    return (existing: ReminderState | null, now: number) => {
      const state = existing || {}
      const promptCount = state.promptCount || 0

      const firstOpen = !state.hasSeenOnce && !state.lastPromptAt
      if (firstOpen) {
        return {
          shouldShow: true,
          nextState: {
            ...state,
            hasSeenOnce: true,
            lastPromptAt: now,
            promptCount: 1,
          } as ReminderState,
          intervalMs: initialReturnIntervalMs,
        }
      }

      const anchor = state.lastPromptAt || now
      const nextInterval = promptCount <= 1 ? initialReturnIntervalMs : monthlyIntervalMs
      const shouldTriggerNextPrompt = now - anchor >= nextInterval

      return {
        shouldShow: shouldTriggerNextPrompt,
        nextState: {
          ...state,
          ...(shouldTriggerNextPrompt
            ? {
                hasSeenOnce: true,
                lastPromptAt: now,
                promptCount: promptCount + 1,
              }
            : {}),
        } as ReminderState,
        intervalMs: nextInterval,
      }
    }
  }, [reminderIntervalDays])

  useEffect(() => {
    if (!showOnboardingIndicator) {
      setShowIndicator(false)
      return
    }

    try {
      const rawState = localStorage.getItem(storageKey)
      const parsedState = rawState ? (JSON.parse(rawState) as ReminderState) : null
      const now = Date.now()
      const resolved = resolveIndicatorState(parsedState, now)

      setShowIndicator(resolved.shouldShow)
      localStorage.setItem(storageKey, JSON.stringify(resolved.nextState))
    } catch {
      setShowIndicator(true)
    }
  }, [showOnboardingIndicator, storageKey, resolveIndicatorState])

  useEffect(() => {
    if (!showIndicator) return

    const timeout = setTimeout(() => {
      setShowIndicator(false)
    }, 12000)

    return () => clearTimeout(timeout)
  }, [showIndicator])

  const handleOpenChange = (open: boolean) => {
    if (open && showIndicator) {
      try {
        const rawState = localStorage.getItem(storageKey)
        const parsedState = rawState ? (JSON.parse(rawState) as ReminderState) : {}
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            ...parsedState,
            hasSeenOnce: true,
            lastPromptAt: Date.now(),
          } satisfies ReminderState)
        )
      } catch {
        // ignore storage failures
      }
      setShowIndicator(false)
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative inline-flex h-6 w-6 shrink-0 items-center justify-center align-middle text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none',
            triggerClassName
          )}
          aria-label={triggerLabel}
        >
          {showIndicator && (
            <>
              <span className="pointer-events-none absolute left-1/2 top-1/2 inline-flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 animate-ping" />
              <span className="pointer-events-none absolute left-1/2 top-1/2 inline-flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-primary/30" />
            </>
          )}
          <HelpCircle className="relative z-10 h-[1.2rem] w-[1.2rem]" />
        </button>
      </DialogTrigger>
      <DialogContent className={cn('sm:max-w-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-zinc-700 shadow-xl', contentClassName)}>
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-slate-100">{title}</DialogTitle>
          {description && <DialogDescription className="text-slate-600 dark:text-slate-400">{description}</DialogDescription>}
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto space-y-4 pr-1">
          {sections.map((section) => (
            <div key={section.title} className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3.5">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{section.title}</h4>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                {section.points.map((point) => (
                  <li key={point} className="leading-relaxed">• {point}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
