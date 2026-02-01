import { Checkbox } from '@/components/ui/checkbox'
import { Star, Flame } from 'lucide-react'
import { format } from 'date-fns'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useElectron } from '@/hooks/use-electron'
import { database } from '@/lib/database'
import { cn } from '@/lib/utils'

interface HabitTrackerProps {
  habits: any[]
  compact?: boolean
}

export function HabitTracker({ habits, compact = false }: HabitTrackerProps) {
  const electron = useElectron()
  const queryClient = useQueryClient()
  
  /**
   * Habit completion mutation
   * - Persists to habit_completions table (fixes persistence bug)
   * - Updates streak and consistency_score in habits table
   * - Invalidates all related queries for proper state sync
   */
  const updateMutation = useMutation({
    mutationFn: async ({ habitId, completed }: { habitId: string; completed: boolean }) => {
      // This function writes to habit_completions table AND updates habit streaks
      await database.setHabitCompletion(habitId, new Date(), completed)
    },
    onMutate: async ({ habitId, completed }) => {
      // Optimistic update for instant UI feedback
      const todayKey = format(new Date(), 'yyyy-MM-dd')
      const dashboardKey = ['dashboard', todayKey]

      await queryClient.cancelQueries({ queryKey: dashboardKey })
      const previous = queryClient.getQueryData<any>(dashboardKey)

      if (previous && Array.isArray(previous.habits)) {
        queryClient.setQueryData(dashboardKey, {
          ...previous,
          habits: previous.habits.map((habit: any) =>
            habit.id === habitId ? { ...habit, today_completed: completed } : habit
          ),
        })
      }

      return { previous, dashboardKey }
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previous && context.dashboardKey) {
        queryClient.setQueryData(context.dashboardKey, context.previous)
      }
    },
    onSuccess: () => {
      // Invalidate all related queries for consistent data across the app
      // This ensures:
      // - Dashboard stats update immediately
      // - Analytics graphs reflect the change
      // - Sidebar daily progress updates
      // - Habit consistency stat updates
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['habits'] })
      queryClient.invalidateQueries({ queryKey: ['habit-completions'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      queryClient.invalidateQueries({ queryKey: ['goals'] }) // Goals linked to habits
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
      {habits.map((habit) => (
        <div
          key={habit.id}
          className={cn(
            "flex items-center justify-between p-3 rounded-lg transition-colors",
            habit.today_completed 
              ? "bg-status-completed/10 border border-status-completed/20 dark:bg-status-completed/15 dark:border-status-completed/30" 
              : "bg-card/50 hover:bg-muted/30 border border-transparent dark:bg-secondary/20"
          )}
        >
          <div className="flex items-center space-x-3">
            <Checkbox
              checked={habit.today_completed}
              onCheckedChange={(checked) => {
                updateMutation.mutate({
                  habitId: habit.id,
                  completed: checked === true
                })
              }}
              disabled={updateMutation.isPending || !electron.isReady}
            />
            <div>
              <div className="font-medium">{habit.title}</div>
              {!compact && habit.description && (
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
      ))}
    </div>
  )
}