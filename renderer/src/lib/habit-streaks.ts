import {
  addDays,
  addWeeks,
  addMonths,
  differenceInCalendarDays,
  differenceInCalendarWeeks,
  differenceInCalendarMonths,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { Habit, HabitCompletion } from '@/types'

type HabitFrequency = Habit['frequency']

type PeriodOptions = {
  excludeCurrent?: boolean
  now?: Date
}

const getPeriodStart = (date: Date, frequency: HabitFrequency): Date => {
  switch (frequency) {
    case 'weekly':
      return startOfWeek(date, { weekStartsOn: 1 })
    case 'monthly':
      return startOfMonth(date)
    case 'daily':
    default:
      return startOfDay(date)
  }
}

const getPeriodKey = (date: Date, frequency: HabitFrequency): string => {
  const periodStart = getPeriodStart(date, frequency)
  if (frequency === 'monthly') {
    return format(periodStart, 'yyyy-MM')
  }
  return format(periodStart, 'yyyy-MM-dd')
}

const addPeriod = (date: Date, frequency: HabitFrequency, amount: number): Date => {
  switch (frequency) {
    case 'weekly':
      return addWeeks(date, amount)
    case 'monthly':
      return addMonths(date, amount)
    case 'daily':
    default:
      return addDays(date, amount)
  }
}

export const getHabitCompletionPeriodKeys = (
  habit: Habit,
  completions: HabitCompletion[],
  options: PeriodOptions = {}
): Set<string> => {
  const now = options.now ?? new Date()
  const currentPeriodKey = getPeriodKey(now, habit.frequency)
  const excludeCurrent = options.excludeCurrent ?? false
  const createdAt = habit.created_at ? startOfDay(parseISO(habit.created_at)) : null

  const periodKeys = new Set<string>()

  completions
    .filter((completion) => completion.habit_id === habit.id && completion.completed)
    .forEach((completion) => {
      const completionDate = parseISO(completion.date)
      if (createdAt && startOfDay(completionDate).getTime() < createdAt.getTime()) {
        return
      }
      const periodKey = getPeriodKey(completionDate, habit.frequency)
      if (!excludeCurrent || periodKey !== currentPeriodKey) {
        periodKeys.add(periodKey)
      }
    })

  return periodKeys
}

export const calculateHabitStreaks = (
  habit: Habit,
  completions: HabitCompletion[],
  now: Date = new Date()
): { current: number; longest: number } => {
  if (!habit.created_at) return { current: 0, longest: 0 }

  const createdAt = startOfDay(parseISO(habit.created_at))
  const creationPeriodStart = getPeriodStart(createdAt, habit.frequency)
  const currentPeriodStart = getPeriodStart(now, habit.frequency)
  const lastCompletePeriodStart = addPeriod(currentPeriodStart, habit.frequency, -1)

  if (lastCompletePeriodStart.getTime() < creationPeriodStart.getTime()) {
    return { current: 0, longest: 0 }
  }

  const completedPeriods = getHabitCompletionPeriodKeys(habit, completions, {
    excludeCurrent: true,
    now,
  })

  let current = 0
  let cursor = lastCompletePeriodStart

  while (cursor.getTime() >= creationPeriodStart.getTime()) {
    const key = getPeriodKey(cursor, habit.frequency)
    if (completedPeriods.has(key)) {
      current += 1
      cursor = addPeriod(cursor, habit.frequency, -1)
    } else {
      break
    }
  }

  let longest = 0
  let running = 0
  cursor = creationPeriodStart

  while (cursor.getTime() <= lastCompletePeriodStart.getTime()) {
    const key = getPeriodKey(cursor, habit.frequency)
    if (completedPeriods.has(key)) {
      running += 1
      longest = Math.max(longest, running)
    } else {
      running = 0
    }
    cursor = addPeriod(cursor, habit.frequency, 1)
  }

  return { current, longest }
}

export const countHabitCompletedPeriods = (
  habit: Habit,
  completions: HabitCompletion[],
  now: Date = new Date()
): number => {
  return getHabitCompletionPeriodKeys(habit, completions, { now }).size
}

export const countHabitTotalPeriods = (habit: Habit, now: Date = new Date()): number => {
  if (!habit.created_at) return 0

  const createdAt = startOfDay(parseISO(habit.created_at))
  const today = startOfDay(now)

  if (createdAt.getTime() > today.getTime()) return 0

  switch (habit.frequency) {
    case 'weekly': {
      const createdWeek = startOfWeek(createdAt, { weekStartsOn: 1 })
      const currentWeek = startOfWeek(today, { weekStartsOn: 1 })
      const weeks = differenceInCalendarWeeks(currentWeek, createdWeek, { weekStartsOn: 1 })
      return Math.max(0, weeks + 1)
    }
    case 'monthly': {
      const createdMonth = startOfMonth(createdAt)
      const currentMonth = startOfMonth(today)
      const months = differenceInCalendarMonths(currentMonth, createdMonth)
      return Math.max(0, months + 1)
    }
    case 'daily':
    default: {
      const days = differenceInCalendarDays(today, createdAt)
      return Math.max(0, days + 1)
    }
  }
}
