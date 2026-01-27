import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Filter,
  Search,
  MoreVertical,
  Calendar,
  Flame,
  TrendingUp,
  Target,
  Edit,
  Trash2,
  X,
  Star,
  BarChart3,
  Clock,
  CheckCircle
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns'
import { useElectron } from '@/hooks/use-electron'
import { useToaster } from '@/hooks/use-toaster'
import { useUndoRedo } from '@/hooks/use-undo-redo'
import { cn } from '@/lib/utils'

interface Habit {
  id: string
  title: string
  description: string
  frequency: 'daily' | 'weekly' | 'monthly'
  schedule: string // JSON string for weekly/monthly
  goal_id: string | null
  streak_current: number
  streak_longest: number
  consistency_score: number
  created_at: string
  updated_at: string
  version: number
}

interface HabitFormData {
  title: string
  description: string
  frequency: Habit['frequency']
  schedule: string[]
  goal_id: string
}

interface HabitWithDetails extends Habit {
  goal_title?: string
  completions_30d?: number
  completions_7d?: number
}

interface HabitView extends Omit<HabitWithDetails, 'schedule'> {
  schedule: string[];
}

interface MonthlyCompletion {
  habit_id: string
  date: string
  completed: 0 | 1
}

interface GoalForHabit {
  id: string
  title: string
}

interface HabitStats {
  total: number
  daily: number
  weekly: number
  monthly: number
  activeStreaks: number
  averageConsistency: number
  totalCompletions30d: number
}

