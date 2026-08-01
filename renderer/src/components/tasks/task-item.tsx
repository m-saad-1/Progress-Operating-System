import React from 'react'
import { format } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { 
  Edit,
  Archive,
  Play,
  Pause,
  ChevronDown,
  ChevronRight,
  Calendar,
  Clock,
  Target
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Task } from '@/types'
import { 
  ProgressSelector, 
  CircularProgressSelector,
  AnimatedProgressBar,
  getProgressTextColor,
  type ProgressValue 
} from '@/components/ui/progress-selector'
import { safeParseDate } from '@/lib/date-safe'
import { PROGRESS_LEVELS } from '@/components/ui/progress-selector'

const getProgressLabel = (value: number) =>
  PROGRESS_LEVELS.find((level) => level.value === value)?.label || ''

type TaskItemProps = {
  task: Task
  goals: any[]
  expanded: boolean
  onToggleExpand: () => void
  onProgressChange: (progress: ProgressValue) => void
  onEdit: () => void
  onDelete: () => void
  onOpenDetails: () => void
  onPauseToggle?: (isPaused: boolean) => void
  readonly?: boolean
  hideActions?: boolean
  allowProgressEditWhenPaused?: boolean
}

const TaskItemBase: React.FC<TaskItemProps> = ({ task, goals, expanded, onToggleExpand, onProgressChange, onEdit, onDelete, onOpenDetails, onPauseToggle, readonly = false, hideActions = false, allowProgressEditWhenPaused = false }) => {
  const progress = task.progress ?? 0
  const displayProgress = (task.status ?? 'pending') === 'pending' && progress === 0 ? -1 : progress
  const isCompleted = task.status === 'completed' || progress === 100
  const isInteractionLocked = readonly || (task.is_paused && !allowProgressEditWhenPaused)

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
      <Card interactive className={cn(
        "transition-all duration-300",
        isCompleted && "bg-muted/30 dark:bg-muted/20"
      )}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            {/* Progress Selector */}
            <div className="mt-1">
              <CircularProgressSelector
                value={(task.progress || 0) as ProgressValue}
                onChange={isInteractionLocked ? () => {} : onProgressChange}
                size="md"
                showPercentage={(task.progress || 0) > 0}
                disabled={isInteractionLocked}
              />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={onToggleExpand}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {expanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  <h3 className={cn(
                    "font-medium transition-all duration-300",
                    isCompleted && "line-through text-muted-foreground",
                    task.is_paused && "line-through text-muted-foreground"
                  )}>
                    {task.title}
                  </h3>
                  {task.is_paused && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs h-5">
                      ⏸ Paused
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline"
                    className={cn(
                      "capitalize",
                      task.priority === 'high' && "bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20",
                      task.priority === 'medium' && "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20",
                      task.priority === 'low' && "bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20"
                    )}
                  >
                    {task.priority}
                  </Badge>

                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      task.duration_type === 'today' && "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20",
                      task.duration_type === 'continuous' && "bg-purple-500/10 text-purple-600 border-purple-500/20 hover:bg-purple-500/20"
                    )}
                  >
                    {task.duration_type === 'today' ? 'Today-only' : 'Continuous'}
                  </Badge>
                  
                  {/* Progress Badge */}
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "transition-colors duration-300",
                      getProgressTextColor(task.progress || 0),
                      isCompleted && "bg-green-500/10"
                    )}
                  >
                    {task.progress || 0}%
                  </Badge>

                  <div className="flex items-center gap-1">
                    {!readonly && !hideActions && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-primary/10"
                          onClick={onEdit}
                          aria-label="Edit task"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {/* Pause/Resume Button - Icon only, for Continuous Tasks */}
                        {task.duration_type === 'continuous' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onPauseToggle?.(!task.is_paused)
                                  }}
                                >
                                  {task.is_paused ? (
                                    <Play className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <Pause className="h-4 w-4 text-amber-600" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="w-56 p-3">
                                <div className="space-y-2">
                                  {task.is_paused ? (
                                    <>
                                      <p className="font-semibold text-green-600 flex items-center gap-1">
                                        <Play className="h-4 w-4" />
                                        Resume Task
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Click to resume tracking progress. Task will start counting toward daily progress.
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="font-semibold text-amber-600 flex items-center gap-1">
                                        <Pause className="h-4 w-4" />
                                        Pause Task
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Progress will be frozen ❄️ and won't count toward daily goals, analytics, or statistics.
                                      </p>
                                      <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                                        Resume later to continue tracking.
                                      </p>
                                    </>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-orange-600 hover:bg-orange-500/10 hover:text-orange-600"
                          onClick={onDelete}
                          aria-label="Archive task"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Inline Progress Bar */}
              <div className="mb-2">
                <AnimatedProgressBar value={task.progress || 0} height="sm" />
              </div>
              
              {/* Expanded Details */}
              {expanded && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="ml-6 mt-3 space-y-3">
                      {task.description && (
                        <p className="text-sm text-muted-foreground">
                          {task.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {task.due_date && task.duration_type !== 'continuous' && (
                          <div className="flex items-center">
                            <Calendar className="mr-1 h-3 w-3" />
                            Due: {format(safeParseDate(task.due_date), 'MMM d, yyyy')}
                          </div>
                        )}
                        
                        {task.estimated_time && (
                          <div className="flex items-center">
                            <Clock className="mr-1 h-3 w-3" />
                            Est: {task.estimated_time}min
                          </div>
                        )}
                        
                        {task.goal_id && (
                          <div className="flex items-center">
                            <Target className="mr-1 h-3 w-3" />
                            {goals.find(g => g.id === task.goal_id)?.title}
                          </div>
                        )}
                      </div>
                      
                      {/* Quick Progress Selector in expanded view - starts empty if no progress */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Quick progress:</span>
                          <ProgressSelector
                            value={displayProgress as ProgressValue}
                            onChange={isInteractionLocked ? () => {} : onProgressChange}
                            size="md"
                            showLabel={false}
                            disabled={isInteractionLocked}
                          />
                          <span className={cn("text-sm font-medium", displayProgress === -1 ? "text-muted-foreground" : getProgressTextColor(progress))}>
                            {displayProgress === -1 ? 'Not set' : getProgressLabel(progress)}
                          </span>
                        </div>
                        {!hideActions && (
                          <button
                            type="button"
                            onClick={onOpenDetails}
                            className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline transition-colors"
                          >
                            Details
                          </button>
                        )}
                      </div>
                      
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {task.tags.map((tag: string) => (
                            <Badge key={tag} variant="outline" className="text-xs bg-purple-500/10 text-purple-700 border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/40">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export const TaskItem = React.memo(TaskItemBase, (prev, next) => {
  return (
    prev.task === next.task &&
    prev.goals === next.goals &&
    prev.expanded === next.expanded &&
    prev.readonly === next.readonly &&
    prev.hideActions === next.hideActions &&
    prev.allowProgressEditWhenPaused === next.allowProgressEditWhenPaused
  )
})
