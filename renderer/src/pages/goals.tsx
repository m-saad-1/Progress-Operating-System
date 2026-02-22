import { useState, useMemo, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  MoreVertical, 
  Target, 
  Calendar,
  Archive,
  Edit,
  Eye,
  CheckCircle,
  X,
  ListTodo,
  Repeat,
  Activity,
  AlertCircle
} from 'lucide-react'
import { format, parseISO, isBefore, differenceInMonths, differenceInDays } from 'date-fns'
import { useToaster } from '@/hooks/use-toaster'
import { useElectron } from '@/hooks/use-electron'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import { database, CreateGoalDTO, UpdateGoalDTO } from '@/lib/database'
import { Goal, HabitCompletion, Task } from '@/types'
import { 
  calculateGoalAnalytics
} from '@/lib/progress'
import { ContextTipsDialog } from '@/components/context-tips-dialog'

interface GoalFormData {
  title: string
  description: string
  category: Goal['category']
  priority: Goal['priority']
  target_date: string
  motivation: string
  tags: string[]
}

interface GoalActivityItem {
  date: string
  action: string
}

interface GoalInsights {
  linkedTasks: Task[]
  linkedHabitsCount: number
  completedTasksCount: number
  completionEvents: number
  avgHabitConsistency: number
  activeDays: number
  activeDuration: string
  totalEffortMinutes: number
  totalEffortHours: number
  recentActivity: GoalActivityItem[]
  metadata: {
    createdAt: string
    updatedAt: string
    startDate: string
    targetDate?: string
    completedAt?: string
    status: string
  }
}

interface GoalStats {
  total: number;
  active: number;
  completed: number;
  overdue: number;
}

const GOAL_TIPS_SECTIONS = [
  {
    title: 'Goal Tracking Logic',
    points: [
      'Goal progress is strengthened by real linked execution, not only by editing goal details.',
      'Use clear target dates and priority levels to keep weekly decisions aligned with long-term direction.',
      'Review active goals frequently to prevent drift and hidden overdue risk.',
    ],
  },
  {
    title: 'Impact of Linked Tasks and Habits',
    points: [
      'Linked tasks capture concrete delivery events that move goals forward.',
      'Linked habits support consistency and show whether your system is sustainable.',
      'A balanced mix of tasks (milestones) and habits (routines) usually performs best over time.',
    ],
  },
  {
    title: 'Effort and Long-Term Strategy',
    points: [
      'Track effort minutes/hours to compare intention versus actual investment.',
      'If activity is low for multiple periods, reduce scope or split the goal into smaller phases.',
      'Use review cycles to recalibrate timelines before goals become chronically overdue.',
    ],
  },
] as const

