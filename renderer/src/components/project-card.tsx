import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Folder,
  Calendar,
  Users,
  MoreVertical,
  Edit,
  Archive,
  Trash2,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface ProjectCardProps {
  project: {
    id: string
    title: string
    description: string
    status: string
    progress: number
    start_date: string
    end_date: string | null
    task_count: number
    completed_tasks: number
  }
  onEdit?: (projectId: string) => void
  onArchive?: (projectId: string) => void
  onDelete?: (projectId: string) => void
  onViewDetails?: (projectId: string) => void
  compact?: boolean
}

export function ProjectCard({
  project,
  onEdit,
  onArchive,
  onDelete,
  onViewDetails,
  compact = false,
}: ProjectCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'status-active'
      case 'completed':
        return 'status-completed'
      case 'cancelled':
        return 'status-archived'
      case 'planning':
        return 'status-paused'
      default:
        return 'status-active'
    }
  }

  const completionRate = project.task_count > 0 
    ? Math.round((project.completed_tasks / project.task_count) * 100)
    : 0

  const isOverdue = project.end_date && new Date(project.end_date) < new Date()

  return (
    <Card className={cn(
      "transition-all duration-300 hover:shadow-lg",
      compact && "h-full"
    )}>
      <CardHeader className={cn(
        "pb-3",
        compact && "p-4"
      )}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <Folder className="h-4 w-4 text-primary" />
              <CardTitle className={cn(
                "text-lg truncate",
                compact && "text-base"
              )}>
                {project.title}
              </CardTitle>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={getStatusColor(project.status) as any}>
                {project.status}
              </Badge>
              <Badge variant="outline">
                {project.task_count} tasks
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onViewDetails?.(project.id)}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className={cn(
        "pt-0",
        compact && "p-4 pt-0"
      )}>
        {!compact && project.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {project.description}
          </p>
        )}
        
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm font-bold text-primary">
                {Math.round(project.progress)}%
              </span>
            </div>
            <Progress value={project.progress} className="h-2" />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center text-xs text-muted-foreground">
                <Calendar className="h-3 w-3 mr-1" />
                <span>Start</span>
              </div>
              <div className="text-sm font-medium">
                {format(new Date(project.start_date), 'MMM d')}
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center text-xs text-muted-foreground">
                <Calendar className="h-3 w-3 mr-1" />
                <span>End</span>
              </div>
              <div className={cn(
                "text-sm font-medium",
                isOverdue && "text-destructive"
              )}>
                {project.end_date 
                  ? format(new Date(project.end_date), 'MMM d')
                  : 'No date'}
                {isOverdue && ' (Overdue)'}
              </div>
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center text-xs text-muted-foreground">
              <Users className="h-3 w-3 mr-1" />
              <span>Task Completion</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm">
                {project.completed_tasks} of {project.task_count} completed
              </div>
              <div className="text-sm font-medium">
                {completionRate}%
              </div>
            </div>
            <Progress value={completionRate} className="h-1" />
          </div>
          
          <div className="flex items-center justify-between pt-2">
            {onViewDetails && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewDetails(project.id)}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View Details
              </Button>
            )}
            
            <div className="flex items-center space-x-1">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit(project.id)}
                >
                  <Edit className="h-3 w-3" />
                </Button>
              )}
              {onArchive && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onArchive(project.id)}
                >
                  <Archive className="h-3 w-3" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onDelete(project.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}