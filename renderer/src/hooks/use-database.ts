import { useState, useEffect, useCallback } from 'react'
import { database, type Goal, type Task, type Habit, type Note } from '@/lib/database'

export function useDatabase() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const initialize = async () => {
      try {
        await database.initialize()
        setIsInitialized(true)
      } catch (err) {
        setError(err as Error)
        console.error('Failed to initialize database:', err)
      }
    }

    initialize()
  }, [])

  const getGoals = useCallback(async (filters?: any) => {
    if (!isInitialized) return []
    try {
      return await database.getGoals(filters)
    } catch (err) {
      setError(err as Error)
      return []
    }
  }, [isInitialized])

  const getTasks = useCallback(async (filters?: any) => {
    if (!isInitialized) return []
    try {
      return await database.getTasks(filters)
    } catch (err) {
      setError(err as Error)
      return []
    }
  }, [isInitialized])

  const getHabits = useCallback(async (filters?: any) => {
    if (!isInitialized) return []
    try {
      return await database.getHabits(filters)
    } catch (err) {
      setError(err as Error)
      return []
    }
  }, [isInitialized])

  const getNotes = useCallback(async (filters?: any) => {
    if (!isInitialized) return []
    try {
      return await database.getNotes(filters)
    } catch (err) {
      setError(err as Error)
      return []
    }
  }, [isInitialized])

  const getDashboardStats = useCallback(async () => {
    if (!isInitialized) return null
    try {
      return await database.getDashboardStats()
    } catch (err) {
      setError(err as Error)
      return null
    }
  }, [isInitialized])

  const createGoal = useCallback(async (data: any) => {
    if (!isInitialized) return null
    try {
      return await database.createGoal(data)
    } catch (err) {
      setError(err as Error)
      return null
    }
  }, [isInitialized])

  const updateGoal = useCallback(async (id: string, data: any) => {
    if (!isInitialized) return
    try {
      await database.updateGoal(id, data)
    } catch (err) {
      setError(err as Error)
    }
  }, [isInitialized])

  const deleteGoal = useCallback(async (id: string) => {
    if (!isInitialized) return
    try {
      await database.deleteGoal(id)
    } catch (err) {
      setError(err as Error)
    }
  }, [isInitialized])

  const markHabitCompleted = useCallback(async (habitId: string, completed: boolean) => {
    if (!isInitialized) return
    try {
      await database.markHabitCompleted(habitId, completed)
    } catch (err) {
      setError(err as Error)
    }
  }, [isInitialized])

  const completeTask = useCallback(async (taskId: string, progress = 100) => {
    if (!isInitialized) return
    try {
      await database.completeTask(taskId, progress)
    } catch (err) {
      setError(err as Error)
    }
  }, [isInitialized])

  return {
    isInitialized,
    error,
    getGoals,
    getTasks,
    getHabits,
    getNotes,
    getDashboardStats,
    createGoal,
    updateGoal,
    deleteGoal,
    markHabitCompleted,
    completeTask,
    // Re-export database instance for direct access if needed
    database,
  }
}