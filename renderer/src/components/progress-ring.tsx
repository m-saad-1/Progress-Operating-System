import React from 'react'
import { cn } from '@/lib/utils'

interface ProgressRingProps {
  value: number
  size?: number
  strokeWidth?: number
  variant?: 'default' | 'success' | 'warning' | 'destructive'
  showValue?: boolean
  className?: string
}

export function ProgressRing({
  value,
  size = 40,
  strokeWidth = 4,
  variant = 'default',
  showValue = true,
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (value / 100) * circumference

  const variantClasses = {
    default: 'text-primary',
    success: 'text-status-completed',
    warning: 'text-status-paused',
    destructive: 'text-destructive',
  }

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="fill-none stroke-secondary"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className={cn(
            'fill-none transition-all duration-500 ease-out progress-ring',
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