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
  BarChart3,
  X
} from 'lucide-react'
import { format, parseISO, isBefore, isAfter } from 'date-fns'
import { useElectron } from '@/hooks/use-electron'
import { useToaster } from '@/hooks/use-toaster'
import { useUndoRedo } from '@/hooks/use-undo-redo'
import { cn } from '@/lib/utils'

interface Goal {
  id: string
  title: string
  description: string
  category: 'career' | 'health' | 'learning' | 'finance' | 'personal' | 'custom'
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'active' | 'paused' | 'completed' | 'archived'
  start_date: string
  target_date: string | null
  motivation: string
  review_frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  progress_method: 'manual' | 'task-based' | 'milestone-based'
  progress: number
  tags: string[]
  created_at: string
  updated_at: string
  version: number;
}

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
  const electron = useElectron()
  const { success, error: toastError } = useToaster()
  const queryClient = useQueryClient()
  const { executeCommand } = useUndoRedo()
  
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

  // Fetch goals
  const { data: goals, isLoading, error } = useQuery<Goal[]>({
    queryKey: ['goals'],
    queryFn: async () => {
      try {
        const goals = await electron.executeQuery<Goal[]>(`
          SELECT * FROM goals 
          WHERE deleted_at IS NULL
          ORDER BY 
            CASE priority
              WHEN 'critical' THEN 1
              WHEN 'high' THEN 2
              WHEN 'medium' THEN 3
              WHEN 'low' THEN 4
            END,
            updated_at DESC
        `)
        // Parse tags from JSON string to array
        return goals.map((goal: any) => ({
          ...goal,
          tags: JSON.parse((goal.tags as any) || '[]') as string[],
          progress: Number(goal.progress),
        })) || []
      } catch (error) {
        console.error('Failed to fetch goals:', error)
        throw error
      }
    },
    enabled: electron.isReady,
  })

  // Filter and sort goals
  const filteredGoals = goals?.filter((goal: Goal) => {
    const matchesSearch = searchQuery === '' || 
      goal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      goal.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      goal.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesCategory = selectedCategory === 'all' || goal.category === selectedCategory
    const matchesStatus = selectedStatus === 'all' || goal.status === selectedStatus
    const matchesPriority = selectedPriority === 'all' || goal.priority === selectedPriority
    
    return matchesSearch && matchesCategory && matchesStatus && matchesPriority
  }).sort((a, b) => {
    switch (sortBy) {
      case 'progress':
        return b.progress - a.progress
      case 'priority':
        const priorityOrder = { critical: 1, high: 2, medium: 3, low: 4 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      case 'due_date':
        if (!a.target_date) return 1
        if (!b.target_date) return -1
        return new Date(a.target_date).getTime() - new Date(b.target_date).getTime()
      case 'updated':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      default:
        return 0
    }
  })

  // Calculate statistics
  const stats: GoalStats = {
    total: goals?.length || 0,
    active: goals?.filter(g => g.status === 'active').length || 0,
    completed: goals?.filter(g => g.status === 'completed').length || 0,
    overdue: goals?.filter(g => 
      g.status === 'active' && 
      g.target_date && 
      isBefore(parseISO(g.target_date), new Date())
    ).length || 0,
    averageProgress: goals?.length 
      ? Math.round(goals.reduce((sum: number, g: Goal) => sum + g.progress, 0) / goals.length)
      : 0,
  }

  // Create goal mutation
  const createGoalMutation = useMutation({
    mutationFn: async (goalData: GoalFormData) => {
      const operations = [{
        query: `
          INSERT INTO goals (
            id, title, description, category, priority, status, 
            start_date, target_date, motivation, review_frequency, 
            progress_method, progress, tags, created_at, updated_at, version
          ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, 0, ?, ?, ?, 1)
        `,
        params: [
          crypto.randomUUID(),
          goalData.title,
          goalData.description,
          goalData.category,
          goalData.priority,
          new Date().toISOString(),
          goalData.target_date || null,
          goalData.motivation,
          goalData.review_frequency,
          goalData.progress_method,
          JSON.stringify(goalData.tags),
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      }]
      
      return await electron.executeTransaction(operations)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      success('Goal created successfully')
      setIsCreating(false)
      resetForm()
      
      // Register undo command
      executeCommand('create_goal', 'Create Goal', formData)
    },
    onError: (error) => {
      console.error('Failed to create goal:', error)
      toastError('Failed to create goal')
    },
  })

  // Update goal mutation
  const updateGoalMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Goal> }) => {
      const operations = [{
        query: `
          UPDATE goals 
          SET title = ?, description = ?, category = ?, priority = ?, status = ?,
              target_date = ?, motivation = ?, review_frequency = ?, 
              progress_method = ?, tags = ?, updated_at = ?, version = version + 1
          WHERE id = ?
        `,
        params: [
          updates.title,
          updates.description,
          updates.category,
          updates.priority,
          updates.status,
          updates.target_date,
          updates.motivation,
          updates.review_frequency,
          updates.progress_method,
          JSON.stringify(updates.tags),
          new Date().toISOString(),
          id,
        ]
      }]
      
      return await electron.executeTransaction(operations)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      success('Goal updated successfully')
      setIsEditing(null)
      resetForm()
    },
    onError: (error) => {
      console.error('Failed to update goal:', error)
      toastError('Failed to update goal')
    },
  })

  // Update progress mutation
  const updateProgressMutation = useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      const operations = [{
        query: `
          UPDATE goals 
          SET progress = ?, updated_at = ?, version = version + 1
          WHERE id = ?
        `,
        params: [progress, new Date().toISOString(), id]
      }]
      
      return await electron.executeTransaction(operations)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
    onError: (error) => {
      console.error('Failed to update progress:', error)
      toastError('Failed to update progress')
    },
  })

  // Delete goal mutation
  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      const operations = [{
        query: `
          UPDATE goals 
          SET deleted_at = ?, updated_at = ?, version = version + 1
          WHERE id = ?
        `,
        params: [new Date().toISOString(), new Date().toISOString(), id]
      }]
      
      return await electron.executeTransaction(operations)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      success('Goal moved to trash')
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
    setFormData({
      title: goal.title,
      description: goal.description,
      category: goal.category,
      priority: goal.priority,
      target_date: goal.target_date ? format(parseISO(goal.target_date), 'yyyy-MM-dd') : '',
      motivation: goal.motivation,
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
      })
    } else {
      createGoalMutation.mutate(formData)
    }
  }

  const handleProgressChange = (goalId: string, progress: number) => {
    updateProgressMutation.mutate({ id: goalId, progress })
  }

  const handleStatusChange = (goalId: string, status: Goal['status']) => {
    updateGoalMutation.mutate({
      id: goalId,
      updates: { status },
    })
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

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center">
              <X className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to load goals</h3>
              <p className="text-muted-foreground mb-4">
                There was an error loading your goals.
              </p>
              <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['goals'] })}>
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
          <h1 className="text-3xl font-bold">Goals</h1>
          <p className="text-muted-foreground">
            Define and track your long-term objectives
          </p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button className="transition-all duration-300 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg hover:bg-green-700">
              <Plus className="mr-2 h-4 w-4" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Goal' : 'Create New Goal'}</DialogTitle>
              <DialogDescription>
                Define what you want to achieve and why it matters.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Goal Title</label>
                <Input
                  placeholder="What do you want to achieve?"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Describe your goal in detail..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
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
                    <SelectTrigger>
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
                    <SelectTrigger>
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
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Motivation</label>
                <Textarea
                  placeholder="Why is this goal important to you?"
                  value={formData.motivation}
                  onChange={(e) => setFormData({ ...formData, motivation: e.target.value })}
                  rows={2}
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
                    <SelectTrigger>
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
                    <SelectTrigger>
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
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Tags</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTag()}
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
            <Progress value={(stats.active / stats.total) * 100} className="mt-2" />
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
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as Goal['category'] | 'all')}>
                <SelectTrigger className="w-[140px]">
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
                <SelectTrigger className="w-[140px]">
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
                <SelectTrigger className="w-[140px]">
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
                <SelectTrigger className="w-[140px]">
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
          <TabsTrigger value="all">All Goals ({filteredGoals?.length || 0})</TabsTrigger>
          <TabsTrigger value="active">Active ({stats.active})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({stats.completed})</TabsTrigger>
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
          ) : filteredGoals?.length === 0 ? (
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
              {filteredGoals?.map((goal: Goal) => (
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
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleEdit(goal)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(goal.id, 'completed')}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Mark Complete
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(goal.id, 'paused')}>
                            <PauseCircle className="mr-2 h-4 w-4" />
                            Pause
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(goal.id, 'archived')}>
                            <Archive className="mr-2 h-4 w-4" />
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => deleteGoalMutation.mutate(goal.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={goal.category as any}>
                        {goal.category}
                      </Badge>
                      <Badge variant={goal.priority as any}>
                        {goal.priority}
                      </Badge>
                      <Badge variant={
                        goal.status === 'active' ? 'success' :
                        goal.status === 'completed' ? 'default' :
                        goal.status === 'paused' ? 'warning' : 'secondary'
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
                        <Progress value={goal.progress} />
                        <div className="flex gap-1">
                          {[0, 25, 50, 75, 100].map(value => (
                            <Button
                              key={value}
                              variant="outline"
                              size="sm"
                              className="flex-1 h-6"
                              onClick={() => handleProgressChange(goal.id, value)}
                            >
                              {value}%
                            </Button>
                          ))}
                        </div>
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
                        onClick={() => {
                          // Navigate to goal detail view
                          console.log('View goal details:', goal.id)
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </Button>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(goal.id, 'completed')}
                          disabled={goal.status === 'completed'}
                        >
                          {goal.status === 'completed' ? 'Completed' : 'Mark Complete'}
                        </Button>
                      </div>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="active" className="mt-6">
          {/* Similar content but filtered for active goals */}
        </TabsContent>
        
        <TabsContent value="completed" className="mt-6">
          {/* Similar content but filtered for completed goals */}
        </TabsContent>
      </Tabs>
    </div>
  )
}