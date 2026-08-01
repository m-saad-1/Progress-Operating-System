import { StateCreator } from 'zustand'
import { Store } from '../index'
import { Task, Habit, Goal } from '@/types'

export interface DataSlice {
  tasks: Task[]
  habits: Habit[]
  goals: Goal[]

  setInitialData: (data: { tasks: Task[]; habits: Habit[]; goals: Goal[] }) => void

  addTask: (task: Task) => void
  updateTask: (task: Task) => void
  deleteTask: (taskId: string) => void
  archiveTask: (taskId: string) => void
  restoreTask: (task: Task) => void

  addHabit: (habit: Habit) => void
  updateHabit: (habit: Habit) => void
  deleteHabit: (habitId: string) => void
  archiveHabit: (habitId: string) => void
  restoreHabit: (habit: Habit) => void

  addGoal: (goal: Goal) => void
  updateGoal: (goal: Goal) => void
  deleteGoal: (goalId: string) => void
  archiveGoal: (goalId: string) => void
  restoreGoal: (goal: Goal) => void
}

export const createDataSlice: StateCreator<
  Store,
  [['zustand/persist', unknown]],
  [],
  DataSlice
> = (set) => ({
  tasks: [],
  habits: [],
  goals: [],

  setInitialData: (data) => set(data),

  // Task Actions
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  updateTask: (task) => set((state) => ({
    tasks: state.tasks.map((t) => (t.id === task.id ? task : t)),
  })),
  deleteTask: (taskId) => set((state) => ({
    tasks: state.tasks.map((t) =>
      t.id === taskId
        ? { ...t, deleted_at: new Date().toISOString() }
        : t
    ),
  })),
  archiveTask: (taskId) => set((state) => ({
    tasks: state.tasks.map((t) =>
      t.id === taskId
        ? { ...t, deleted_at: new Date().toISOString() }
        : t
    ),
  })),
  restoreTask: (task) => set((state) => ({
    tasks: state.tasks.some((t) => t.id === task.id)
      ? state.tasks.map((t) => (t.id === task.id ? { ...task, deleted_at: undefined } : t))
      : [...state.tasks, { ...task, deleted_at: undefined }],
  })),

  // Habit Actions
  addHabit: (habit) => set((state) => ({ habits: [...state.habits, habit] })),
  updateHabit: (habit) => set((state) => ({
    habits: state.habits.map((h) => (h.id === habit.id ? habit : h)),
  })),
  deleteHabit: (habitId) => set((state) => ({
    habits: state.habits.filter((h) => h.id !== habitId),
  })),
  archiveHabit: (habitId) => set((state) => ({
    habits: state.habits.filter((h) => h.id !== habitId),
  })),
  restoreHabit: (habit) => set((state) => ({ habits: [...state.habits, habit] })),

  // Goal Actions
  addGoal: (goal) => set((state) => ({ goals: [...state.goals, goal] })),
  updateGoal: (goal) => set((state) => ({
    goals: state.goals.map((g) => (g.id === goal.id ? goal : g)),
  })),
  deleteGoal: (goalId) => set((state) => ({
    goals: state.goals.filter((g) => g.id !== goalId),
  })),
  archiveGoal: (goalId) => set((state) => ({
    goals: state.goals.filter((g) => g.id !== goalId),
  })),
  restoreGoal: (goal) => set((state) => ({ goals: [...state.goals, goal] })),
})
