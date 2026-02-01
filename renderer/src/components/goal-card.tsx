import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MoreVertical,
  Target,
  Calendar,
  TrendingUp,
  Edit,
  Archive,
  Trash2,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface GoalCardProps {
  goal: {
    id: string
    title: string
    description: string
    category: string
    priority: string
    status: string
    progress: number
    start_date: string
    target_date: string | null
    tags: string[]
  }
  onEdit?: (goalId: string) => void
  onArchive?: (goalId: string) => void
  onDelete?: (goalId: string) => void
  onUpdateProgress?: (goalId: string, progress: number) => void
  compact?: boolean
}

export function GoalCard({
  goal,
  onEdit,
  onArchive,
  onDelete,
  onUpdateProgress,
  compact = false,
}: GoalCardProps) {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'career':
        return 'category-career'
      case 'health':
        return 'category-health'
      case 'learning':
        return 'category-learning'
      case 'finance':
        return 'category-finance'
      case 'personal':
        return 'category-personal'
      default:
        return 'category-custom'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'priority-critical'
      case 'high':
        return 'priority-high'
      case 'medium':
        return 'priority-medium'
      case 'low':
        return 'priority-low'
      default:
        return 'priority-medium'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'status-active'
      case 'completed':
        return 'status-completed'
      case 'paused':
        return 'status-paused'
      case 'archived':
        return 'status-archived'
      default:
        return 'status-active'
    }
  }

  const isOverdue = goal.target_date && new Date(goal.target_date) < new Date()

  return (
    <Card interactive className={cn(
      "transition-all duration-300",
      compact && "h-full"
    )}>
      <CardHeader className={cn(
        "pb-3",
        compact && "p-4"
      )}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <Target className="h-4 w-4 text-primary" />
              <CardTitle className={cn(
                "text-lg truncate",
                compact && "text-base"
              )}>
                {goal.title}
              </CardTitle>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={getCategoryColor(goal.category) as any}>
                {goal.category}
              </Badge>
              <Badge variant={getPriorityColor(goal.priority) as any}>
                {goal.priority}
              </Badge>
              <Badge variant={getStatusColor(goal.status) as any}>
                {goal.status}
              </Badge>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(goal.id)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem>
                <RefreshCw className="mr-2 h-4 w-4" />
                Update Progress
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {onArchive && (
                <DropdownMenuItem onClick={() => onArchive(goal.id)}>
                  <Archive className="mr-2 h-4 w-4" />
                  {goal.status === 'archived' ? 'Unarchive' : 'Archive'}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {onDelete && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(goal.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className={cn(
        "pt-0",
        compact && "p-4 pt-0"
      )}>
        {!compact && goal.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {goal.description}
          </p>
        )}
        
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm font-bold text-primary">
                {Math.round(goal.progress)}%
              </span>
            </div>
            <Progress value={goal.progress} className="h-2" />
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center">
              <Calendar className="h-3 w-3 mr-1" />
              <span>Start: {format(new Date(goal.start_date), 'MMM d, yyyy')}</span>
            </div>
            {goal.target_date && (
              <div className={cn(
                "flex items-center",
                isOverdue && "text-destructive font-medium"
              )}>
                <TrendingUp className="h-3 w-3 mr-1" />
                <span>Target: {format(new Date(goal.target_date), 'MMM d, yyyy')}</span>
                {isOverdue && <span className="ml-1">(Overdue)</span>}
              </div>
            )}
          </div>
          
          {goal.tags && goal.tags.length > 0 && !compact && (
            <div className="flex flex-wrap gap-1 pt-2">
              {goal.tags.slice(0, 3).map((tag, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="text-xs"
                >
                  {tag}
                </Badge>
              ))}
              {goal.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{goal.tags.length - 3} more
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}