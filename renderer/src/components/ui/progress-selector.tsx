import * as React from "react"
import { cn } from "@/lib/utils"
import { Check, HelpCircle } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Progress levels with their visual states
const PROGRESS_LEVELS = [
  { value: 0, label: "Skipped", color: "bg-red-500", textColor: "text-red-500", borderColor: "border-red-500", strokeColor: "stroke-red-500" },
  { value: 25, label: "25%", color: "bg-gray-400", textColor: "text-gray-400", borderColor: "border-gray-400", strokeColor: "stroke-gray-400" },
  { value: 50, label: "50%", color: "bg-yellow-500", textColor: "text-yellow-500", borderColor: "border-yellow-500", strokeColor: "stroke-yellow-500" },
  { value: 75, label: "75%", color: "bg-green-400/70", textColor: "text-green-400", borderColor: "border-green-400", strokeColor: "stroke-green-400" },
  { value: 100, label: "Done", color: "bg-green-500", textColor: "text-green-500", borderColor: "border-green-500", strokeColor: "stroke-green-500" },
] as const

type ProgressValue = 0 | 25 | 50 | 75 | 100

interface ProgressSelectorProps {
  value: number
  onChange: (value: ProgressValue) => void
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
  className?: string
  disabled?: boolean
}

// Get color class based on progress value
export function getProgressColor(value: number): string {
  if (value === 0) return "bg-red-500"
  if (value <= 25) return "bg-gray-400"
  if (value <= 50) return "bg-yellow-500"
  if (value <= 75) return "bg-green-400/70"
  return "bg-green-500"
}

export function getProgressTextColor(value: number): string {
  if (value === 0) return "text-red-500"
  if (value <= 25) return "text-gray-400"
  if (value <= 50) return "text-yellow-500"
  if (value <= 75) return "text-green-400"
  return "text-green-500"
}

export function getProgressBorderColor(value: number): string {
  if (value === 0) return "border-red-500"
  if (value <= 25) return "border-gray-400"
  if (value <= 50) return "border-yellow-500"
  if (value <= 75) return "border-green-400"
  return "border-green-500"
}

function getProgressStrokeColor(value: number): string {
  if (value === 0) return "stroke-red-500"
  if (value <= 25) return "stroke-gray-400"
  if (value <= 50) return "stroke-yellow-500"
  if (value <= 75) return "stroke-green-400"
  return "stroke-green-500"
}

// Segmented Progress Selector - Inline version
export const ProgressSelector = React.forwardRef<HTMLDivElement, ProgressSelectorProps>(
  ({ value, onChange, size = "md", showLabel = false, className, disabled }, ref) => {
    const currentLevel = PROGRESS_LEVELS.find(l => l.value === value) || PROGRESS_LEVELS[0]
    const currentIndex = PROGRESS_LEVELS.findIndex(l => l.value === value)
    
    const segmentSizes = {
      sm: "h-1.5 w-3",
      md: "h-2 w-4",
      lg: "h-2.5 w-5",
    }

    return (
      <div ref={ref} className={cn("flex items-center gap-2", className)}>
        <div 
          className={cn(
            "flex items-center gap-0.5 p-1 rounded-lg bg-secondary/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {PROGRESS_LEVELS.map((level, index) => (
            <button
              key={level.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(level.value as ProgressValue)}
              className={cn(
                "rounded transition-all duration-200 ease-out",
                segmentSizes[size],
                index <= currentIndex ? level.color : "bg-secondary",
                !disabled && "hover:scale-110 cursor-pointer",
                "focus:outline-none focus:ring-2 focus:ring-primary/50"
              )}
              title={level.label}
            />
          ))}
        </div>
        {showLabel && (
          <span className={cn("text-sm font-medium", currentLevel.textColor)}>
            {currentLevel.label}
          </span>
        )}
      </div>
    )
  }
)
ProgressSelector.displayName = "ProgressSelector"

// Circular Progress Selector with CSS animation
interface CircularProgressSelectorProps extends ProgressSelectorProps {
  showPercentage?: boolean
}