export default function Habits() {
  const electron = useElectron()
  const { toast, success, error: toastError } = useToaster()
  const queryClient = useQueryClient()
  const { executeCommand } = useUndoRedo()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFrequency, setSelectedFrequency] = useState<Habit['frequency'] | 'all'>('all')
  const [selectedGoal, setSelectedGoal] = useState<GoalForHabit['id'] | 'all'>('all')
  const [sortBy, setSortBy] = useState<'streak' | 'consistency' | 'created' | 'updated'>('streak')
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [formData, setFormData] = useState<HabitFormData>({
    title: '',
    description: '',
    frequency: 'daily',
    schedule: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    goal_id: '',
  })
  const [selectedMonth, setSelectedMonth] = useState(new Date())

  // Days of week for schedule selection
  const daysOfWeek = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' },
  ]

  // Fetch habits
  const { data: habits, isLoading, error } = useQuery<HabitView[]>({
    queryKey: ['habits'],
    queryFn: async () => {
      try {
        const habits = await electron.executeQuery<HabitWithDetails[]>(`
          SELECT h.*,
                 g.title as goal_title,
                 (SELECT COUNT(*) FROM habit_completions
                  WHERE habit_id = h.id
                  AND date >= date('now', '-30 days')
                  AND completed = 1) as completions_30d,
                 (SELECT COUNT(*) FROM habit_completions
                  WHERE habit_id = h.id
                  AND date >= date('now', '-7 days')
                  AND completed = 1) as completions_7d
          FROM habits h
          LEFT JOIN goals g ON h.goal_id = g.id
          WHERE h.deleted_at IS NULL
          ORDER BY streak_current DESC, consistency_score DESC
        `)
        return (Array.isArray(habits) ? habits : []).map((habit: any) => ({
          ...habit,
          schedule: JSON.parse(habit.schedule || '[]') as string[],
        })) || []
      } catch (error) {
        console.error('Failed to fetch habits:', error)
        throw error
      }
    },
    enabled: electron.isReady,
  })

  // Fetch habit completions for the selected month
  const { data: monthlyCompletions } = useQuery<MonthlyCompletion[]>({
    queryKey: ['habit-completions', format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      try {
        const start = startOfMonth(selectedMonth)
        const end = endOfMonth(selectedMonth)

        const completions = await electron.executeQuery<MonthlyCompletion[]>(`
          SELECT hc.habit_id, hc.date, hc.completed
          FROM habit_completions hc
          JOIN habits h ON hc.habit_id = h.id
          WHERE hc.date BETWEEN ? AND ?
          AND h.deleted_at IS NULL
        `, [format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')])

        return Array.isArray(completions) ? completions : []
      } catch (error) {
        console.error('Failed to fetch habit completions:', error)
        return []
      }
    },
    enabled: electron.isReady,
  })

  // Fetch goals for dropdown
  const { data: goals } = useQuery<GoalForHabit[]>({
    queryKey: ['goals-for-habits'],
    queryFn: async () => {
      try {
        const goals = await electron.executeQuery<GoalForHabit[]>(`
          SELECT id, title FROM goals
          WHERE status = 'active'
          AND deleted_at IS NULL
          ORDER BY title
        `)
        return Array.isArray(goals) ? goals : []
      } catch (error) {
        console.error('Failed to fetch goals:', error)
        return []
      }
    },
    enabled: electron.isReady,
  })

  // Filter and sort habits
  const filteredHabits = habits?.filter((habit: HabitView) => {
    const matchesSearch = searchQuery === '' ||
      habit.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      habit.description?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesFrequency = selectedFrequency === 'all' || habit.frequency === selectedFrequency
    const matchesGoal = selectedGoal === 'all' || 
      (selectedGoal === 'none' && !habit.goal_id) ||
      habit.goal_id === selectedGoal

    return matchesSearch && matchesFrequency && matchesGoal
  }).sort((a, b) => {
    switch (sortBy) {
      case 'streak':
        return b.streak_current - a.streak_current
      case 'consistency':
        return b.consistency_score - a.consistency_score
      case 'created':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'updated':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      default:
        return 0
    }
  })

  // Calculate statistics
  const stats: HabitStats = {
    total: habits?.length || 0,
    daily: habits?.filter(h => h.frequency === 'daily').length || 0,
    weekly: habits?.filter(h => h.frequency === 'weekly').length || 0,
    monthly: habits?.filter(h => h.frequency === 'monthly').length || 0,
    activeStreaks: habits?.filter(h => h.streak_current >= 7).length || 0,
    averageConsistency: habits?.length
      ? Math.round(habits.reduce((sum: number, h: HabitView) => sum + (h.consistency_score || 0), 0) / habits.length)
      : 0,
    totalCompletions30d: habits?.reduce((sum: number, h: HabitView) => sum + (h.completions_30d || 0), 0) || 0,
  }

  // Generate calendar days for the selected month
  const calendarDays = eachDayOfInterval({
    start: startOfMonth(selectedMonth),
    end: endOfMonth(selectedMonth),
  })

  // Create habit mutation
  const createHabitMutation = useMutation({
    mutationFn: async (habitData: HabitFormData) => {
      const operations = [{
        query: `
          INSERT INTO habits (
            id, title, description, frequency, schedule, goal_id,
            streak_current, streak_longest, consistency_score,
            created_at, updated_at, version
          ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, 1)
        `,
        params: [
          crypto.randomUUID(),
          habitData.title,
          habitData.description,
          habitData.frequency,
          JSON.stringify(habitData.schedule),
          habitData.goal_id || null,
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      }]

      return await electron.executeTransaction(operations)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] })
      queryClient.invalidateQueries({ queryKey: ['habit-completions'] })
      success('Habit created successfully')
      setIsCreating(false)
      resetForm()

      // Register undo command
      executeCommand('create_habit', 'Create Habit', formData)
    },
    onError: (error) => {
      console.error('Failed to create habit:', error)
      toastError('Failed to create habit')
    },
  })

  // Update habit mutation
  const updateHabitMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Habit> }) => {
      const operations = [{
        query: `
          UPDATE habits
          SET title = ?, description = ?, frequency = ?, schedule = ?, goal_id = ?,
              updated_at = ?, version = version + 1
          WHERE id = ?
        `,
        params: [
          updates.title,
          updates.description,
          updates.frequency,
          updates.schedule,
          updates.goal_id,
          new Date().toISOString(),
          id,
        ]
      }]

      return await electron.executeTransaction(operations)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] })
      success('Habit updated successfully')
      setIsEditing(null)
      resetForm()
    },
    onError: (error) => {
      console.error('Failed to update habit:', error)
      toastError('Failed to update habit')
    },
  })

  // Toggle habit completion mutation
  const toggleHabitCompletionMutation = useMutation({
    mutationFn: async ({ habitId, date, completed }: {
      habitId: string;
      date: string;
      completed: boolean
    }) => {
      if (completed) {
        const operations = [{
          query: `
            INSERT OR REPLACE INTO habit_completions (id, habit_id, date, completed, notes)
            VALUES (?, ?, ?, ?, NULL)
          `,
          params: [
            crypto.randomUUID(),
            habitId,
            date,
            1,
          ]
        }, {
          query: `
            UPDATE habits
            SET streak_current = streak_current + 1,
                streak_longest = MAX(streak_current + 1, streak_longest),
                consistency_score = (
                  SELECT
                    (COUNT(CASE WHEN completed = 1 THEN 1 END) * 100.0 / COUNT(*))
                  FROM habit_completions
                  WHERE habit_id = ?
                  AND date >= date('now', '-30 days')
                ),
                updated_at = ?,
                version = version + 1
            WHERE id = ?
          `,
          params: [
            habitId,
            new Date().toISOString(),
            habitId,
          ]
        }]

        return await electron.executeTransaction(operations)
      } else {
        const operations = [{
          query: `
            DELETE FROM habit_completions
            WHERE habit_id = ? AND date = ?
          `,
          params: [habitId, date]
        }, {
          query: `
            UPDATE habits
            SET streak_current = 0,
                updated_at = ?,
                version = version + 1
            WHERE id = ?
          `,
          params: [
            new Date().toISOString(),
            habitId,
          ]
        }]

        return await electron.executeTransaction(operations)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] })
      queryClient.invalidateQueries({ queryKey: ['habit-completions'] })
    },
    onError: (error) => {
      console.error('Failed to toggle habit completion:', error)
      toastError('Failed to update habit')
    },
  })

  // Delete habit mutation
  const deleteHabitMutation = useMutation({
    mutationFn: async (id: string) => {
      const operations = [{
        query: `
          UPDATE habits
          SET deleted_at = ?, updated_at = ?, version = version + 1
          WHERE id = ?
        `,
        params: [new Date().toISOString(), new Date().toISOString(), id]
      }]

      return await electron.executeTransaction(operations)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] })
      queryClient.invalidateQueries({ queryKey: ['habit-completions'] })
      success('Habit deleted')
    },
    onError: (error) => {
      console.error('Failed to delete habit:', error)
      toastError('Failed to delete habit')
    },
  })

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      frequency: 'daily',
      schedule: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      goal_id: '',
    })
  }

  const handleEdit = (habit: HabitView) => {
    setIsEditing(habit.id)
    setFormData({
      title: habit.title,
      description: habit.description,
      frequency: habit.frequency,
      schedule: habit.schedule,
      goal_id: habit.goal_id || '',
    })
  }

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toastError('Please enter a habit title')
      return
    }

    if (isEditing) {
      updateHabitMutation.mutate({
        id: isEditing,
        updates: {
          title: formData.title,
          description: formData.description,
          frequency: formData.frequency,
          schedule: JSON.stringify(formData.schedule), // Stringify schedule for update
          goal_id: formData.goal_id,
        },
      })
    } else {
      createHabitMutation.mutate(formData)
    }
  }

  const handleToggleCompletion = (habitId: string, date: Date, currentlyCompleted: boolean) => {
    const dateString = format(date, 'yyyy-MM-dd')
    toggleHabitCompletionMutation.mutate({
      habitId,
      date: dateString,
      completed: !currentlyCompleted,
    })
  }

  const toggleDayInSchedule = (day: string) => {
    setFormData(prev => ({
      ...prev,
      schedule: prev.schedule.includes(day)
        ? prev.schedule.filter(d => d !== day)
        : [...prev.schedule, day]
    }))
  }

  const getHabitCompletionForDay = (habitId: string, date: Date) => {
    if (!monthlyCompletions) return false
    const dateString = format(date, 'yyyy-MM-dd')
    return monthlyCompletions.some(
      (c: MonthlyCompletion) => c.habit_id === habitId && c.date === dateString && c.completed
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center">
              <X className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to load habits</h3>
              <p className="text-muted-foreground mb-4">
                There was an error loading your habits.
              </p>
              <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['habits'] })}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Habits</h1>
          <p className="text-muted-foreground">
            Build consistency through daily practices
          </p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Habit
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Habit' : 'Create New Habit'}</DialogTitle>
              <DialogDescription>
                Define a recurring practice to build consistency.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Habit Title</label>
                <Input
                  placeholder="What habit do you want to build?"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Why is this habit important?"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Frequency</label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(value: Habit['frequency']) =>
                      setFormData({ ...formData, frequency: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Related Goal (Optional)</label>
                  <Select
                    value={formData.goal_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, goal_id: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a goal..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Goal</SelectItem>
                      {goals?.map((goal: GoalForHabit) => (
                        <SelectItem key={goal.id} value={goal.id}>
                          {goal.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.frequency === 'weekly' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Schedule</label>
                  <div className="flex flex-wrap gap-2">
                    {daysOfWeek.map(day => (
                      <Button
                        key={day.value}
                        type="button"
                        variant={formData.schedule.includes(day.value) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleDayInSchedule(day.value)}
                      >
                        {day.label.slice(0, 3)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsCreating(false)
                setIsEditing(null)
                resetForm()
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createHabitMutation.isPending || updateHabitMutation.isPending}
              >
                {isEditing ? 'Update Habit' : 'Create Habit'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Habits</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.daily} daily, {stats.weekly} weekly, {stats.monthly} monthly
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Streaks</CardTitle>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeStreaks}</div>
            <Progress value={(stats.activeStreaks / stats.total) * 100} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              7+ day streaks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Consistency</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageConsistency}%</div>
            <Progress value={stats.averageConsistency} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completions (30d)</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCompletions30d}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round(stats.totalCompletions30d / 30)} per day
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search habits..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2">
              <Select value={selectedFrequency} onValueChange={(value) => setSelectedFrequency(value as Habit['frequency'] | 'all')}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Frequencies</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedGoal} onValueChange={(value) => setSelectedGoal(value as GoalForHabit['id'] | 'all')}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Goals</SelectItem>
                  <SelectItem value="none">No Goal</SelectItem>
                  {goals?.map((goal: GoalForHabit) => (
                    <SelectItem key={goal.id} value={goal.id}>
                      {goal.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'streak' | 'consistency' | 'created' | 'updated')}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="streak">Streak</SelectItem>
                  <SelectItem value="consistency">Consistency</SelectItem>
                  <SelectItem value="created">Recently Created</SelectItem>
                  <SelectItem value="updated">Recently Updated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Monthly Overview</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}
              >
                Previous
              </Button>
              <span className="font-medium">
                {format(selectedMonth, 'MMMM yyyy')}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}
              >
                Next
              </Button>
            </div>
          </div>
          <CardDescription>
            Track your habit completion for {format(selectedMonth, 'MMMM yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left p-2">Habit</th>
                  {calendarDays.map(day => (
                    <th key={day.toISOString()} className="text-center p-2 text-sm">
                      {format(day, 'd')}
                      <div className="text-xs text-muted-foreground">
                        {format(day, 'EEE')}
                      </div>
                    </th>
                  ))}
                  <th className="text-center p-2">Streak</th>
                  <th className="text-center p-2">Consistency</th>
                </tr>
              </thead>
              <tbody>
                {filteredHabits?.slice(0, 10).map((habit: HabitView) => (
                  <tr key={habit.id} className="border-t">
                    <td className="p-2">
                      <div className="font-medium">{habit.title}</div>
                      {habit.goal_title && (
                        <div className="text-xs text-muted-foreground">
                          <Target className="inline mr-1 h-3 w-3" />
                          {habit.goal_title}
                        </div>
                      )}
                    </td>
                    {calendarDays.map(day => {
                      const isCompleted = getHabitCompletionForDay(habit.id, day)
                      const isToday = isSameDay(day, new Date())

                      return (
                        <td key={day.toISOString()} className="text-center p-2">
                          <button
                            onClick={() => handleToggleCompletion(habit.id, day, isCompleted)}
                            className={cn(
                              "h-6 w-6 rounded-full flex items-center justify-center mx-auto",
                              isCompleted
                                ? "bg-status-completed text-white"
                                : isToday
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                            )}
                            title={format(day, 'MMM d, yyyy')}
                          >
                            {isCompleted ? '✓' : ''}
                          </button>
                        </td>
                      )
                    })}
                    <td className="text-center p-2">
                      <div className="flex items-center justify-center gap-1">
                        <Flame className={cn(
                          "h-4 w-4",
                          habit.streak_current >= 7 ? "text-streak-current" : "text-muted-foreground"
                        )} />
                        <span className="font-bold">{habit.streak_current}</span>
                        {habit.streak_longest > habit.streak_current && (
                          <span className="text-xs text-muted-foreground">
                            (best: {habit.streak_longest})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-center p-2">
                      <div className="flex items-center justify-center">
                        <Progress
                          value={habit.consistency_score}
                          className="w-20 h-2 mx-auto"
                        />
                        <span className="ml-2 text-sm font-medium">
                          {Math.round(habit.consistency_score)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Habits List */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Habits ({filteredHabits?.length || 0})</TabsTrigger>
          <TabsTrigger value="streaks">Active Streaks ({stats.activeStreaks})</TabsTrigger>
          <TabsTrigger value="consistency">High Consistency</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="pt-6">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredHabits?.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No habits found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || selectedFrequency !== 'all' || selectedGoal !== 'all'
                    ? 'Try changing your filters or search query'
                    : 'Create your first habit to build consistency!'}
                </p>
                {!searchQuery && selectedFrequency === 'all' && selectedGoal === 'all' && (
                  <Button onClick={() => setIsCreating(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Habit
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredHabits?.map((habit: HabitView) => (
                <Card key={habit.id} className="card-hover">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="truncate">{habit.title}</CardTitle>
                        <CardDescription className="truncate">
                          {habit.description || 'No description'}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleEdit(habit)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteHabitMutation.mutate(habit.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {habit.frequency}
                      </Badge>
                      {habit.goal_title && (
                        <Badge variant="secondary">
                          <Target className="mr-1 h-3 w-3" />
                          {habit.goal_title}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-4">
                      {/* Streak and Consistency */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Flame className={cn(
                              "h-5 w-5",
                              habit.streak_current >= 7 ? "text-streak-current animate-pulse" : "text-muted-foreground"
                            )} />
                            <div>
                              <div className="text-2xl font-bold">{habit.streak_current}</div>
                              <div className="text-xs text-muted-foreground">Current Streak</div>
                            </div>
                          </div>
                          {habit.streak_longest > habit.streak_current && (
                            <div className="text-xs text-muted-foreground">
                              Best: {habit.streak_longest} days
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="text-2xl font-bold">
                                {Math.round(habit.consistency_score)}%
                              </div>
                              <div className="text-xs text-muted-foreground">Consistency</div>
                            </div>
                          </div>
                          <Progress value={habit.consistency_score} className="h-2" />
                        </div>
                      </div>

                      {/* Recent Stats */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <div className="text-muted-foreground">Last 7 days</div>
                          <div className="font-semibold">
                            {habit.completions_7d || 0}/7 days
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-muted-foreground">Last 30 days</div>
                          <div className="font-semibold">
                            {habit.completions_30d || 0}/30 days
                          </div>
                        </div>
                      </div>

                      {/* Schedule */}
                      {habit.frequency === 'weekly' && (
                        <div className="space-y-2">
                          <div className="text-sm font-medium">Schedule</div>
                          <div className="flex gap-1">
                            {habit.schedule.map((day: string) => (
                              <div
                                key={day}
                                className={cn(
                                  "h-6 w-6 rounded-full text-xs flex items-center justify-center",
                                  daysOfWeek.map(d => d.value).includes(day)
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground"
                                )}
                                title={day}
                              >
                                {day[0].toUpperCase()}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        const today = new Date()
                        handleToggleCompletion(
                          habit.id,
                          today,
                          getHabitCompletionForDay(habit.id, today)
                        )
                      }}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Mark Today as Complete
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="streaks" className="mt-6">
          {/* Similar content but filtered for active streaks */}
        </TabsContent>

        <TabsContent value="consistency" className="mt-6">
          {/* Similar content but filtered for high consistency */}
        </TabsContent>
      </Tabs>
    </div>
  )
}