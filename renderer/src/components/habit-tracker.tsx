import React from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Star, Flame } from 'lucide-react'
import { format } from 'date-fns'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useElectron } from '@/hooks/use-electron'
import { cn } from '@/lib/utils'

interface HabitTrackerProps {
  habits: any[]
  compact?: boolean
}

export function HabitTracker({ habits, compact = false }: HabitTrackerProps) {
  const electron = useElectron()
  const queryClient = useQueryClient()
  
  const updateMutation = useMutation({
    mutationFn: async ({ habitId, completed }: { habitId: string; completed: boolean }) => {
      const today = format(new Date(), 'yyyy-MM-dd')
      
      if (completed) {
        await electron.executeQuery(`
          INSERT OR REPLACE INTO habit_completions (id, habit_id, date, completed, notes)
          VALUES (?, ?, ?, ?, ?)
        `, [
          crypto.randomUUID(),
          habitId,
          today,
          1,
          null
        ])
        
        // Update streak
        await electron.executeQuery(`
          UPDATE habits 
          SET streak_current = streak_current + 1,
              streak_longest = MAX(streak_current + 1, streak_longest),
              consistency_score = (
                SELECT 
                  (COUNT(CASE WHEN completed = 1 THEN 1 END) * 100.0 / COUNT(*))
                FROM habit_completions 
                WHERE habit_id = ?
                AND date >= date('now', '-30 days')
              )
          WHERE id = ?
        `, [habitId, habitId])
      } else {
        await electron.executeQuery(`
          DELETE FROM habit_completions 
          WHERE habit_id = ? AND date = ?
        `, [habitId, today])
        
        // Reset streak if breaking current streak
        await electron.executeQuery(`
          UPDATE habits 
          SET streak_current = 0
          WHERE id = ?
        `, [habitId])
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
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
            "flex items-center justify-between p-3 rounded-lg border",
            habit.today_completed ? "bg-green-50 border-green-200" : "bg-white"
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