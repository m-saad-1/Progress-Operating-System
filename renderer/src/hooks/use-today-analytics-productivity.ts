import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { useStore } from '@/store'
import { useElectron } from '@/hooks/use-electron'
import { database } from '@/lib/database'
import { calculateHabitAnalytics, calculateTaskAnalytics, calculateProductivityScore, getDateRange } from '@/lib/progress'
import type { HabitCompletion } from '@/types'

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value || 0)))

export interface TodayAnalyticsProductivity {
  overall: number
  taskProgress: number
  habitConsistency: number
}

export const useTodayAnalyticsProductivity = (): TodayAnalyticsProductivity => {
  const electron = useElectron()
  const habits = useStore((state) => state.habits)
  const todayRange = useMemo(() => getDateRange('day'), [])

  // Fetch task stats snapshot from database (same source as analytics tab)
  const { data: taskTabStatsSnapshot } = useQuery({
    queryKey: ['task-tab-stats-snapshot'],
    queryFn: async () => {
      if (!electron.isReady) return null
      return await database.getTaskTabStats()
    },
    enabled: electron.isReady,
    refetchOnWindowFocus: true,
    staleTime: 0,
    refetchInterval: 30000,
  })

  const { data: allHabitCompletions = [] } = useQuery<HabitCompletion[]>({
    queryKey: ['habit-completions-all'],
    queryFn: async () => {
      if (!electron.isReady) return []
      const earliestHabitDate = habits.length > 0
        ? habits
            .map((habit) => format(parseISO(habit.created_at), 'yyyy-MM-dd'))
            .sort()[0]
        : format(new Date(), 'yyyy-MM-dd')
      const today = format(new Date(), 'yyyy-MM-dd')
      return await database.getHabitCompletions(earliestHabitDate, today)
    },
    enabled: electron.isReady,
    refetchOnWindowFocus: true,
    staleTime: 0,
    refetchInterval: 30000,
  })

  return useMemo(() => {
    const daySummary = taskTabStatsSnapshot?.today
    
    // Use database task stats if available, otherwise fallback to empty stats
    const taskAnalytics = daySummary ? {
      total: daySummary.total,
      completed: daySummary.completed,
      partiallyCompleted: daySummary.partially,
      skipped: daySummary.skipped,
      inProgress: daySummary.partially,
      pending: Math.max(daySummary.total - daySummary.completed - daySummary.partially - daySummary.skipped, 0),
      blocked: 0,
      overdue: 0,
      earnedWeight: daySummary.earnedWeight,
      totalWeight: daySummary.plannedWeight,
      weightedCompletionRate: daySummary.weightedProgress,
      simpleCompletionRate: daySummary.total > 0 ? Math.round((daySummary.completed / daySummary.total) * 100) : 0,
      byPriority: {
        high: { total: 0, completed: 0, plannedWeight: 0, earnedWeight: 0 },
        medium: { total: 0, completed: 0, plannedWeight: 0, earnedWeight: 0 },
        low: { total: 0, completed: 0, plannedWeight: 0, earnedWeight: 0 },
      },
      completedByPriority: {
        high: 0,
        medium: 0,
        low: 0,
      },
    } : {
      total: 0,
      completed: 0,
      partiallyCompleted: 0,
      skipped: 0,
      inProgress: 0,
      pending: 0,
      blocked: 0,
      overdue: 0,
      earnedWeight: 0,
      totalWeight: 0,
      weightedCompletionRate: 0,
      simpleCompletionRate: 0,
      byPriority: {
        high: { total: 0, completed: 0, plannedWeight: 0, earnedWeight: 0 },
        medium: { total: 0, completed: 0, plannedWeight: 0, earnedWeight: 0 },
        low: { total: 0, completed: 0, plannedWeight: 0, earnedWeight: 0 },
      },
      completedByPriority: {
        high: 0,
        medium: 0,
        low: 0,
      },
    }
    
    const habitAnalytics = calculateHabitAnalytics(habits, todayRange, allHabitCompletions)
    const productivityScore = calculateProductivityScore(taskAnalytics, habitAnalytics)
    const taskProgress = clampPercent(taskAnalytics.weightedCompletionRate)
    const habitConsistency = clampPercent(habitAnalytics.avgConsistency)

    return {
      overall: productivityScore.overall,
      taskProgress,
      habitConsistency,
    }
  }, [allHabitCompletions, habits, taskTabStatsSnapshot, todayRange])
}
