import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { Task } from '../types';
import { 
  CircularProgressSelector, 
  AnimatedProgressBar,
  getProgressTextColor,
  type ProgressValue 
} from '@/components/ui/progress-selector';
import { cn } from '@/lib/utils';

interface TaskListProps {
  tasks: Task[];
  showPriority?: boolean;
  showActions?: boolean;
  compact?: boolean;
  maxItems?: number;
  onProgressChange?: (taskId: string, progress: ProgressValue) => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  showPriority = false,
  showActions = false,
  compact = false,
  maxItems,
  onProgressChange,
}) => {
  const tasksToShow = maxItems ? tasks.slice(0, maxItems) : tasks;

  if (tasksToShow.length === 0) {
    return <div className="text-center text-muted-foreground py-4">No tasks to display.</div>;
  }

  return (
    <div className="space-y-2">
      {tasksToShow.map((task) => (
        <Card key={task.id} interactive={false} className={cn(
          "transition-all duration-300 border border-green-500/10 shadow-sm",
          task.status === 'completed' || task.progress === 100 
            ? "bg-muted/30 dark:bg-muted/20" 
            : "bg-secondary/40 dark:bg-secondary/30",
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
                    task.progress === 100 && "line-through text-muted-foreground"
                  )}
                >
                  {task.title}
                </label>
                {!compact && (
                  <div className="mt-1">
                    <AnimatedProgressBar 
                      value={task.progress || 0} 
                      height="sm" 
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
                <Badge variant={task.priority}>
                  {task.priority}
                </Badge>
              )}
              {showActions && (
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
