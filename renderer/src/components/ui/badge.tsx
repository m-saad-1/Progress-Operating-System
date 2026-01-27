import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success: "border-transparent bg-status-completed text-white hover:bg-status-completed/80",
        warning: "border-transparent bg-status-paused text-white hover:bg-status-paused/80",
        // Category variants
        career: "border-transparent bg-category-career/10 text-category-career hover:bg-category-career/20",
        health: "border-transparent bg-category-health/10 text-category-health hover:bg-category-health/20",
        learning: "border-transparent bg-category-learning/10 text-category-learning hover:bg-category-learning/20",
        finance: "border-transparent bg-category-finance/10 text-category-finance hover:bg-category-finance/20",
        personal: "border-transparent bg-category-personal/10 text-category-personal hover:bg-category-personal/20",
        // Priority variants
        low: "border-transparent bg-priority-low/10 text-priority-low hover:bg-priority-low/20",
        medium: "border-transparent bg-priority-medium/10 text-priority-medium hover:bg-priority-medium/20",
        high: "border-transparent bg-priority-high/10 text-priority-high hover:bg-priority-high/20",
        critical: "border-transparent bg-priority-critical/10 text-priority-critical hover:bg-priority-critical/20",
      },
      size: {
        default: "px-2.5 py-0.5",
        sm: "px-2 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  )
}

export { Badge, badgeVariants }