export const CircularProgressSelector = React.forwardRef<HTMLDivElement, CircularProgressSelectorProps>(
  ({ value, onChange, size = "md", showPercentage = true, className, disabled }, ref) => {
    const [isExpanded, setIsExpanded] = React.useState(false)
    const currentLevel = PROGRESS_LEVELS.find(l => l.value === value) || PROGRESS_LEVELS[0]
    
    const sizeConfig = {
      sm: { outer: 32, inner: 24, stroke: 3 },
      md: { outer: 40, inner: 32, stroke: 4 },
      lg: { outer: 56, inner: 44, stroke: 5 },
    }
    
    const config = sizeConfig[size]
    const radius = (config.inner - config.stroke) / 2
    const circumference = radius * 2 * Math.PI
    const offset = circumference - (value / 100) * circumference

    // Close expanded menu when clicking outside
    React.useEffect(() => {
      if (isExpanded) {
        const handleClickOutside = () => setIsExpanded(false)
        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
      }
    }, [isExpanded])

    return (
      <div ref={ref} className={cn("relative inline-flex", className)}>
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation()
            !disabled && setIsExpanded(!isExpanded)
          }}
          className={cn(
            "relative rounded-full transition-transform duration-200",
            !disabled && "hover:scale-105 cursor-pointer",
            "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
          )}
          style={{ width: config.outer, height: config.outer }}
        >
          <svg 
            width={config.outer} 
            height={config.outer} 
            className="transform -rotate-90"
          >
            {/* Background circle */}
            <circle
              cx={config.outer / 2}
              cy={config.outer / 2}
              r={radius}
              strokeWidth={config.stroke}
              className="fill-none stroke-secondary"
            />
            {/* Progress circle with CSS transition */}
            <circle
              cx={config.outer / 2}
              cy={config.outer / 2}
              r={radius}
              strokeWidth={config.stroke}
              className={cn(
                "fill-none transition-all duration-500 ease-out",
                getProgressStrokeColor(value)
              )}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </svg>
          
          {/* Center content */}
          <div className="absolute inset-0 flex items-center justify-center">
            {value === 100 ? (
              <div className="animate-in zoom-in duration-200">
                <Check className={cn("h-4 w-4", currentLevel.textColor)} />
              </div>
            ) : showPercentage ? (
              <span className={cn("text-xs font-bold transition-colors duration-300", currentLevel.textColor)}>
                {value}
              </span>
            ) : null}
          </div>
        </button>
        
        {/* Expanded selector */}
        {isExpanded && (
          <div 
            className="absolute left-1/2 -translate-x-[40%] top-full mt-2 z-50 w-52 bg-popover border rounded-lg shadow-lg p-2 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between pb-1 mb-1 border-b border-border/50">
                <span className="text-xs font-medium text-muted-foreground">How much work done?</span>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/70 hover:text-primary cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs p-3">
                      <div className="space-y-2 text-xs">
                        <p><strong>0% (Skipped):</strong> No work completed; excluded from completion.</p>
                        <p><strong>25% complete:</strong> Started with initial progress.</p>
                        <p><strong>50% complete:</strong> Roughly half of the work is done.</p>
                        <p><strong>75% complete:</strong> Most work finished; final steps remain.</p>
                        <p><strong>100% complete:</strong> Task fully completed.</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {PROGRESS_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => {
                    onChange(level.value as ProgressValue)
                    setIsExpanded(false)
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition-colors",
                    value === level.value ? "bg-secondary" : "hover:bg-secondary/70"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-sm",
                    level.value === 0 ? "bg-rose-500" :
                    level.value === 25 ? "bg-slate-400" :
                    level.value === 50 ? "bg-amber-500" :
                    level.value === 75 ? "bg-emerald-400" :
                    "bg-emerald-600"
                  )} />
                  <span className="text-foreground/90 font-medium">{level.value}%</span>
                  <span className="text-muted-foreground/70 ml-auto text-[10px]">{level.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }
)
CircularProgressSelector.displayName = "CircularProgressSelector"

// Animated Progress Bar with CSS transitions
interface AnimatedProgressBarProps {
  value: number
  height?: "sm" | "md" | "lg"
  showLabel?: boolean
  className?: string
  animate?: boolean
}

export const AnimatedProgressBar = React.forwardRef<HTMLDivElement, AnimatedProgressBarProps>(
  ({ value, height = "md", showLabel = false, className }, ref) => {
    const heightClasses = {
      sm: "h-1.5",
      md: "h-2.5",
      lg: "h-4",
    }
    
    const progressColor = getProgressColor(value)

    return (
      <div ref={ref} className={cn("w-full", className)}>
        <div className={cn(
          "relative w-full overflow-hidden rounded-full bg-secondary",
          heightClasses[height]
        )}>
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              progressColor
            )}
            style={{ width: `${value}%` }}
          />
        </div>
        {showLabel && (
          <div className="flex justify-between mt-1">
            <span className={cn("text-xs font-medium", getProgressTextColor(value))}>
              {value}%
            </span>
          </div>
        )}
      </div>
    )
  }
)
AnimatedProgressBar.displayName = "AnimatedProgressBar"

// Quick Progress Buttons - Alternative inline control
interface QuickProgressButtonsProps {
  value: number
  onChange: (value: ProgressValue) => void
  className?: string
  disabled?: boolean
}

export const QuickProgressButtons = React.forwardRef<HTMLDivElement, QuickProgressButtonsProps>(
  ({ value, onChange, className, disabled }, ref) => {
    return (
      <div ref={ref} className={cn("flex items-center gap-1", className)}>
        {PROGRESS_LEVELS.map((level) => (
          <button
            key={level.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(level.value as ProgressValue)}
            className={cn(
              "px-2 py-1 text-xs font-medium rounded-md transition-all duration-200",
              value === level.value
                ? cn(level.color, "text-white scale-105")
                : "bg-secondary hover:bg-secondary/80",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {level.value === 0 ? "0" : level.value === 100 ? "✓" : `${level.value}`}
          </button>
        ))}
      </div>
    )
  }
)
QuickProgressButtons.displayName = "QuickProgressButtons"

export { PROGRESS_LEVELS }
export type { ProgressValue }