export default function Goals() {
  const queryClient = useQueryClient()
  const { success, error: toastError } = useToaster()
  const electron = useElectron()
  const { goals, tasks, habits, addGoal, updateGoal, archiveGoal } = useStore()
  
  const [searchQuery] = useState('')
  const [selectedCategory] = useState<Goal['category'] | 'all'>('all')
  const [selectedStatus] = useState<Goal['status'] | 'all'>('all')
  const [selectedPriority] = useState<Goal['priority'] | 'all'>('all')
  const [sortBy] = useState<'priority' | 'due_date' | 'updated' | 'tasks'>('priority')
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [detailsGoalId, setDetailsGoalId] = useState<string | null>(null)
  const [formData, setFormData] = useState<GoalFormData>({
    title: '',
    description: '',
    category: 'personal',
    priority: 'medium',
    target_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    motivation: '',
    tags: [],
  })
  const [newTag, setNewTag] = useState('')

  const { data: allHabitCompletions = [] } = useQuery<HabitCompletion[]>({
    queryKey: ['goals-habit-completions-all'],
    queryFn: async () => {
      if (!electron.isReady) return []
      const earliestHabitDate = habits.length > 0
        ? habits
            .map((habit) => format(parseISO(habit.created_at), 'yyyy-MM-dd'))
            .sort()[0]
        : format(new Date(), 'yyyy-MM-dd')
      const today = format(new Date(), 'yyyy-MM-dd')
      return database.getHabitCompletions(earliestHabitDate, today)
    },
    enabled: electron.isReady,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  const todayKey = format(new Date(), 'yyyy-MM-dd')

  const completionEventsForTask = (task: Task): number => {
    const history = task.daily_progress || {}

    if (task.duration_type === 'today') {
      const todayEntry = history[todayKey] as any
      if (todayEntry && (Number(todayEntry?.progress || 0) >= 100 || todayEntry?.status === 'completed')) {
        return 1
      }
      if (task.completed_at && format(parseISO(task.completed_at), 'yyyy-MM-dd') === todayKey) {
        return 1
      }
      return 0
    }

    const completionDays = new Set<string>()
    Object.entries(history).forEach(([dayKey, entry]: any) => {
      const progress = Number(entry?.progress || 0)
      const status = entry?.status
      if (progress >= 100 || status === 'completed') {
        completionDays.add(dayKey)
      }
    })

    if (task.completed_at && (task.status === 'completed' || task.progress === 100)) {
      completionDays.add(format(parseISO(task.completed_at), 'yyyy-MM-dd'))
    }

    return completionDays.size
  }

  const goalInsightsById = useMemo<Record<string, GoalInsights>>(() => {
    const completionDatesByHabit = new Map<string, string[]>()
    allHabitCompletions.forEach((completion) => {
      if (!completion.completed) return
      const arr = completionDatesByHabit.get(completion.habit_id) || []
      arr.push(completion.date)
      completionDatesByHabit.set(completion.habit_id, arr)
    })

    return goals.reduce((acc, goal) => {
      const linkedTasks = tasks.filter((task) => task.goal_id === goal.id && !task.deleted_at)
      const linkedHabits = habits.filter((habit) => habit.goal_id === goal.id && !habit.deleted_at)
      const isPausedGoal = goal.status === 'paused'

      const avgHabitConsistency = linkedHabits.length > 0
        ? Math.round(linkedHabits.reduce((sum, habit) => sum + (habit.consistency_score || 0), 0) / linkedHabits.length)
        : 0

      if (isPausedGoal) {
        acc[goal.id] = {
          linkedTasks,
          linkedHabitsCount: linkedHabits.length,
          completedTasksCount: 0,
          completionEvents: 0,
          avgHabitConsistency,
          activeDays: 0,
          activeDuration: '0 days',
          totalEffortMinutes: 0,
          totalEffortHours: 0,
          recentActivity: [],
          metadata: {
            createdAt: goal.created_at,
            updatedAt: goal.updated_at,
            startDate: goal.start_date || goal.created_at,
            targetDate: goal.target_date,
            completedAt: goal.completed_at,
            status: goal.status,
          },
        }
        return acc
      }

      const completionEvents = linkedTasks.reduce((sum, task) => sum + completionEventsForTask(task), 0)
      const completedTasksCount = linkedTasks.filter((task) => completionEventsForTask(task) > 0).length
      const totalEffortMinutes = linkedTasks.reduce((sum, task) => {
        const perCompletionMinutes = task.actual_time || task.estimated_time || 0
        return sum + perCompletionMinutes * completionEventsForTask(task)
      }, 0)

      const activityDays = new Set<string>()
      const recentActivity: GoalActivityItem[] = []

      linkedTasks.forEach((task) => {
        const history = task.daily_progress || {}
        Object.entries(history).forEach(([dayKey, entry]: any) => {
          if (task.duration_type === 'today' && dayKey !== todayKey) return
          const progress = Number(entry?.progress || 0)
          const status = entry?.status
          const recordedAt = entry?.recorded_at || `${dayKey}T00:00:00.000Z`
          if (progress > 0 || status === 'completed' || status === 'skipped') {
            activityDays.add(dayKey)
            recentActivity.push({
              date: recordedAt,
              action: `${task.title}: ${progress >= 100 || status === 'completed' ? 'Completed' : status === 'skipped' ? 'Skipped' : `Progress ${progress}%`}`,
            })
          }
        })

        if (task.completed_at && (task.status === 'completed' || task.progress === 100)) {
          if (task.duration_type === 'today' && format(parseISO(task.completed_at), 'yyyy-MM-dd') !== todayKey) {
            return
          }
          activityDays.add(format(parseISO(task.completed_at), 'yyyy-MM-dd'))
          recentActivity.push({ date: task.completed_at, action: `Completed task: ${task.title}` })
        }
      })

      linkedHabits.forEach((habit) => {
        const dates = completionDatesByHabit.get(habit.id) || []
        dates.forEach((dateKey) => {
          activityDays.add(dateKey)
          recentActivity.push({ date: `${dateKey}T00:00:00.000Z`, action: `Completed habit: ${habit.title}` })
        })
      })

      recentActivity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      let activeDuration = '0 days'
      if (activityDays.size > 0) {
        const sortedDays = Array.from(activityDays).sort()
        const firstDay = parseISO(sortedDays[0])
        const months = differenceInMonths(new Date(), firstDay)
        const days = differenceInDays(new Date(), firstDay) % 30
        activeDuration = months > 0
          ? `${months} month${months > 1 ? 's' : ''}${days > 0 ? `, ${days} days` : ''}`
          : `${Math.max(1, days)} day${days !== 1 ? 's' : ''}`
      }

      acc[goal.id] = {
        linkedTasks,
        linkedHabitsCount: linkedHabits.length,
        completedTasksCount,
        completionEvents,
        avgHabitConsistency,
        activeDays: activityDays.size,
        activeDuration,
        totalEffortMinutes,
        totalEffortHours: Math.round((totalEffortMinutes / 60) * 10) / 10,
        recentActivity: recentActivity.slice(0, 8),
        metadata: {
          createdAt: goal.created_at,
          updatedAt: goal.updated_at,
          startDate: goal.start_date || goal.created_at,
          targetDate: goal.target_date,
          completedAt: goal.completed_at,
          status: goal.status,
        },
      }
      return acc
    }, {} as Record<string, GoalInsights>)
  }, [allHabitCompletions, goals, habits, tasks, todayKey])

  const getGoalInsights = (goalId: string) => goalInsightsById[goalId] || null

  const selectedGoal = useMemo(
    () => goals.find((goal) => goal.id === detailsGoalId) || null,
    [detailsGoalId, goals]
  )

  const selectedGoalInsights = useMemo(
    () => (detailsGoalId ? getGoalInsights(detailsGoalId) : null),
    [detailsGoalId, goalInsightsById]
  )

  const formatEffort = (minutes: number): string => {
    if (minutes <= 0) return '0m'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`
    if (hours > 0) return `${hours}h`
    return `${mins}m`
  }

  // Calculate goal analytics using centralized function
  const goalAnalytics = useMemo(() => 
    calculateGoalAnalytics(goals, tasks, habits),
    [goals, tasks, habits]
  )

  const filteredGoals = useMemo(() => goals.filter((goal: Goal) => {
    const matchesSearch = searchQuery === '' || 
      goal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      goal.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (goal.tags || []).some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesCategory = selectedCategory === 'all' || goal.category === selectedCategory
    const matchesStatus = selectedStatus === 'all' || goal.status === selectedStatus
    const matchesPriority = selectedPriority === 'all' || goal.priority === selectedPriority
    
    return matchesSearch && matchesCategory && matchesStatus && matchesPriority
  }).sort((a, b) => {
    switch (sortBy) {
      case 'tasks':
        const aTaskCount = tasks.filter(t => t.goal_id === a.id && !t.deleted_at).length
        const bTaskCount = tasks.filter(t => t.goal_id === b.id && !t.deleted_at).length
        return bTaskCount - aTaskCount
      case 'priority':
        const priorityOrder: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4 }
        return (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4)
      case 'due_date':
        if (!a.target_date) return 1
        if (!b.target_date) return -1
        return new Date(a.target_date).getTime() - new Date(b.target_date).getTime()
      case 'updated':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      default:
        return 0
    }
  }), [goals, tasks, searchQuery, selectedCategory, selectedStatus, selectedPriority, sortBy])

  // Calculate statistics from centralized analytics
  const stats: GoalStats = useMemo(() => ({
    total: goalAnalytics.total,
    active: goalAnalytics.active,
    completed: goalAnalytics.completed,
    overdue: goalAnalytics.overdue,
  }), [goalAnalytics])

  // Create goal mutation
  const createGoalMutation = useMutation({
    mutationFn: async (goalData: CreateGoalDTO) => {
      const newGoalId = await database.createGoal(goalData)
      const newGoal = await database.getGoalById(newGoalId)
      return newGoal
    },
    onSuccess: (newGoal) => {
      if (newGoal) {
        addGoal(newGoal)
        success('Goal created successfully')
        setIsCreating(false)
        resetForm()
      } else {
        toastError('Failed to retrieve created goal.')
      }
    },
    onError: (error) => {
      console.error('Failed to create goal:', error)
      toastError('Failed to create goal')
    },
  })

  // Update goal mutation
  const updateGoalMutation = useMutation({
    mutationFn: async ({ id, updates, showToast = true }: { id: string; updates: UpdateGoalDTO; showToast?: boolean }) => {
      await database.updateGoal(id, updates)
      const updatedGoal = await database.getGoalById(id)
      return { updatedGoal, showToast }
    },
    onSuccess: ({ updatedGoal, showToast }) => {
        if(updatedGoal) {
            updateGoal(updatedGoal)
            if (showToast) {
              success('Goal updated successfully')
              setIsCreating(false)
              setIsEditing(null)
              resetForm()
            }
        } else {
            toastError('Failed to retrieve updated goal.')
        }
    },
    onError: (error) => {
      console.error('Failed to update goal:', error)
      toastError('Failed to update goal')
    },
  })

  // Update goal status mutation
  const updateGoalStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Goal['status'] }) => {
      const completed_at = status === 'completed' ? new Date().toISOString() : null
      await database.updateGoal(id, { status, completed_at })
      const updatedGoal = await database.getGoalById(id)
      return { updatedGoal, status }
    },
    onSuccess: ({ updatedGoal, status }) => {
      if (updatedGoal) {
        updateGoal(updatedGoal)
        if (status === 'completed') {
          success('Goal completed! 🎉 Congratulations!')
        } else if (status === 'paused') {
          success('Goal paused ⏸️')
        } else if (status === 'archived') {
          success('Goal archived 📦')
        } else if (status === 'active') {
          success('Goal reactivated! 🚀')
        }
      }
    },
    onError: (error) => {
      console.error('Failed to update goal status:', error)
      toastError('Failed to update goal status')
    },
  })

  // Archive goal mutation - preserves progress history
  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      await database.archiveGoal(id)
      return id
    },
    onSuccess: (id) => {
      archiveGoal(id)
      // Invalidate archive queries
      queryClient.invalidateQueries({ queryKey: ['archive'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      success('Goal archived. Progress history preserved.')
    },
    onError: (error) => {
      console.error('Failed to archive goal:', error)
      toastError('Failed to archive goal')
    },
  })

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'personal',
      priority: 'medium',
      target_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      motivation: '',
      tags: [],
    })
    setNewTag('')
  }

  useEffect(() => {
    const openCreateGoal = () => {
      setIsEditing(null)
      resetForm()
      setIsCreating(true)
    }

    window.addEventListener('app:new-goal', openCreateGoal as EventListener)
    return () => window.removeEventListener('app:new-goal', openCreateGoal as EventListener)
  }, [])

  const handleEdit = (goal: Goal) => {
    setIsEditing(goal.id)
    setIsCreating(true)
    setFormData({
      title: goal.title,
      description: goal.description || '',
      category: goal.category,
      priority: goal.priority,
      target_date: goal.target_date ? format(parseISO(goal.target_date), 'yyyy-MM-dd') : '',
      motivation: goal.motivation || '',
      tags: goal.tags || [],
    })
  }

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toastError('Please enter a goal title')
      return
    }

    if (isEditing) {
      updateGoalMutation.mutate({
        id: isEditing,
        updates: formData,
        showToast: true,
      })
    } else {
      createGoalMutation.mutate(formData)
    }
  }

  const handleStatusChange = (goalId: string, status: Goal['status']) => {
    updateGoalStatusMutation.mutate({ id: goalId, status })
  }

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to archive this goal? You can restore it later from the Archive.')) {
      deleteGoalMutation.mutate(id)
    }
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()],
      })
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove),
    })
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <h1 className="text-3xl font-bold">Goals</h1>
            <ContextTipsDialog
              title="Goals Section Tips"
              description="Guidance for goal progress logic, linked work impact, effort tracking, and sustainable long-term planning."
              sections={GOAL_TIPS_SECTIONS}
              triggerLabel="Open goal tips"
            />
          </div>
          <p className="text-muted-foreground">
            Define and track your long-term objectives
          </p>
        </div>
        <Dialog open={isCreating} onOpenChange={(open) => {
            setIsCreating(open);
            if (!open) {
                setIsEditing(null);
                resetForm();
            }
        }}>
          <DialogTrigger asChild>
            <Button className="transition-all duration-300 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg hover:bg-green-700">
              <Plus className="mr-2 h-4 w-4" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl bg-card">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>{isEditing ? 'Edit Goal' : 'Create New Goal'}</DialogTitle>
              <DialogDescription>
                Define what you want to achieve and why it matters.
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto pr-2 -mr-2 scroll-smooth">
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Goal Title</label>
                  <Input
                    placeholder="What do you want to achieve?"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="bg-secondary/50 border border-green-500/20 dark:border-green-500/15 focus-visible:ring-primary/50 dark:bg-secondary/30"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="Describe your goal in detail..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="bg-secondary/50 border border-green-500/20 dark:border-green-500/15 focus-visible:ring-primary/50 dark:bg-secondary/30"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Select
                      value={formData.category}
                      onValueChange={(value: Goal['category']) => 
                        setFormData({ ...formData, category: value })
                      }
                    >
                      <SelectTrigger className="bg-secondary/50 border border-green-500/20 dark:border-green-500/15 focus:ring-primary/50 dark:bg-secondary/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="career">Career</SelectItem>
                        <SelectItem value="health">Health</SelectItem>
                        <SelectItem value="learning">Learning</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="personal">Personal</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Priority</label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value: Goal['priority']) => 
                        setFormData({ ...formData, priority: value })
                      }
                    >
                      <SelectTrigger className="bg-secondary/50 border border-green-500/20 dark:border-green-500/15 focus:ring-primary/50 dark:bg-secondary/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target Date</label>
                  <Input
                    type="date"
                    value={formData.target_date}
                    onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                    className="bg-secondary/50 border border-green-500/20 dark:border-green-500/15 focus-visible:ring-primary/50 dark:bg-secondary/30"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Motivation</label>
                  <Textarea
                    placeholder="Why is this goal important to you?"
                    value={formData.motivation}
                    onChange={(e) => setFormData({ ...formData, motivation: e.target.value })}
                    rows={2}
                    className="bg-secondary/50 border border-green-500/20 dark:border-green-500/15 focus-visible:ring-primary/50 dark:bg-secondary/30"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Tags</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a tag..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addTag()}
                      className="bg-secondary/50 border border-green-500/20 dark:border-green-500/15 focus-visible:ring-primary/50 dark:bg-secondary/30"
                    />
                    <Button type="button" onClick={addTag}>
                      Add
                    </Button>
                  </div>
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <DialogFooter className="flex-shrink-0 border-t pt-4">
              <Button variant="outline" onClick={() => {
                setIsCreating(false)
                setIsEditing(null)
                resetForm()
              }} className="bg-transparent dark:bg-transparent border-green-500/30 text-green-600 dark:text-green-300 hover:bg-green-500/10 hover:border-green-500/50 transition-colors duration-200">
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={createGoalMutation.isPending || updateGoalMutation.isPending}
              >
                {isEditing ? 'Update Goal' : 'Create Goal'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Goals</CardTitle>
            <Target className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-500">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Goals in your system
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Goals</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.active}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently in progress
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.completed}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Successfully achieved
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Past target date
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Goals List */}
      <Tabs defaultValue="all">
        <TabsList className="bg-secondary/30 dark:bg-secondary/20">
          <TabsTrigger value="all">All Goals ({filteredGoals.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({filteredGoals.filter(g => g.status === 'active').length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({filteredGoals.filter(g => g.status === 'completed').length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-6">
          {filteredGoals.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No goals found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all' || selectedPriority !== 'all'
                    ? 'Try changing your filters or search query'
                    : 'Create your first goal to get started!'}
                </p>
                {!searchQuery && selectedCategory === 'all' && selectedStatus === 'all' && selectedPriority === 'all' && (
                  <Button onClick={() => setIsCreating(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Goal
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGoals.map((goal: Goal) => renderGoalCard(goal))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="active" className="mt-6">
          {filteredGoals.filter(g => g.status === 'active').length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No active goals</h3>
                <p className="text-muted-foreground mb-4">
                  Create a new goal or reactivate a completed one to see it here.
                </p>
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Goal
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGoals.filter(g => g.status === 'active').map((goal: Goal) => renderGoalCard(goal))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="completed" className="mt-6">
          {filteredGoals.filter(g => g.status === 'completed').length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No completed goals yet</h3>
                <p className="text-muted-foreground mb-4">
                  Keep working on your active goals. Completed goals will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGoals.filter(g => g.status === 'completed').map((goal: Goal) => renderGoalCard(goal))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!detailsGoalId} onOpenChange={(open) => !open && setDetailsGoalId(null)}>
        <DialogContent className="max-w-3xl bg-card">
          <DialogHeader>
            <DialogTitle>{selectedGoal?.title || 'Goal Details'}</DialogTitle>
            <DialogDescription>
              Complete goal information, linked tasks and habits, and activity history.
            </DialogDescription>
          </DialogHeader>

          {selectedGoal && selectedGoalInsights && (
            <div className="max-h-[70vh] overflow-y-auto pr-2 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg bg-secondary/50 dark:bg-zinc-900/60 p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-sm font-semibold capitalize">{selectedGoal.status}</p>
                </div>
                <div className="rounded-lg bg-secondary/50 dark:bg-zinc-900/60 p-3">
                  <p className="text-xs text-muted-foreground">Effort</p>
                  <p className="text-sm font-semibold">{formatEffort(selectedGoalInsights.totalEffortMinutes)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Description</p>
                <p className="text-sm text-muted-foreground">{selectedGoal.description || 'No description'}</p>
              </div>

              {selectedGoal.motivation && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Motivation</p>
                  <p className="text-sm text-muted-foreground italic">"{selectedGoal.motivation}"</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg bg-secondary/50 dark:bg-zinc-900/60 p-3">
                  <p className="text-xs text-muted-foreground">Linked Tasks</p>
                  <p className="text-sm font-semibold">
                    {selectedGoalInsights.completedTasksCount}/{selectedGoalInsights.linkedTasks.length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Completion events: {selectedGoalInsights.completionEvents}
                  </p>
                </div>
                <div className="rounded-lg bg-secondary/50 dark:bg-zinc-900/60 p-3">
                  <p className="text-xs text-muted-foreground">Linked Habits</p>
                  <p className="text-sm font-semibold">{selectedGoalInsights.linkedHabitsCount} habits</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Avg: {selectedGoalInsights.avgHabitConsistency}%
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg bg-secondary/50 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Task Details</p>
                  {selectedGoalInsights.linkedTasks.length > 0 ? (
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                      {selectedGoalInsights.linkedTasks.map((task) => (
                        <div key={task.id} className="flex items-center justify-between text-xs">
                          <span className="truncate pr-2 text-muted-foreground">{task.title}</span>
                          <span className="font-medium">{task.progress || 0}%</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No linked tasks</p>
                  )}
                </div>

                <div className="rounded-lg bg-secondary/50 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Habit Details</p>
                  {habits.filter((habit) => habit.goal_id === selectedGoal.id && !habit.deleted_at).length > 0 ? (
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                      {habits
                        .filter((habit) => habit.goal_id === selectedGoal.id && !habit.deleted_at)
                        .map((habit) => (
                          <div key={habit.id} className="flex items-center justify-between text-xs">
                            <span className="truncate pr-2 text-muted-foreground">{habit.title}</span>
                            <span className="font-medium">{habit.consistency_score || 0}%</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No linked habits</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg bg-secondary/50 dark:bg-zinc-900/60 p-3">
                  <p className="text-xs text-muted-foreground">Activity</p>
                  <p className="text-sm font-semibold">{selectedGoalInsights.activeDays} active days</p>
                  <p className="text-xs text-muted-foreground mt-1">Active for {selectedGoalInsights.activeDuration}</p>
                </div>
                <div className="rounded-lg bg-secondary/50 dark:bg-zinc-900/60 p-3">
                  <p className="text-xs text-muted-foreground">Metadata</p>
                  <p className="text-xs text-muted-foreground">Created: {format(parseISO(selectedGoalInsights.metadata.createdAt), 'MMM d, yyyy')}</p>
                  <p className="text-xs text-muted-foreground">Updated: {format(parseISO(selectedGoalInsights.metadata.updatedAt), 'MMM d, yyyy')}</p>
                  <p className="text-xs text-muted-foreground">Start: {format(parseISO(selectedGoalInsights.metadata.startDate), 'MMM d, yyyy')}</p>
                  {selectedGoalInsights.metadata.targetDate && (
                    <p className="text-xs text-muted-foreground">Target: {format(parseISO(selectedGoalInsights.metadata.targetDate), 'MMM d, yyyy')}</p>
                  )}
                  {selectedGoalInsights.metadata.completedAt && (
                    <p className="text-xs text-muted-foreground">Completed: {format(parseISO(selectedGoalInsights.metadata.completedAt), 'MMM d, yyyy')}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Recent Activity</p>
                {selectedGoalInsights.recentActivity.length > 0 ? (
                  <div className="space-y-1">
                    {selectedGoalInsights.recentActivity.map((activity, index) => (
                      <div key={`${activity.date}-${index}`} className="flex items-center justify-between rounded-md bg-secondary/40 dark:bg-zinc-900/55 px-3 py-2 text-xs">
                        <span className="text-muted-foreground truncate pr-3">{activity.action}</span>
                        <span className="text-muted-foreground whitespace-nowrap">{format(parseISO(activity.date), 'MMM d, yyyy')}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No tracked activity yet.</p>
                )}
              </div>

              {selectedGoal.tags && selectedGoal.tags.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedGoal.tags.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )

  // Helper function to render goal cards
  function renderGoalCard(goal: Goal) {
    const insights = getGoalInsights(goal.id)

    return (
      <Card key={goal.id} interactive className="transition-colors h-full flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="truncate">{goal.title}</CardTitle>
              <CardDescription className="truncate">
                {goal.description || 'No description'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white dark:bg-zinc-900">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDetailsGoalId(goal.id)}
                    className="cursor-pointer hover:bg-blue-500/10 focus:bg-blue-500/10"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleEdit(goal)}
                    className="cursor-pointer hover:bg-green-500/10 focus:bg-green-500/10"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>

                  {(goal.status === 'active' || goal.status === 'paused') && (
                    <DropdownMenuItem
                      onClick={() => handleStatusChange(goal.id, goal.status === 'active' ? 'paused' : 'active')}
                      className="cursor-pointer hover:bg-yellow-500/10 focus:bg-yellow-500/10"
                    >
                      {goal.status === 'active' ? 'Pause' : 'Resume'}
                    </DropdownMenuItem>
                  )}

                  {goal.status !== 'completed' && (
                    <DropdownMenuItem
                      onClick={() => handleStatusChange(goal.id, 'completed')}
                      className="cursor-pointer hover:bg-green-500/10 focus:bg-green-500/10"
                    >
                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                      Mark Complete
                    </DropdownMenuItem>
                  )}

                  {goal.status === 'completed' && (
                    <DropdownMenuItem
                      onClick={() => handleStatusChange(goal.id, 'active')}
                      className="cursor-pointer hover:bg-green-500/10 focus:bg-green-500/10"
                    >
                      <Target className="mr-2 h-4 w-4 text-blue-500" />
                      Reactivate
                    </DropdownMenuItem>
                  )}

                  {goal.status === 'archived' && (
                    <DropdownMenuItem
                      onClick={() => handleStatusChange(goal.id, 'active')}
                      className="cursor-pointer hover:bg-green-500/10 focus:bg-green-500/10"
                    >
                      <Target className="mr-2 h-4 w-4 text-blue-500" />
                      Restore
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem
                    onClick={() => handleDelete(goal.id)}
                    className="cursor-pointer hover:bg-gray-500/10 focus:bg-gray-500/10"
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {/* Badges Section - Styled consistently */}
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex justify-end">
              <Badge 
                variant="outline"
                className={cn(
                  "text-xs capitalize",
                  goal.status === 'completed' && "bg-green-500/10 text-green-500 border-green-500/30",
                  goal.status === 'active' && "bg-blue-500/10 text-blue-500 border-blue-500/30",
                  goal.status === 'paused' && "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
                  goal.status === 'archived' && "bg-gray-500/10 text-gray-500 border-gray-500/30"
                )}
              >
                {goal.status}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Priority: {goal.priority}</span>
              <span>Category: {goal.category}</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1">
          {insights && (
              <div className="space-y-4">
                {/* Task & Habit Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 dark:bg-zinc-900/55">
                    <ListTodo className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Tasks</p>
                      <p className="text-sm font-semibold">
                        {insights.completedTasksCount}/{insights.linkedTasks.length}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 dark:bg-zinc-900/55">
                    <Repeat className="h-4 w-4 text-purple-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Habits</p>
                      <p className="text-sm font-semibold">
                        {insights.linkedHabitsCount > 0
                          ? `${insights.avgHabitConsistency}%`
                          : 'None linked'}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Activity Summary */}
                <div className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 dark:bg-zinc-900/55">
                  <Activity className="h-4 w-4 text-green-500" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Active Days</p>
                    <p className="text-sm font-semibold">{insights.activeDays} days</p>
                  </div>
                  {insights.totalEffortMinutes > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Effort</p>
                      <p className="text-sm font-semibold">{formatEffort(insights.totalEffortMinutes)}</p>
                    </div>
                  )}
                </div>
                
                {/* Recent Activity Timeline */}
                {insights.recentActivity.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Recent Activity</p>
                    <div className="space-y-1">
                      {insights.recentActivity.slice(0, 3).map((activity, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          <span className="truncate flex-1">{activity.action}</span>
                          <span>{format(parseISO(activity.date), 'MMM d')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Motivation */}
                {goal.motivation && (
                  <div className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3">
                    "{goal.motivation}"
                  </div>
                )}
                
                {/* Tags */}
                {goal.tags && goal.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {goal.tags.slice(0, 3).map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {goal.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{goal.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
                
                {/* Dates */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center">
                    <Calendar className="mr-1 h-3 w-3" />
                    {goal.status === 'completed' && goal.completed_at ? (
                      <>
                        Completed: {format(parseISO(goal.completed_at), 'MMM d, yyyy')}
                      </>
                    ) : goal.target_date ? (
                      <>
                        Due: {format(parseISO(goal.target_date), 'MMM d, yyyy')}
                        {isBefore(parseISO(goal.target_date), new Date()) && goal.status === 'active' && (
                          <span className="ml-2 text-red-500 font-medium">(Overdue)</span>
                        )}
                      </>
                    ) : (
                      'No due date'
                    )}
                  </div>
                  <div>
                    Updated: {format(parseISO(goal.updated_at), 'MMM d')}
                  </div>
                </div>
              </div>
          )}
        </CardContent>
        
        <CardFooter className="bg-white dark:bg-zinc-900/70 mt-auto flex flex-col gap-3">
          {/* Action Buttons */}
          <div className="flex items-center justify-between w-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDetailsGoalId(goal.id)}
              className="cursor-pointer bg-secondary/40 hover:bg-secondary/70 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/70"
            >
              <Eye className="mr-2 h-4 w-4 text-blue-500" />
              View Details
            </Button>
            
            <div className="flex items-center gap-2">
              {goal.status === 'completed' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleStatusChange(goal.id, 'active')}
                  className="cursor-pointer bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border-transparent"
                >
                  <Target className="mr-2 h-4 w-4" />
                  Reactivate
                </Button>
              ) : goal.status === 'paused' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleStatusChange(goal.id, 'active')}
                  className="cursor-pointer bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border-transparent"
                >
                  Resume
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleStatusChange(goal.id, 'completed')}
                  className="cursor-pointer bg-green-500/15 hover:bg-green-500/25 text-green-500 border border-green-500/30 shadow-none"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark Complete
                </Button>
              )}
            </div>
          </div>
        </CardFooter>
      </Card>
    )
  }
}
