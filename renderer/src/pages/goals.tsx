import { useState, useMemo, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { Progress } from '@/components/ui/progress'
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
  Trash2,
  Eye,
  CheckCircle,
  PauseCircle,
  X,
  ListTodo,
  Repeat,
  Activity,
  AlertCircle
} from 'lucide-react'
import { format, parseISO, isBefore, differenceInMonths, differenceInDays } from 'date-fns'
import { useToaster } from '@/hooks/use-toaster'
import { useStore } from '@/store'
import { database, CreateGoalDTO, UpdateGoalDTO } from '@/lib/database'
import { Goal } from '@/types'
import { 
  calculateGoalProgress, 
  calculateGoalAnalytics
} from '@/lib/progress'

interface GoalFormData {
  title: string
  description: string
  category: Goal['category']
  priority: Goal['priority']
  target_date: string
  motivation: string
  review_frequency: Goal['review_frequency']
  progress_method: 'manual' | 'task-based'
  tags: string[]
}

interface GoalStats {
  total: number;
  active: number;
  completed: number;
  overdue: number;
}

export default function Goals() {
  const queryClient = useQueryClient()
  const { success, error: toastError } = useToaster()
  const { goals, tasks, habits, addGoal, updateGoal, archiveGoal } = useStore()
  
  const [searchQuery] = useState('')
  const [selectedCategory] = useState<Goal['category'] | 'all'>('all')
  const [selectedStatus] = useState<Goal['status'] | 'all'>('all')
  const [selectedPriority] = useState<Goal['priority'] | 'all'>('all')
  const [sortBy] = useState<'priority' | 'due_date' | 'updated' | 'tasks'>('priority')
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [formData, setFormData] = useState<GoalFormData>({
    title: '',
    description: '',
    category: 'personal',
    priority: 'medium',
    target_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    motivation: '',
    review_frequency: 'weekly',
    progress_method: 'manual',
    tags: [],
  })
  const [newTag, setNewTag] = useState('')

  // Helper function to get goal insights using centralized calculation
  const getGoalInsights = (goalId: string) => {
    const goal = goals.find(g => g.id === goalId)
    if (!goal) return null
    
    const goalWithProgress = calculateGoalProgress(goal, tasks, habits)
    
    // Calculate active duration
    let activeDuration = ''
    const startDate = parseISO(goal.start_date || goal.created_at)
    const months = differenceInMonths(new Date(), startDate)
    const days = differenceInDays(new Date(), startDate) % 30
    if (months > 0) {
      activeDuration = `${months} month${months > 1 ? 's' : ''}${days > 0 ? `, ${days} days` : ''}`
    } else {
      activeDuration = `${Math.max(1, days)} day${days !== 1 ? 's' : ''}`
    }
    
    // Calculate total effort (task time + habit streaks)
    const linkedTasks = tasks.filter(t => t.goal_id === goalId && !t.deleted_at)
    const completedTasks = linkedTasks.filter(t => t.status === 'completed')
    const linkedHabits = habits.filter(h => h.goal_id === goalId && !h.deleted_at)
    const taskEffort = completedTasks.reduce((sum, t) => sum + (t.actual_time || t.estimated_time || 1), 0)
    const habitEffort = linkedHabits.reduce((sum, h) => sum + h.streak_current, 0)
    const totalEffort = Math.round((taskEffort + habitEffort) / 60) // Convert to hours
    
    // Get recent activity
    const recentActivity: { date: string; action: string }[] = []
    linkedTasks.slice(0, 3).forEach(t => {
      if (t.completed_at) {
        recentActivity.push({ date: t.completed_at, action: `Completed: ${t.title}` })
      } else if (t.updated_at) {
        recentActivity.push({ date: t.updated_at, action: `Updated: ${t.title}` })
      }
    })
    recentActivity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    
    return {
      ...goalWithProgress,
      activeDuration,
      totalEffort,
      recentActivity: recentActivity.slice(0, 3),
    }
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

  // Auto-convert manual goals to task-based when a task is linked
  useEffect(() => {
    goals.forEach((goal) => {
      if (goal.progress_method === 'manual') {
        const linkedTasksCount = tasks.filter(t => t.goal_id === goal.id && !t.deleted_at).length
        if (linkedTasksCount > 0) {
          // Auto-convert to task-based
          updateGoalMutation.mutate({
            id: goal.id,
            updates: { progress_method: 'task-based' },
            showToast: false,
          })
        }
      }
    })
  }, [tasks, goals])

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
            }
            setIsEditing(null)
            resetForm()
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
      await database.updateGoal(id, { status })
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
      review_frequency: 'weekly',
      progress_method: 'manual',
      tags: [],
    })
    setNewTag('')
  }

  const handleEdit = (goal: Goal) => {
    setIsEditing(goal.id)
    setIsCreating(true)
    // Handle legacy milestone-based goals by converting to task-based
    const progressMethod = goal.progress_method === 'milestone-based' ? 'task-based' : goal.progress_method
    setFormData({
      title: goal.title,
      description: goal.description || '',
      category: goal.category,
      priority: goal.priority,
      target_date: goal.target_date ? format(parseISO(goal.target_date), 'yyyy-MM-dd') : '',
      motivation: goal.motivation || '',
      review_frequency: goal.review_frequency,
      progress_method: progressMethod as 'manual' | 'task-based',
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
          <h1 className="text-3xl font-bold">Goals</h1>
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
                        <SelectItem value="critical">Critical</SelectItem>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Review Frequency</label>
                    <Select
                      value={formData.review_frequency}
                      onValueChange={(value: Goal['review_frequency']) => 
                        setFormData({ ...formData, review_frequency: value })
                      }
                    >
                      <SelectTrigger className="bg-secondary/50 border border-green-500/20 dark:border-green-500/15 focus:ring-primary/50 dark:bg-secondary/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                      
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Progress Method</label>
                    <Select
                      value={formData.progress_method}
                      onValueChange={(value: 'manual' | 'task-based') => 
                        setFormData({ ...formData, progress_method: value })
                      }
                    >
                      <SelectTrigger className="bg-secondary/50 border border-green-500/20 dark:border-green-500/15 focus:ring-primary/50 dark:bg-secondary/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="task-based">Task-based</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Manual goals auto-convert to Task-based when tasks are linked
                    </p>
                  </div>
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
              }}>
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
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
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
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Past target date
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Goals List */}
      <Tabs defaultValue="all">
        <TabsList>
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
    </div>
  )

  // Helper function to render goal cards
  function renderGoalCard(goal: Goal) {
    return (
      <Card key={goal.id} interactive className="transition-colors">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="truncate">{goal.title}</CardTitle>
              <CardDescription className="truncate">
                {goal.description || 'No description'}
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => handleEdit(goal)}
                  className="cursor-pointer hover:bg-green-500/10 focus:bg-green-500/10"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                
                {/* Status Actions - Show based on current status */}
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
                
                {goal.status !== 'paused' && goal.status !== 'completed' && (
                  <DropdownMenuItem 
                    onClick={() => handleStatusChange(goal.id, 'paused')}
                    className="cursor-pointer hover:bg-yellow-500/10 focus:bg-yellow-500/10"
                  >
                    <PauseCircle className="mr-2 h-4 w-4 text-yellow-500" />
                    Pause
                  </DropdownMenuItem>
                )}
                
                {goal.status === 'paused' && (
                  <DropdownMenuItem 
                    onClick={() => handleStatusChange(goal.id, 'active')}
                    className="cursor-pointer hover:bg-green-500/10 focus:bg-green-500/10"
                  >
                    <Target className="mr-2 h-4 w-4 text-blue-500" />
                    Resume
                  </DropdownMenuItem>
                )}
                
                {goal.status !== 'archived' && (
                  <DropdownMenuItem 
                    onClick={() => handleStatusChange(goal.id, 'archived')}
                    className="cursor-pointer hover:bg-gray-500/10 focus:bg-gray-500/10"
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
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
                
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="cursor-pointer text-destructive hover:text-destructive hover:bg-red-500/10 focus:bg-red-500/10"
                  onClick={() => handleDelete(goal.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={goal.category === 'career' ? 'default' : 'secondary'}>
              {goal.category}
            </Badge>
            <Badge variant={
              goal.priority === 'critical' ? 'destructive' : 
              goal.priority === 'high' ? 'default' : 
              'secondary'
            }>
              {goal.priority}
            </Badge>
            <Badge variant={
              goal.status === 'completed' ? 'default' : 
              goal.status === 'paused' ? 'outline' : 
              goal.status === 'archived' ? 'secondary' :
              'default'
            } className={
              goal.status === 'completed' ? 'bg-green-500/20 text-green-500' : 
              goal.status === 'active' ? 'bg-blue-500/20 text-blue-500' : 
              ''
            }>
              {goal.status}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent>
          {(() => {
            const insights = getGoalInsights(goal.id)
            if (!insights) return null
            
            return (
              <div className="space-y-4">
                {/* Progress Bar - Using Calculated Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-bold text-green-500">{insights.calculatedProgress}%</span>
                  </div>
                  <Progress value={insights.calculatedProgress} className="h-2" />
                </div>
                
                {/* Task & Habit Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-2 rounded-md bg-secondary/50">
                    <ListTodo className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Tasks</p>
                      <p className="text-sm font-semibold">
                        {insights.completedTasksCount}/{insights.linkedTasksCount} completed
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-md bg-secondary/50">
                    <Repeat className="h-4 w-4 text-purple-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Habits</p>
                      <p className="text-sm font-semibold">
                        {insights.linkedHabitsCount > 0 
                          ? `${insights.avgHabitConsistency}% consistency`
                          : 'None linked'}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Activity Summary */}
                <div className="flex items-center gap-2 p-2 rounded-md bg-secondary/50">
                  <Activity className="h-4 w-4 text-green-500" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Active for</p>
                    <p className="text-sm font-semibold">{insights.activeDuration}</p>
                  </div>
                  {insights.totalEffort > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Effort</p>
                      <p className="text-sm font-semibold">{insights.totalEffort}h invested</p>
                    </div>
                  )}
                </div>
                
                {/* Recent Activity Timeline */}
                {insights.recentActivity.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Recent Activity</p>
                    <div className="space-y-1">
                      {insights.recentActivity.map((activity, idx) => (
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
                    {goal.target_date ? (
                      <>
                        Due: {format(parseISO(goal.target_date), 'MMM d, yyyy')}
                        {isBefore(parseISO(goal.target_date), new Date()) && goal.status === 'active' && (
                          <span className="ml-2 text-destructive">(Overdue)</span>
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
            )
          })()}
        </CardContent>
        
        <CardFooter>
          <div className="flex items-center justify-between w-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(goal)}
              className="cursor-pointer hover:bg-green-500/10"
            >
              <Eye className="mr-2 h-4 w-4" />
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
