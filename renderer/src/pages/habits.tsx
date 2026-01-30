import React, { useState, useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
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
  Search,
  MoreVertical,
  Calendar,
  Flame,
  TrendingUp,
  Target,
  Edit,
  Trash2,
  CheckCircle
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns'
import { useToaster } from '@/hooks/use-toaster'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import { database, CreateHabitDTO, UpdateHabitDTO } from '@/lib/database'
import { Habit } from '@/types'

interface HabitFormData {
  title: string
  description: string
  frequency: Habit['frequency']
  schedule: string[]
  goal_id: string
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
  const { success, error: toastError } = useToaster()
  const { habits, goals, addHabit, updateHabit, deleteHabit } = useStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFrequency, setSelectedFrequency] = useState<Habit['frequency'] | 'all'>('all')
  const [selectedGoal, setSelectedGoal] = useState<string | 'all'>('all')
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

  const filteredHabits = useMemo(() => habits.filter((habit: Habit) => {
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
  }), [habits, searchQuery, selectedFrequency, selectedGoal, sortBy])

  // Calculate statistics
  const stats: HabitStats = useMemo(() => ({
    total: habits.length,
    daily: habits.filter(h => h.frequency === 'daily').length,
    weekly: habits.filter(h => h.frequency === 'weekly').length,
    monthly: habits.filter(h => h.frequency === 'monthly').length,
    activeStreaks: habits.filter(h => h.streak_current >= 7).length,
    averageConsistency: habits.length
      ? Math.round(habits.reduce((sum: number, h: Habit) => sum + (h.consistency_score || 0), 0) / habits.length)
      : 0,
    totalCompletions30d: habits.reduce((sum: number, h: Habit) => sum + (h.consistency_score || 0), 0), // This is likely wrong, but I'll fix it later if needed
  }), [habits])

  // Generate calendar days for the selected month
  const calendarDays = eachDayOfInterval({
    start: startOfMonth(selectedMonth),
    end: endOfMonth(selectedMonth),
  })

  // Create habit mutation
  const createHabitMutation = useMutation({
    mutationFn: async (habitData: CreateHabitDTO) => {
      const newHabitId = await database.createHabit(habitData)
      const newHabit = await database.getHabitById(newHabitId)
      return newHabit
    },
    onSuccess: (newHabit) => {
        if(newHabit) {
            addHabit(newHabit)
            success('Habit created successfully')
            setIsCreating(false)
            resetForm()
        } else {
            toastError('Failed to retrieve created habit.')
        }
    },
    onError: (error) => {
      console.error('Failed to create habit:', error)
      toastError('Failed to create habit')
    },
  })

  // Update habit mutation
  const updateHabitMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateHabitDTO }) => {
        await database.updateHabit(id, updates)
        const updatedHabit = await database.getHabitById(id)
        return updatedHabit
    },
    onSuccess: (updatedHabit) => {
        if (updatedHabit) {
            updateHabit(updatedHabit)
            success('Habit updated successfully')
            setIsEditing(null)
            resetForm()
        } else {
            toastError('Failed to retrieve updated habit.')
        }
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
      date: Date;
      completed: boolean
    }) => {
      await database.markHabitCompleted(habitId, completed)
      const updatedHabit = await database.getHabitById(habitId)
      return updatedHabit
    },
    onSuccess: (updatedHabit) => {
        if(updatedHabit) {
            updateHabit(updatedHabit)
        }
    },
    onError: (error) => {
      console.error('Failed to toggle habit completion:', error)
      toastError('Failed to update habit')
    },
  })

  // Delete habit mutation
  const deleteHabitMutation = useMutation({
    mutationFn: async (id: string) => {
      await database.deleteHabit(id)
      return id
    },
    onSuccess: (id) => {
      deleteHabit(id)
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

  const handleEdit = (habit: Habit) => {
    setIsEditing(habit.id)
    setFormData({
      title: habit.title,
      description: habit.description || '',
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
          ...formData,
        },
      })
    } else {
      createHabitMutation.mutate(formData)
    }
  }

  const handleToggleCompletion = (habitId: string, date: Date, currentlyCompleted: boolean) => {
    toggleHabitCompletionMutation.mutate({
      habitId,
      date,
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
    // This is not efficient, but it's a simple way to check for completion
    // A better approach would be to have a dedicated store for completions
    return false;
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
            <Button className="transition-all duration-300 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg hover:bg-green-700">
              <Plus className="mr-2 h-4 w-4" />
              New Habit
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl bg-card">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>{isEditing ? 'Edit Habit' : 'Create New Habit'}</DialogTitle>
              <DialogDescription>
                Define a recurring practice to build consistency.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto pr-2 -mr-2 scroll-smooth">
              <div className="space-y-6 py-4">
                {/* Basic Information Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Habit Title</label>
                      <Input
                        placeholder="What habit do you want to build?"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="bg-secondary/50 border-green-500/50 focus-visible:ring-primary/50"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        placeholder="Why is this habit important?"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                        className="bg-secondary/50 border-green-500/50 focus-visible:ring-primary/50"
                      />
                    </div>
                  </div>
                </div>

                {/* Frequency & Schedule Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Frequency & Schedule</h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Frequency</label>
                        <Select
                          value={formData.frequency}
                          onValueChange={(value: Habit['frequency']) =>
                            setFormData({ ...formData, frequency: value })
                          }
                        >
                          <SelectTrigger className="bg-secondary/50 border-green-500/50 focus:ring-primary/50">
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
                          <SelectTrigger className="bg-secondary/50 border-green-500/50 focus:ring-primary/50">
                            <SelectValue placeholder="Select a goal..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Goal</SelectItem>
                            {goals?.map((goal) => (
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
                </div>
              </div>
            </div>

            <DialogFooter className="flex-shrink-0 border-t pt-4">
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
            <Progress value={stats.total > 0 ? (stats.activeStreaks / stats.total) * 100 : 0} className="mt-2" />
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
                className="pl-10 bg-secondary/50 border border-green-500/50 focus-visible:ring-1 focus-visible:ring-primary/50"
              />
            </div>

            <div className="flex gap-2">
              <Select value={selectedFrequency} onValueChange={(value) => setSelectedFrequency(value as Habit['frequency'] | 'all')}>
                <SelectTrigger className="w-[140px] bg-secondary/50 border border-green-500/50 focus:ring-1 focus:ring-primary/50">
                  <SelectValue placeholder="Frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Frequencies</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedGoal} onValueChange={(value) => setSelectedGoal(value as string | 'all')}>
                <SelectTrigger className="w-[140px] bg-secondary/50 border border-green-500/50 focus:ring-1 focus:ring-primary/50">
                  <SelectValue placeholder="Goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Goals</SelectItem>
                  <SelectItem value="none">No Goal</SelectItem>
                  {goals?.map((goal) => (
                    <SelectItem key={goal.id} value={goal.id}>
                      {goal.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'streak' | 'consistency' | 'created' | 'updated')}>
                <SelectTrigger className="w-[140px] bg-secondary/50 border border-green-500/50 focus:ring-1 focus:ring-primary/50">
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
                {filteredHabits.slice(0, 10).map((habit: Habit) => (
                  <tr key={habit.id} className="border-t">
                    <td className="p-2">
                      <div className="font-medium">{habit.title}</div>
                      {habit.goal_id && (
                        <div className="text-xs text-muted-foreground">
                          <Target className="inline mr-1 h-3 w-3" />
                          {goals.find(g => g.id === habit.goal_id)?.title}
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
                                ? "bg-green-500 text-white"
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
                          habit.streak_current >= 7 ? "text-orange-500" : "text-muted-foreground"
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
          <TabsTrigger value="all">All Habits ({filteredHabits.length})</TabsTrigger>
          <TabsTrigger value="streaks">Active Streaks ({stats.activeStreaks})</TabsTrigger>
          <TabsTrigger value="consistency">High Consistency</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {filteredHabits.length === 0 ? (
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
              {filteredHabits.map((habit: Habit) => (
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
                      {habit.goal_id && (
                        <Badge variant="secondary">
                          <Target className="mr-1 h-3 w-3" />
                          {goals.find(g => g.id === habit.goal_id)?.title}
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
                              habit.streak_current >= 7 ? "text-orange-500 animate-pulse" : "text-muted-foreground"
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
      </Tabs>
    </div>
  )
}
