import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
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
  CheckSquare,
  Calendar,
  Clock,
  AlertCircle,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  X,
  ListTodo,
  CalendarDays,
  Target,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { format, parseISO, isBefore, isToday, isTomorrow } from 'date-fns'
import { useElectron } from '@/hooks/use-electron'
import { useToaster } from '@/hooks/use-toaster'
import { useUndoRedo } from '@/hooks/use-undo-redo'
import { cn } from '@/lib/utils'

interface Task {
  id: string
  title: string
  description: string
  due_date: string | null
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'in-progress' | 'blocked' | 'completed'
  progress: number
  estimated_time: number | null
  actual_time: number | null
  recurrence_rule: string | null
  project_id: string | null
  goal_id: string | null
  parent_task_id: string | null
  tags: string[]
  created_at: string
  updated_at: string
  completed_at: string | null
}

interface TaskWithDetails extends Task {
  goal_title?: string
  completed_checklist_items: number
  total_checklist_items: number
}

interface TaskFormData {
  title: string
  description: string
  due_date: string
  priority: Task['priority']
  status: Task['status']
  estimated_time: string
  goal_id: string
  tags: string[]
}

export default function Tasks() {
  const electron = useElectron()
  const { success, error: toastError } = useToaster()
  const queryClient = useQueryClient()
  const { executeCommand } = useUndoRedo()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPriority, setSelectedPriority] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedGoal, setSelectedGoal] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'due_date' | 'priority' | 'created' | 'updated'>('due_date')
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    due_date: format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    priority: 'medium',
    status: 'pending',
    estimated_time: '',
    goal_id: '',
    tags: [],
  })
  const [newTag, setNewTag] = useState('')
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [showCompleted, setShowCompleted] = useState(false)

  // Fetch tasks
  const { data: tasks, isLoading, error } = useQuery<TaskWithDetails[]>({
    queryKey: ['tasks'],
    queryFn: async () => {
      try {
        const tasks = await electron.executeQuery(`
          SELECT t.*, 
                 g.title as goal_title,
                 (SELECT COUNT(*) FROM checklist_items 
                  WHERE task_id = t.id AND completed = 1) as completed_checklist_items,
                 (SELECT COUNT(*) FROM checklist_items 
                  WHERE task_id = t.id) as total_checklist_items
          FROM tasks t
          LEFT JOIN goals g ON t.goal_id = g.id
          WHERE t.deleted_at IS NULL
          ORDER BY 
            CASE priority
              WHEN 'critical' THEN 1
              WHEN 'high' THEN 2
              WHEN 'medium' THEN 3
              WHEN 'low' THEN 4
            END,
            CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
            due_date ASC
        `)
        return Array.isArray(tasks) ? tasks : []
      } catch (error) {
        console.error('Failed to fetch tasks:', error)
        throw error
      }
    },
    enabled: electron.isReady,
  })

  // Fetch goals for dropdown
  const { data: goals } = useQuery({
    queryKey: ['goals-for-tasks'],
    queryFn: async () => {
      try {
        const goals = await electron.executeQuery(`
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

  const safeTasks = Array.isArray(tasks) ? tasks : []

  // Filter and sort tasks
  const filteredTasks = safeTasks.filter(task => {
    const matchesSearch = searchQuery === '' || 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesPriority = selectedPriority === 'all' || task.priority === selectedPriority
    const matchesStatus = selectedStatus === 'all' || task.status === selectedStatus
    const matchesGoal = selectedGoal === 'all' || 
      (selectedGoal === 'none' && !task.goal_id) ||
      task.goal_id === selectedGoal
    const matchesCompleted = showCompleted || task.status !== 'completed'
    
    return matchesSearch && matchesPriority && matchesStatus && matchesGoal && matchesCompleted
  }).sort((a, b) => {
    switch (sortBy) {
      case 'due_date':
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      case 'priority':
        const priorityOrder = { critical: 1, high: 2, medium: 3, low: 4 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      case 'created':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'updated':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      default:
        return 0
    }
  })

  // Group tasks by date
  const today = new Date()
  const tasksByDate = filteredTasks?.reduce((groups: any, task: TaskWithDetails) => {
    let group = 'Later'
    
    if (task.due_date) {
      const dueDate = parseISO(task.due_date)
      if (isToday(dueDate)) {
        group = 'Today'
      } else if (isTomorrow(dueDate)) {
        group = 'Tomorrow'
      } else if (isBefore(dueDate, today)) {
        group = 'Overdue'
      } else if (dueDate.getTime() - today.getTime() <= 7 * 24 * 60 * 60 * 1000) {
        group = 'This Week'
      }
    } else {
      group = 'No Date'
    }
    
    if (!groups[group]) groups[group] = []
    groups[group].push(task)
    return groups
  }, {})

  // Calculate statistics
  const stats = {
    total: safeTasks.length || 0,
    completed: safeTasks.filter(t => t.status === 'completed').length || 0,
    inProgress: safeTasks.filter(t => t.status === 'in-progress').length || 0,
    overdue: safeTasks.filter(t => 
      t.due_date && 
      isBefore(parseISO(t.due_date), today) && 
      t.status !== 'completed'
    ).length || 0,
    critical: safeTasks.filter(t => t.priority === 'critical' && t.status !== 'completed').length || 0,
    totalEstimated: safeTasks.reduce((sum: number, t: Task) => sum + (t.estimated_time || 0), 0) || 0,
    totalActual: safeTasks.reduce((sum: number, t: Task) => sum + (t.actual_time || 0), 0) || 0,
  }

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: TaskFormData) => {
      const operations = [{
        query: `
          INSERT INTO tasks (
            id, title, description, due_date, priority, status, progress,
            estimated_time, actual_time, goal_id, tags, created_at, updated_at, version
          ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, NULL, ?, ?, ?, ?, 1)
        `,
        params: [
          crypto.randomUUID(),
          taskData.title,
          taskData.description,
          taskData.due_date || null,
          taskData.priority,
          taskData.status,
          taskData.estimated_time ? parseInt(taskData.estimated_time) : null,
          taskData.goal_id || null,
          JSON.stringify(taskData.tags),
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      }]
      
      return await electron.executeTransaction(operations)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      success('Task created successfully')
      setIsCreating(false)
      resetForm()
      
      // Register undo command
      executeCommand('create_task', 'Create Task', formData)
    },
    onError: (error) => {
      console.error('Failed to create task:', error)
      toastError('Failed to create task')
    },
  })

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      const operations = [{
        query: `
          UPDATE tasks 
          SET title = ?, description = ?, due_date = ?, priority = ?, status = ?,
              estimated_time = ?, goal_id = ?, tags = ?, updated_at = ?, version = version + 1
          WHERE id = ?
        `,
        params: [
          updates.title,
          updates.description,
          updates.due_date,
          updates.priority,
          updates.status,
          updates.estimated_time,
          updates.goal_id,
          JSON.stringify(updates.tags),
          new Date().toISOString(),
          id,
        ]
      }]
      
      return await electron.executeTransaction(operations)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      success('Task updated successfully')
      setIsEditing(null)
      resetForm()
    },
    onError: (error) => {
      console.error('Failed to update task:', error)
      toastError('Failed to update task')
    },
  })

  // Update task status mutation
  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ id, status, completed }: { id: string; status: Task['status']; completed?: boolean }) => {
      const operations = [{
        query: `
          UPDATE tasks 
          SET status = ?, 
              completed_at = ?,
              progress = ?,
              updated_at = ?,
              version = version + 1
          WHERE id = ?
        `,
        params: [
          status,
          status === 'completed' ? new Date().toISOString() : null,
          status === 'completed' ? 100 : 0,
          new Date().toISOString(),
          id,
        ]
      }]
      
      return await electron.executeTransaction(operations)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (error) => {
      console.error('Failed to update task status:', error)
      toastError('Failed to update task status')
    },
  })

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const operations = [{
        query: `
          UPDATE tasks 
          SET deleted_at = ?, updated_at = ?, version = version + 1
          WHERE id = ?
        `,
        params: [new Date().toISOString(), new Date().toISOString(), id]
      }]
      
      return await electron.executeTransaction(operations)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      success('Task moved to trash')
    },
    onError: (error) => {
      console.error('Failed to delete task:', error)
      toastError('Failed to delete task')
    },
  })

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      due_date: format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      priority: 'medium',
      status: 'pending',
      estimated_time: '',
      goal_id: '',
      tags: [],
    })
    setNewTag('')
  }

  const handleEdit = (task: Task) => {
    setIsEditing(task.id)
    setFormData({
      title: task.title,
      description: task.description || '',
      due_date: task.due_date ? format(parseISO(task.due_date), 'yyyy-MM-dd') : '',
      priority: task.priority,
      status: task.status,
      estimated_time: task.estimated_time?.toString() || '',
      goal_id: task.goal_id || '',
      tags: task.tags || [],
    })
  }

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toastError('Please enter a task title')
      return
    }

    if (isEditing) {
      updateTaskMutation.mutate({
        id: isEditing,
        updates: {
          ...formData,
          estimated_time: formData.estimated_time ? parseInt(formData.estimated_time) : null,
          goal_id: formData.goal_id || null,
          due_date: formData.due_date || null,
        },
      })
    } else {
      createTaskMutation.mutate(formData)
    }
  }

  const handleStatusChange = (taskId: string, status: Task['status']) => {
    updateTaskStatusMutation.mutate({ id: taskId, status })
  }

  const toggleTaskExpanded = (taskId: string) => {
    const newExpanded = new Set(expandedTasks)
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId)
    } else {
      newExpanded.add(taskId)
    }
    setExpandedTasks(newExpanded)
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
              <h3 className="text-lg font-semibold mb-2">Failed to load tasks</h3>
              <p className="text-muted-foreground mb-4">
                There was an error loading your tasks.
              </p>
              <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['tasks'] })}>
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
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">
            Manage and track your daily work
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            onClick={() => setViewMode('list')}
            size="sm"
          >
            <ListTodo className="mr-2 h-4 w-4" />
            List
          </Button>
          <Button
            variant={viewMode === 'board' ? 'default' : 'outline'}
            onClick={() => setViewMode('board')}
            size="sm"
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            Board
          </Button>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button className="transition-all duration-300 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg hover:bg-green-700">
                <Plus className="mr-2 h-4 w-4" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-card">
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Edit Task' : 'Create New Task'}</DialogTitle>
                <DialogDescription>
                  Add a new task to your todo list.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Task Title</label>
                  <Input
                    placeholder="What needs to be done?"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="Add details, notes, or context..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Due Date</label>
                    <Input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Priority</label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value: Task['priority']) => 
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
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: Task['status']) => 
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Estimated Time (minutes)</label>
                    <Input
                      type="number"
                      placeholder="e.g., 30"
                      value={formData.estimated_time}
                      onChange={(e) => setFormData({ ...formData, estimated_time: e.target.value })}
                    />
                  </div>
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
                      {goals?.map((goal: any) => (
                        <SelectItem key={goal.id} value={goal.id}>
                          {goal.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  disabled={createTaskMutation.isPending || updateTaskMutation.isPending}
                >
                  {isEditing ? 'Update Task' : 'Create Task'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completed} completed ({stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%)
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
            <Progress value={(stats.inProgress / stats.total) * 100} className="mt-2" />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground">
              {stats.critical} critical priority
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time Tracked</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.totalActual / 60)}h</div>
            <p className="text-xs text-muted-foreground">
              {Math.round(stats.totalEstimated / 60)}h estimated
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
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Select value={selectedPriority} onValueChange={setSelectedPriority}>
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
              
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={selectedGoal} onValueChange={setSelectedGoal}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Goals</SelectItem>
                  <SelectItem value="none">No Goal</SelectItem>
                  {goals?.map((goal: any) => (
                    <SelectItem key={goal.id} value={goal.id}>
                      {goal.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'due_date' | 'priority' | 'created' | 'updated')}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="due_date">Due Date</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="created">Recently Created</SelectItem>
                  <SelectItem value="updated">Recently Updated</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex items-center gap-2">
                <Checkbox
                  id="show-completed"
                  checked={showCompleted}
                  onCheckedChange={(checked) => setShowCompleted(checked === true)}
                />
                <label htmlFor="show-completed" className="text-sm">
                  Show Completed
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List View */}
      {viewMode === 'list' ? (
        <div className="space-y-6">
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
          ) : filteredTasks?.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <CheckSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No tasks found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || selectedPriority !== 'all' || selectedStatus !== 'all' || selectedGoal !== 'all'
                    ? 'Try changing your filters or search query'
                    : 'Create your first task to get started!'}
                </p>
                {!searchQuery && selectedPriority === 'all' && selectedStatus === 'all' && selectedGoal === 'all' && (
                  <Button onClick={() => setIsCreating(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Task
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            Object.entries(tasksByDate || {}).map(([group, groupTasks]: [string, any]) => (
              <div key={group} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    {group} ({groupTasks.length})
                  </h2>
                  {group === 'Overdue' && groupTasks.length > 0 && (
                    <Badge variant="destructive">Attention Needed</Badge>
                  )}
                </div>
                
                <div className="space-y-2">
                  {groupTasks.map((task: TaskWithDetails) => (
                    <Card key={task.id} className="card-hover">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            <Checkbox
                              checked={task.status === 'completed'}
                              onCheckedChange={(checked) => {
                                handleStatusChange(
                                  task.id, 
                                  checked ? 'completed' : 'pending'
                                )
                              }}
                            />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleTaskExpanded(task.id)}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  {expandedTasks.has(task.id) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                                <h3 className={cn(
                                  "font-medium",
                                  task.status === 'completed' && "line-through text-muted-foreground"
                                )}>
                                  {task.title}
                                </h3>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Badge variant={task.priority as any}>
                                  {task.priority}
                                </Badge>
                                <Badge variant={
                                  task.status === 'completed' ? 'success' :
                                  task.status === 'in-progress' ? 'default' :
                                  task.status === 'blocked' ? 'destructive' : 'secondary'
                                }>
                                  {task.status}
                                </Badge>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleEdit(task)}>
                                      <Edit className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'completed')}>
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                      Mark Complete
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'in-progress')}>
                                      <Clock className="mr-2 h-4 w-4" />
                                      Start Progress
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'blocked')}>
                                      <AlertCircle className="mr-2 h-4 w-4" />
                                      Mark Blocked
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      className="text-destructive"
                                      onClick={() => deleteTaskMutation.mutate(task.id)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                            
                            {expandedTasks.has(task.id) && (
                              <div className="ml-6 mt-3 space-y-3">
                                {task.description && (
                                  <p className="text-sm text-muted-foreground">
                                    {task.description}
                                  </p>
                                )}
                                
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  {task.due_date && (
                                    <div className="flex items-center">
                                      <Calendar className="mr-1 h-3 w-3" />
                                      Due: {format(parseISO(task.due_date), 'MMM d, yyyy')}
                                    </div>
                                  )}
                                  
                                  {task.estimated_time && (
                                    <div className="flex items-center">
                                      <Clock className="mr-1 h-3 w-3" />
                                      Est: {task.estimated_time}min
                                    </div>
                                  )}
                                  
                                  {task.goal_title && (
                                    <div className="flex items-center">
                                      <Target className="mr-1 h-3 w-3" />
                                      {task.goal_title}
                                    </div>
                                  )}
                                </div>
                                
                                {/* Checklist progress */}
                                {task.total_checklist_items > 0 && (
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between text-sm">
                                      <span>Checklist</span>
                                      <span>
                                        {task.completed_checklist_items}/{task.total_checklist_items}
                                      </span>
                                    </div>
                                    <Progress 
                                      value={(task.completed_checklist_items / task.total_checklist_items) * 100}
                                      className="h-2"
                                    />
                                  </div>
                                )}
                                
                                {/* Tags */}
                                {task.tags && task.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {task.tags.map((tag: string) => (
                                      <Badge key={tag} variant="outline" size="sm">
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Minimal view when not expanded */}
                            {!expandedTasks.has(task.id) && (
                              <div className="ml-6 flex items-center gap-4 text-sm text-muted-foreground">
                                {task.due_date && (
                                  <span>
                                    <Calendar className="inline mr-1 h-3 w-3" />
                                    {format(parseISO(task.due_date), 'MMM d')}
                                  </span>
                                )}
                                
                                {task.goal_title && (
                                  <span>
                                    <Target className="inline mr-1 h-3 w-3" />
                                    {task.goal_title}
                                  </span>
                                )}
                                
                                {task.total_checklist_items > 0 && (
                                  <span>
                                    <CheckSquare className="inline mr-1 h-3 w-3" />
                                    {task.completed_checklist_items}/{task.total_checklist_items}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Kanban Board View */
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {['pending', 'in-progress', 'blocked', 'completed'].map((status) => {
            const statusTasks = filteredTasks?.filter((t: Task) => t.status === status) || []
            const statusTitle = status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')
            
            return (
              <div key={status} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">
                    {statusTitle} ({statusTasks.length})
                  </h3>
                  <Badge variant={
                    status === 'completed' ? 'success' :
                    status === 'in-progress' ? 'default' :
                    status === 'blocked' ? 'destructive' : 'secondary'
                  }>
                    {statusTasks.length}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  {statusTasks.map((task: Task) => (
                    <Card key={task.id} className="card-hover cursor-move">
                      <CardContent className="pt-4">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium">{task.title}</h4>
                            <Badge variant={task.priority as any} size="sm">
                              {task.priority}
                            </Badge>
                          </div>
                          
                          {task.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            {task.due_date && (
                              <span>
                                <Calendar className="inline mr-1 h-3 w-3" />
                                {format(parseISO(task.due_date), 'MMM d')}
                              </span>
                            )}
                            
                            {task.estimated_time && (
                              <span>
                                <Clock className="inline mr-1 h-3 w-3" />
                                {task.estimated_time}min
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between pt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(task)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            
                            <div className="flex items-center gap-1">
                              {status !== 'completed' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStatusChange(task.id, 'completed')}
                                >
                                  <CheckCircle className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteTaskMutation.mutate(task.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {statusTasks.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                      <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No tasks</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}