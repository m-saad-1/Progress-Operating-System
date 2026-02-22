import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { useStore } from '@/store'
import { useElectron } from '@/hooks/use-electron'
import { database, type TaskTabStatsSnapshot } from '@/lib/database'
import { calculateHabitAnalytics, getDateRange } from '@/lib/progress'
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

  const { data: taskTabStatsSnapshot } = useQuery<TaskTabStatsSnapshot>({
    queryKey: ['task-stats', 'analytics-day-sync'],
    queryFn: () => database.getTaskTabStats(),
    enabled: electron.isReady,
    refetchOnWindowFocus: true,
    staleTime: 0,
    refetchInterval: 30000,
  })

  return useMemo(() => {
    const habitAnalytics = calculateHabitAnalytics(habits, todayRange, allHabitCompletions)
    const taskProgress = clampPercent(taskTabStatsSnapshot?.today?.weightedProgress ?? 0)
    const habitConsistency = clampPercent(habitAnalytics.avgConsistency)
    const overall = clampPercent((taskProgress + habitConsistency) / 2)

    return {
      overall,
      taskProgress,
      habitConsistency,
    }
  }, [allHabitCompletions, habits, taskTabStatsSnapshot?.today?.weightedProgress, todayRange])
}
