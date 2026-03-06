import type { QueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { normalizeDailyProgress } from '@/lib/daily-reset'
import type { Task, TaskProgress, TaskStatus } from '@/types'

export const invalidateTaskCoreQueries = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  queryClient.invalidateQueries({ queryKey: ['analytics'] })
  queryClient.invalidateQueries({ queryKey: ['task-stats'] })
  queryClient.invalidateQueries({ queryKey: ['task-tab-stats-snapshot'] })
  queryClient.invalidateQueries({ queryKey: ['today-tasks'] })
  queryClient.invalidateQueries({ queryKey: ['yesterday-tasks'] })
  queryClient.invalidateQueries({ queryKey: ['tasks'] })
  queryClient.invalidateQueries({ queryKey: ['today-analytics-productivity'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
  queryClient.invalidateQueries({ queryKey: ['calendar-data'] })
}

export const invalidateTaskAnalyticsQueries = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: ['task-analytics-chart'] })
  queryClient.invalidateQueries({ queryKey: ['task-analytics-chart-rolling'] })
  queryClient.invalidateQueries({ queryKey: ['task-analytics-chart-daily-activity'] })
  queryClient.invalidateQueries({ queryKey: ['task-analytics-chart-consistency'] })
  queryClient.invalidateQueries({ queryKey: ['task-range-analytics'] })
  queryClient.invalidateQueries({ queryKey: ['task-monthly-history'] })
}

export const invalidateTaskRelatedQueries = (queryClient: QueryClient) => {
  invalidateTaskCoreQueries(queryClient)
  invalidateTaskAnalyticsQueries(queryClient)
}

export const buildTaskProgressUpdatePayload = (task: Task | any, progress: number) => {
  const isCompleted = progress === 100
  const status: TaskStatus = isCompleted ? 'completed' : progress > 0 ? 'in-progress' : 'pending'
  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const dailyProgress = normalizeDailyProgress(task as Task)

  dailyProgress[todayKey] = {
    progress: progress as TaskProgress,
    status,
    recorded_at: new Date().toISOString(),
    source: 'user',
  }

  const updates: Record<string, any> = {
    progress: progress as TaskProgress,
    status,
    daily_progress: dailyProgress,
    completed_at: isCompleted ? new Date().toISOString() : null,
  }

  return { updates, status }
}
