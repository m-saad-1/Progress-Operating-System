import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { MoreHorizontal } from 'lucide-react';

// Define the shape of a task object based on dashboard.tsx
interface Task {
  id: number;
  title: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  due_date?: string;
  // Add other properties as needed from your actual task structure
}

interface TaskListProps {
  tasks: Task[];
  showPriority?: boolean;
  showActions?: boolean;
  compact?: boolean;
  maxItems?: number;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  showPriority = false,
  showActions = false,
  compact = false,
  maxItems,
}) => {
  const tasksToShow = maxItems ? tasks.slice(0, maxItems) : tasks;

  if (tasksToShow.length === 0) {
    return <div className="text-center text-muted-foreground py-4">No tasks to display.</div>;
  }



  return (
    <div className="space-y-2">
      {tasksToShow.map((task) => (
        <Card key={task.id} className={`transition-all ${compact ? 'py-2' : 'py-4'}`}>
          <CardContent className="flex items-center justify-between p-0 px-4">
            <div className="flex items-center space-x-4">
              <Checkbox id={`task-${task.id}`} />
              <div>
                <label htmlFor={`task-${task.id}`} className="font-medium cursor-pointer">
                  {task.title}
                </label>
                {task.due_date && !compact && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(task.due_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
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
