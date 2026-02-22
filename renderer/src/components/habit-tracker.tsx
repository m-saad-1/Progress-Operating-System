import { Checkbox } from '@/components/ui/checkbox'
import { Star, Flame, CheckCircle2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useElectron } from '@/hooks/use-electron'
import { database, getLocalDateString } from '@/lib/database'
import { useStore } from '@/store'
import { cn } from '@/lib/utils'
import { 
  isWeeklyHabitCompletedThisWeekPersistent,
  isMonthlyHabitCompletedThisMonthPersistent 
} from '@/lib/habit-logic'

interface HabitTrackerProps {
  habits: any[]
  habitCompletions?: any[]
  compact?: boolean
}

export function HabitTracker({ habits, habitCompletions = [], compact = false }: HabitTrackerProps) {
  const electron = useElectron()
  const queryClient = useQueryClient()
  const { updateHabit } = useStore()
  
  // Use local date string consistently across the app
  const todayStr = getLocalDateString(new Date())
  
  /**
   * Check if a habit is completed for its entire period (week/month)
   */
  const isCompletedForPeriod = (habit: any): boolean => {
    if (habit.frequency === 'weekly') {
      return isWeeklyHabitCompletedThisWeekPersistent(habit.id, habitCompletions)
    } else if (habit.frequency === 'monthly') {
      return isMonthlyHabitCompletedThisMonthPersistent(habit.id, habitCompletions)
    }
    return false
  }

  /**
   * Get the completion label for weekly/monthly habits
   */
  const getCompletionLabel = (habit: any): string => {
    if (habit.frequency === 'weekly') {
      return 'Completed this week'
    } else if (habit.frequency === 'monthly') {
      return 'Completed this month'
    }
    return ''
  }
  
  /**
   * Habit completion mutation
   * - Persists to habit_completions table (fixes persistence bug)
   * - Updates streak and consistency_score in habits table
   * - Invalidates all related queries for proper state sync
   */
  const updateMutation = useMutation({
    mutationFn: async ({ habitId, completed }: { habitId: string; completed: boolean }) => {
      // This function writes to habit_completions table AND updates habit streaks
      // Uses local date internally to avoid timezone issues
      await database.setHabitCompletion(habitId, new Date(), completed)
      // Fetch updated habit to sync store immediately
      const updatedHabit = await database.getHabitById(habitId)
      return updatedHabit
    },
    onMutate: async ({ habitId, completed }) => {
      // Optimistic update for instant UI feedback
      // Use local date string for consistency
      const dashboardKey = ['dashboard', todayStr]
      const todayCompletionsKey = ['habit-completions-today', todayStr]

      await queryClient.cancelQueries({ queryKey: dashboardKey })
      await queryClient.cancelQueries({ queryKey: todayCompletionsKey })
      
      const previous = queryClient.getQueryData<any>(dashboardKey)
      const previousTodayCompletions = queryClient.getQueryData<any[]>(todayCompletionsKey)

      if (previous && Array.isArray(previous.habits)) {
        queryClient.setQueryData(dashboardKey, {
          ...previous,
          habits: previous.habits.map((habit: any) =>
            habit.id === habitId ? { ...habit, today_completed: completed } : habit
          ),
        })
      }
      
      // Also update today's completions for habits page sync
      if (Array.isArray(previousTodayCompletions)) {
        const withoutTarget = previousTodayCompletions.filter((c) => c.habit_id !== habitId)
        const next = completed
          ? [...withoutTarget, { habit_id: habitId, date: todayStr }]
          : withoutTarget
        queryClient.setQueryData(todayCompletionsKey, next)
      }

      return { previous, previousTodayCompletions, dashboardKey, todayCompletionsKey }
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previous && context.dashboardKey) {
        queryClient.setQueryData(context.dashboardKey, context.previous)
      }
      if (context?.previousTodayCompletions && context.todayCompletionsKey) {
        queryClient.setQueryData(context.todayCompletionsKey, context.previousTodayCompletions)
      }
    },
    onSuccess: async (updatedHabit) => {
      if (updatedHabit) {
        updateHabit(updatedHabit as any)
      }
      
      // Refetch today's completions first (critical for instant button state update)
      await queryClient.refetchQueries({ 
        queryKey: ['habit-completions-today', todayStr]
      })
      
      // Then refetch all other related queries in parallel
      const promises = [
        queryClient.refetchQueries({ queryKey: ['dashboard'] }),
        queryClient.refetchQueries({ queryKey: ['habits'] }),
        queryClient.refetchQueries({ queryKey: ['habit-completions'] }),
        queryClient.refetchQueries({ queryKey: ['analytics'] }),
        queryClient.refetchQueries({ queryKey: ['review-insights'] }),
      ]
      await Promise.all(promises)
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    }
  })
  
  if (habits.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No habits for today. Create some habits to build consistency.
      </div>
    )
  }
  
  return (
    <div className={cn("space-y-2", compact && "space-y-1")}>
      {habits.map((habit) => {
        const completedForPeriod = isCompletedForPeriod(habit)
        const completionLabel = getCompletionLabel(habit)
        const isCompleted = habit.today_completed || completedForPeriod
        
        return (
          <div
            key={habit.id}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg transition-colors",
              isCompleted
                ? "bg-green-500/8 border border-green-500/20 dark:bg-green-500/10 dark:border-green-500/25" 
                : "bg-card/50 hover:bg-muted/30 border border-transparent dark:bg-zinc-900/75 dark:border-zinc-700/55 dark:hover:bg-zinc-900/90"
            )}
          >
            <div className="flex items-center space-x-3">
              <Checkbox
                checked={isCompleted}
                onCheckedChange={(checked) => {
                  updateMutation.mutate({
                    habitId: habit.id,
                    completed: checked === true
                  })
                }}
                disabled={updateMutation.isPending || !electron.isReady}
              />
              <div className="flex-1">
                <div className="font-medium flex items-center gap-2">
                  {habit.title}
                  {completedForPeriod && !habit.today_completed && (
                    <CheckCircle2 className="h-4 w-4 text-status-completed" />
                  )}
                </div>
                <div className={cn(
                  "text-sm",
                  completionLabel ? "text-status-completed font-medium" : "text-muted-foreground"
                )}>
                  {completionLabel || (habit.description && !compact ? habit.description : '')}
                </div>
                {!completionLabel && !compact && habit.description && (
                  <div className="text-sm text-muted-foreground">
                    {habit.description}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {habit.streak_current > 0 && (
                <div className="flex items-center text-amber-600">
                  <Flame className="h-4 w-4 mr-1" />
                  <span className="text-sm font-bold">{habit.streak_current}</span>
                </div>
              )}
              
              {habit.consistency_score >= 80 && (
                <Star className="h-4 w-4 text-amber-500" />
              )}
              
              {!compact && (
                <div className="text-sm font-medium">
                  {Math.round(habit.consistency_score)}%
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}