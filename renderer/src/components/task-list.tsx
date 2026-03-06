import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Archive } from 'lucide-react';
import { Task } from '../types';
import { 
  CircularProgressSelector, 
  AnimatedProgressBar,
  getProgressTextColor,
  type ProgressValue 
} from '@/components/ui/progress-selector';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TaskListProps {
  tasks: Task[];
  showPriority?: boolean;
  showActions?: boolean;
  compact?: boolean;
  maxItems?: number;
  onProgressChange?: (taskId: string, progress: ProgressValue) => void;
  onEdit?: (task: Task) => void;
  onArchive?: (taskId: string) => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  showPriority = false,
  showActions = false,
  compact = false,
  maxItems,
  onProgressChange,
  onEdit,
  onArchive,
}) => {
  const tasksToShow = maxItems ? tasks.slice(0, maxItems) : tasks;

  if (tasksToShow.length === 0) {
    return <div className="text-center text-muted-foreground py-4">No tasks to display.</div>;
  }

  return (
    <div className="space-y-2">
      {tasksToShow.map((task) => {
        const progress = task.progress || 0;
        const isCompleted = progress === 100;
        return (
        <Card key={task.id} interactive={false} className={cn(
          "transition-all duration-300 border border-green-500/10 shadow-sm",
          isCompleted 
            ? "bg-muted/30 dark:bg-zinc-900/55" 
            : "bg-secondary/40 dark:bg-zinc-900/75 dark:border-zinc-700/60",
          compact ? 'py-2' : 'py-4'
        )}>
          <CardContent className="flex items-center justify-between p-0 px-4">
            <div className="flex items-center space-x-4">
              <CircularProgressSelector
                value={(task.progress || 0) as ProgressValue}
                onChange={(progress) => onProgressChange?.(task.id, progress)}
                size={compact ? "sm" : "md"}
                disabled={!onProgressChange}
              />
              <div className="flex-1 min-w-0">
                <label 
                  htmlFor={`task-${task.id}`} 
                  className={cn(
                    "font-medium cursor-pointer transition-all duration-300",
                    isCompleted && "line-through text-muted-foreground"
                  )}
                >
                  {task.title}
                </label>
                {!compact && (
                  <div className="mt-1">
                    <AnimatedProgressBar 
                      value={task.progress || 0} 
                      height="md" 
                    />
                  </div>
                )}
                {task.due_date && !compact && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(task.due_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Progress Badge */}
              <Badge 
                variant="outline" 
                className={cn(
                  "transition-colors duration-300",
                  getProgressTextColor(task.progress || 0)
                )}
              >
                {task.progress || 0}%
              </Badge>
              {showPriority && task.priority && (
                <Badge 
                  variant="outline"
                  className={cn(
                    "capitalize",
                    task.priority === 'high' && "bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40",
                    task.priority === 'medium' && "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40",
                    task.priority === 'low' && "bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/40"
                  )}
                >
                  {task.priority}
                </Badge>
              )}
              {showActions && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit?.(task)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onArchive?.(task.id)} className="text-orange-600 focus:text-orange-600">
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </CardContent>
        </Card>
        );
      })}
    </div>
  );
};
