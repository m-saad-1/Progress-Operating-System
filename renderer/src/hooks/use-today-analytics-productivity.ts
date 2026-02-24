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
  const tasks = useStore((state) => state.tasks)
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

  return useMemo(() => {
    const taskAnalytics = calculateTaskAnalytics(tasks, todayRange)
    const habitAnalytics = calculateHabitAnalytics(habits, todayRange, allHabitCompletions)
    const productivityScore = calculateProductivityScore(taskAnalytics, habitAnalytics)
    const taskProgress = clampPercent(taskAnalytics.weightedCompletionRate)
    const habitConsistency = clampPercent(habitAnalytics.avgConsistency)

    return {
      overall: productivityScore.overall,
      taskProgress,
      habitConsistency,
    }
  }, [allHabitCompletions, habits, tasks, todayRange])
}
