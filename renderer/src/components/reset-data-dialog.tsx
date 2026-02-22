import { useState, useEffect } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { AlertTriangle, Trash2, Clock, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResetDataDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function ResetDataDialog({ open, onOpenChange, onConfirm }: ResetDataDialogProps) {
  const [step, setStep] = useState(1)
  const [confirmText, setConfirmText] = useState('')
  const [countdown, setCountdown] = useState(10)
  const [canProceed, setCanProceed] = useState(false)

  const CONFIRMATION_PHRASE = 'DELETE ALL MY DATA'
  const isConfirmationValid = confirmText === CONFIRMATION_PHRASE

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep(1)
      setConfirmText('')
      setCountdown(10)
      setCanProceed(false)
    }
  }, [open])

  // Countdown timer for step 1
  useEffect(() => {
    if (step === 1 && countdown > 0 && open) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0) {
      setCanProceed(true)
    }
  }, [countdown, step, open])

  const handleNext = () => {
    if (step === 1 && canProceed) {
      setStep(2)
    }
  }

  const handleConfirm = () => {
    if (step === 2 && isConfirmationValid) {
      onConfirm()
      onOpenChange(false)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            {step === 1 ? 'Reset All Application Data?' : 'Final Confirmation Required'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-4">
              {step === 1 ? (
                <>
                  {/* Warning Step */}
                  <div className="rounded-lg border-2 border-destructive/50 bg-destructive/5 p-4">
                    <div className="flex items-start gap-3">
                      <Trash2 className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                      <div className="space-y-2 text-sm">
                        <p className="font-semibold text-foreground">
                          This action will permanently delete ALL of your data:
                        </p>
                        <ul className="space-y-1 list-disc list-inside text-muted-foreground">
                          <li>All tasks and their completion history</li>
                          <li>All habits and tracking data</li>
                          <li>All goals and progress records</li>
                          <li>All notes and journal entries</li>
                          <li>All reviews (daily, weekly, monthly)</li>
                          <li>All time blocks and schedules</li>
                          <li>All settings and preferences</li>
                          <li>All sync configurations</li>
                          <li>Database encryption keys</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div className="space-y-2 text-sm">
                        <p className="font-semibold text-foreground">
                          Important Safety Information:
                        </p>
                        <ul className="space-y-1 text-muted-foreground">
                          <li>• This action <span className="font-semibold text-foreground">CANNOT be undone</span></li>
                          <li>• Your existing backups will be preserved but automatically deleted data cannot be recovered</li>
                          <li>• The application will restart after the reset</li>
                          <li>• You will need to reconfigure all settings</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-blue-500/50 bg-blue-500/5 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div className="space-y-2 text-sm">
                        <p className="font-semibold text-foreground">
                          Consider These Alternatives:
                        </p>
                        <ul className="space-y-1 text-muted-foreground">
                          <li>• Create a backup before resetting (recommended)</li>
                          <li>• Export your data if you want to keep a copy</li>
                          <li>• Archive old items instead of deleting everything</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {!canProceed && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          Please take a moment to consider this decision...
                        </span>
                        <span className="font-semibold text-foreground">
                          {countdown}s
                        </span>
                      </div>
                      <Progress value={(10 - countdown) * 10} className="h-2" />
                    </div>
                  )}

                  {canProceed && (
                    <div className="rounded-lg border border-green-500/50 bg-green-500/5 p-3">
                      <p className="text-sm text-center text-muted-foreground">
                        You can now proceed to the final confirmation step
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Confirmation Step */}
                  <div className="rounded-lg border-2 border-destructive bg-destructive/5 p-6 space-y-4">
                    <div className="text-center space-y-2">
                      <Trash2 className="h-12 w-12 text-destructive mx-auto" />
                      <p className="text-lg font-semibold text-foreground">
                        Last Chance to Cancel
                      </p>
                      <p className="text-sm text-muted-foreground">
                        This is your final opportunity to prevent data loss
                      </p>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="confirm-text" className="text-sm">
                        Type <span className="font-mono font-bold text-destructive">{CONFIRMATION_PHRASE}</span> to confirm:
                      </Label>
                      <Input
                        id="confirm-text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="Type the confirmation phrase exactly"
                        className={cn(
                          "font-mono text-center",
                          confirmText && !isConfirmationValid && "border-destructive focus-visible:ring-destructive"
                        )}
                        autoFocus
                      />
                      {confirmText && !isConfirmationValid && (
                        <p className="text-xs text-destructive text-center">
                          The text must match exactly (case-sensitive)
                        </p>
                      )}
                      {isConfirmationValid && (
                        <p className="text-xs text-green-600 text-center font-semibold">
                          ✓ Confirmation phrase is correct
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-4">
                    <p className="text-sm text-center text-muted-foreground">
                      After clicking "Delete Everything", the app will close all connections,
                      delete all data, and restart automatically with a fresh state.
                    </p>
                  </div>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            Cancel
          </AlertDialogCancel>
          {step === 1 ? (
            <AlertDialogAction
              onClick={handleNext}
              disabled={!canProceed}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Continue to Confirmation
            </AlertDialogAction>
          ) : (
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={!isConfirmationValid}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Everything
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
