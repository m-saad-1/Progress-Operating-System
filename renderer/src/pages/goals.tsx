import { useState, useMemo } from 'react'
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
  Target, 
  Calendar,
  TrendingUp,
  Archive,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  PauseCircle,
  Clock,
  X
} from 'lucide-react'
import { format, parseISO, isBefore } from 'date-fns'
import { useToaster } from '@/hooks/use-toaster'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import { database, CreateGoalDTO, UpdateGoalDTO } from '@/lib/database'
import { Goal } from '@/types'

interface GoalFormData {
  title: string
  description: string
  category: Goal['category']
  priority: Goal['priority']
  target_date: string
  motivation: string
  review_frequency: Goal['review_frequency']
  progress_method: Goal['progress_method']
  tags: string[]
}

interface GoalStats {
  total: number;
  active: number;
  completed: number;
  overdue: number;
  averageProgress: number;
}

export default function Goals() {
  const { success, error: toastError } = useToaster()
  const { goals, addGoal, updateGoal, deleteGoal } = useStore()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<Goal['category'] | 'all'>('all')
  const [selectedStatus, setSelectedStatus] = useState<Goal['status'] | 'all'>('all')
  const [selectedPriority, setSelectedPriority] = useState<Goal['priority'] | 'all'>('all')
  const [sortBy, setSortBy] = useState<'progress' | 'priority' | 'due_date' | 'updated'>('priority')
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
      case 'progress':
        return b.progress - a.progress
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
  }), [goals, searchQuery, selectedCategory, selectedStatus, selectedPriority, sortBy])

  // Calculate statistics
  const stats: GoalStats = useMemo(() => ({
    total: goals.length,
    active: goals.filter(g => g.status === 'active').length,
    completed: goals.filter(g => g.status === 'completed').length,
    overdue: goals.filter(g => 
      g.status === 'active' && 
      g.target_date && 
      isBefore(parseISO(g.target_date), new Date())
    ).length,
    averageProgress: goals.length 
      ? Math.round(goals.reduce((sum: number, g: Goal) => sum + g.progress, 0) / goals.length)
      : 0,
  }), [goals])

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

  // Update progress mutation
  const updateProgressMutation = useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
        await database.updateGoal(id, { progress })
        const updatedGoal = await database.getGoalById(id)
        return { updatedGoal, progress }
    },
    onSuccess: ({ updatedGoal, progress }) => {
        if(updatedGoal) {
            updateGoal(updatedGoal)
            if (progress === 100) {
              success('Goal progress at 100%! 🎯')
            } else if (progress >= 75) {
              success('Almost there! Keep going! 💪')
            }
        }
    },
    onError: (error) => {
      console.error('Failed to update progress:', error)
      toastError('Failed to update progress')
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

  // Delete goal mutation
  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      await database.deleteGoal(id)
      return id
    },
    onSuccess: (id) => {
      deleteGoal(id)
      success('Goal moved to trash 🗑️')
    },
    onError: (error) => {
      console.error('Failed to delete goal:', error)
      toastError('Failed to delete goal')
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
    setFormData({
      title: goal.title,
      description: goal.description || '',
      category: goal.category,
      priority: goal.priority,
      target_date: goal.target_date ? format(parseISO(goal.target_date), 'yyyy-MM-dd') : '',
      motivation: goal.motivation || '',
      review_frequency: goal.review_frequency,
      progress_method: goal.progress_method,
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

  const handleProgressChange = (goalId: string, progress: number) => {
    updateProgressMutation.mutate({ id: goalId, progress })
  }

  const handleStatusChange = (goalId: string, status: Goal['status']) => {
    updateGoalStatusMutation.mutate({ id: goalId, status })
  }

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this goal?')) {
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
              <div className="space-y-6 py-4">
                {/* Basic Information Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Goal Title</label>
                      <Input
                        placeholder="What do you want to achieve?"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="bg-secondary/50 border-green-500/50 focus-visible:ring-primary/50"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        placeholder="Describe your goal in detail..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                        className="bg-secondary/50 border-green-500/50 focus-visible:ring-primary/50"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Details Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Details</h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Category</label>
                        <Select
                          value={formData.category}
                          onValueChange={(value: Goal['category']) => 
                            setFormData({ ...formData, category: value })
                          }
                        >
                          <SelectTrigger className="bg-secondary/50 border-green-500/50 focus:ring-primary/50">
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
                          <SelectTrigger className="bg-secondary/50 border-green-500/50 focus:ring-primary/50">
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
                        className="bg-secondary/50 border-green-500/50 focus-visible:ring-primary/50"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Motivation</label>
                      <Textarea
                        placeholder="Why is this goal important to you?"
                        value={formData.motivation}
                        onChange={(e) => setFormData({ ...formData, motivation: e.target.value })}
                        rows={2}
                        className="bg-secondary/50 border-green-500/50 focus-visible:ring-primary/50"
                      />
                    </div>
                  </div>
                </div>

                {/* Settings Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Settings</h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Review Frequency</label>
                        <Select
                          value={formData.review_frequency}
                          onValueChange={(value: Goal['review_frequency']) => 
                            setFormData({ ...formData, review_frequency: value })
                          }
                        >
                          <SelectTrigger className="bg-secondary/50 border-green-500/50 focus:ring-primary/50">
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
                          onValueChange={(value: Goal['progress_method']) => 
                            setFormData({ ...formData, progress_method: value })
                          }
                        >
                          <SelectTrigger className="bg-secondary/50 border-green-500/50 focus:ring-primary/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manual</SelectItem>
                            <SelectItem value="task-based">Task-based</SelectItem>
                            <SelectItem value="milestone-based">Milestone-based</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Organization Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Organization</h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tags</label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add a tag..."
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addTag()}
                          className="bg-secondary/50 border-green-500/50 focus-visible:ring-primary/50"
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
            <Progress value={stats.total > 0 ? (stats.active / stats.total) * 100 : 0} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {stats.active} active goals
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageProgress}%</div>
            <Progress value={stats.averageProgress} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              Across all goals
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% completion rate
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground">
              Goals past their target date
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
                placeholder="Search goals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-secondary/50 border border-green-500/50 focus-visible:ring-1 focus-visible:ring-primary/50"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as Goal['category'] | 'all')}>
                <SelectTrigger className="w-[140px] bg-secondary/50 border border-green-500/50 focus:ring-1 focus:ring-primary/50">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="career">Career</SelectItem>
                  <SelectItem value="health">Health</SelectItem>
                  <SelectItem value="learning">Learning</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as Goal['status'] | 'all')}>
                <SelectTrigger className="w-[140px] bg-secondary/50 border border-green-500/50 focus:ring-1 focus:ring-primary/50">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={selectedPriority} onValueChange={(value) => setSelectedPriority(value as Goal['priority'] | 'all')}>
                <SelectTrigger className="w-[140px] bg-secondary/50 border border-green-500/50 focus:ring-1 focus:ring-primary/50">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'progress' | 'priority' | 'due_date' | 'updated')}>
                <SelectTrigger className="w-[140px] bg-secondary/50 border border-green-500/50 focus:ring-1 focus:ring-primary/50">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="progress">Progress</SelectItem>
                  <SelectItem value="due_date">Due Date</SelectItem>
                  <SelectItem value="updated">Recently Updated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Goals List */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Goals ({filteredGoals.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({stats.active})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({stats.completed})</TabsTrigger>
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
              {filteredGoals.map((goal: Goal) => (
                <Card key={goal.id} className="card-hover">
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
                    <div className="space-y-4">
                      {/* Progress */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Progress</span>
                          <span className="text-sm font-bold">{goal.progress}%</span>
                        </div>
                        <Progress value={goal.progress} className={goal.progress === 100 ? '[&>div]:bg-green-500' : ''} />
                        {goal.progress_method === 'manual' && goal.status !== 'completed' ? (
                          <div className="flex gap-1">
                            {[0, 25, 50, 75, 100].map(value => (
                              <Button
                                key={value}
                                variant={goal.progress === value ? 'default' : 'outline'}
                                size="sm"
                                className={cn(
                                  "flex-1 h-6 cursor-pointer transition-all",
                                  goal.progress === value && "bg-green-500 hover:bg-green-600",
                                  goal.progress !== value && "hover:bg-green-500/10 hover:border-green-500"
                                )}
                                onClick={() => handleProgressChange(goal.id, value)}
                              >
                                {value}%
                              </Button>
                            ))}
                          </div>
                        ) : goal.status === 'completed' ? (
                          <p className="text-xs text-green-500 font-medium mt-1">
                            ✓ Goal completed!
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">
                            Progress updated via {goal.progress_method}
                          </p>
                        )}
                      </div>
                      
                      {/* Motivation */}
                      {goal.motivation && (
                        <div className="text-sm text-muted-foreground italic">
                          "{goal.motivation}"
                        </div>
                      )}
                      
                      {/* Tags */}
                      {goal.tags && goal.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {goal.tags.slice(0, 3).map((tag: string) => (
                            <Badge key={tag} variant="outline" size="sm">
                              {tag}
                            </Badge>
                          ))}
                          {goal.tags.length > 3 && (
                            <Badge variant="outline" size="sm">
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
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(goal.id, 'active')}
                            className="cursor-pointer hover:bg-blue-500/10 hover:border-blue-500"
                          >
                            <Target className="mr-2 h-4 w-4" />
                            Reactivate
                          </Button>
                        ) : goal.status === 'paused' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(goal.id, 'active')}
                            className="cursor-pointer hover:bg-green-500/10 hover:border-green-500"
                          >
                            Resume
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(goal.id, 'completed')}
                            className="cursor-pointer hover:bg-green-500/10 hover:border-green-500"
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Mark Complete
                          </Button>
                        )}
                      </div>
                    </div>
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
