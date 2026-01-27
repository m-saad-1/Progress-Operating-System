import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    variant?: "default" | "success" | "warning" | "destructive"
    showValue?: boolean
  }
>(({ className, value, variant = "default", showValue = false, ...props }, ref) => {
  const variantClasses = {
    default: "bg-primary",
    success: "bg-status-completed",
    warning: "bg-status-paused",
    destructive: "bg-destructive",
  }

  return (
    <div className="relative w-full">
      <ProgressPrimitive.Root
        ref={ref}
        className={cn(
          "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
          className
        )}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            "h-full w-full flex-1 transition-all duration-300 ease-out",
            variantClasses[variant]
          )}
          style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
      </ProgressPrimitive.Root>
      {showValue && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-semibold text-primary-foreground">
            {Math.round(value || 0)}%
          </span>
        </div>
      )}
    </div>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

// Circular Progress Component
interface CircularProgressProps {
  value: number
  size?: number
  strokeWidth?: number
  variant?: "default" | "success" | "warning" | "destructive"
  showValue?: boolean
  className?: string
}

const CircularProgress = React.forwardRef<HTMLDivElement, CircularProgressProps>(
  ({ value, size = 40, strokeWidth = 4, variant = "default", showValue = true, className }, ref) => {
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const offset = circumference - (value / 100) * circumference

    const variantClasses = {
      default: "text-primary",
      success: "text-status-completed",
      warning: "text-status-paused",
      destructive: "text-destructive",
    }

    return (
      <div
        ref={ref}
        className={cn("relative inline-flex items-center justify-center", className)}
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            className="fill-none stroke-secondary"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            className={cn(
              "fill-none transition-all duration-500 ease-out progress-ring",
              variantClasses[variant]
            )}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        {showValue && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold">{Math.round(value)}%</span>
          </div>
        )}
      </div>
    )
  }
)
CircularProgress.displayName = "CircularProgress"

export { Progress, CircularProgress }