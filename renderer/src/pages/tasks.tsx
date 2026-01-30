import React, { useState, useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
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
  CheckSquare,
  Calendar,
  Clock,
  AlertCircle,
  Edit,
  Trash2,
  CheckCircle,
  X,
  ListTodo,
  CalendarDays,
  Target,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { format, parseISO, isBefore, isToday, isTomorrow } from 'date-fns'
import { useToaster } from '@/hooks/use-toaster'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import { database, CreateTaskDTO } from '@/lib/database'
import { Task, TaskStatus } from '@/types'

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
  const { success, error: toastError } = useToaster()
  const { tasks, goals, addTask, updateTask, deleteTask } = useStore()
  
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
  
    // Filter and sort tasks
    const filteredTasks = useMemo(() => tasks.filter(task => {
      const matchesSearch = searchQuery === '' || 
        (task.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (Array.isArray(task.tags) && task.tags.some((tag: any) => String(tag).toLowerCase().includes(searchQuery.toLowerCase())))
      
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
          const priorityOrder: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4 }
          return (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4)
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'updated':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        default:
          return 0
      }
    }), [tasks, searchQuery, selectedPriority, selectedStatus, selectedGoal, showCompleted, sortBy])

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const today = new Date()
    return filteredTasks?.reduce((groups: any, task: Task) => {
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
  }, [filteredTasks])

  // Calculate statistics
  const stats = useMemo(() => ({
    total: tasks.length || 0,
    completed: tasks.filter(t => t.status === 'completed').length || 0,
    inProgress: tasks.filter(t => t.status === 'in-progress').length || 0,
    overdue: tasks.filter(t => 
      t.due_date && 
      isBefore(parseISO(t.due_date), new Date()) && 
      t.status !== 'completed'
    ).length || 0,
    critical: tasks.filter(t => t.priority === 'critical' && t.status !== 'completed').length || 0,
    totalEstimated: tasks.reduce((sum: number, t: Task) => sum + (t.estimated_time || 0), 0) || 0,
    totalActual: tasks.reduce((sum: number, t: Task) => sum + (t.actual_time || 0), 0) || 0,
  }), [tasks])

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: CreateTaskDTO) => {
        const newTaskId = await database.createTask(taskData)
        const newTask = await database.getTaskById(newTaskId)
        return newTask
      },
    onSuccess: (newTask) => {
      if (newTask) {
        addTask(newTask)
        success('Task created successfully')
        setIsCreating(false)
        resetForm()
      } else {
        toastError('Failed to retrieve created task.')
      }
    },
    onError: (error) => {
      console.error('Failed to create task:', error)
      toastError('Failed to create task')
    },
  })

// Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      await database.updateTask(id, updates)
      const updatedTask = await database.getTaskById(id)
      return updatedTask
    },
    onSuccess: (updatedTask) => {
      if (updatedTask) {
        updateTask(updatedTask)
        success('Task updated successfully')
        setIsCreating(false)
        setIsEditing(null)
        resetForm()
      } else {
        toastError('Failed to retrieve updated task.')
      }
    },
    onError: (error) => {
      console.error('Failed to update task:', error)
      toastError('Failed to update task')
    },
  })

// Update task status mutation
  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      await database.updateTask(id, { status })
      const updatedTask = await database.getTaskById(id)
      return { updatedTask, status }
    },
    onSuccess: ({ updatedTask, status }) => {
      if (updatedTask) {
        updateTask(updatedTask)
        if (status === 'completed') {
          success('Task completed! 🎉')
        } else if (status === 'in-progress') {
          success('Task started')
        } else if (status === 'blocked') {
          success('Task marked as blocked')
        } else {
          success('Task status updated')
        }
      }
    },
    onError: (error) => {
      console.error('Failed to update task status:', error)
      toastError('Failed to update task status')
    },
  })

// Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      await database.deleteTask(id)
      return id
    },
    onSuccess: (id) => {
      deleteTask(id)
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
    setIsCreating(true)
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

    const taskData: any = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        status: formData.status,
        tags: formData.tags,
        estimated_time: formData.estimated_time ? parseInt(formData.estimated_time, 10) : undefined,
        goal_id: formData.goal_id || undefined,
        due_date: formData.due_date || undefined,
    }

    if (isEditing) {
      updateTaskMutation.mutate({
        id: isEditing,
        updates: taskData,
      })
    } else {
      createTaskMutation.mutate(taskData)
    }
  }

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
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
          <Dialog open={isCreating} onOpenChange={(open) => {
            setIsCreating(open)
            if (!open) {
              setIsEditing(null)
              resetForm()
            }
          }}>
            <DialogTrigger asChild>
              <Button
                className="transition-all duration-300 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg hover:bg-green-700"
                onClick={() => {
                  setIsEditing(null)
                  resetForm()
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-card">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>{isEditing ? 'Edit Task' : 'Create New Task'}</DialogTitle>
                <DialogDescription>
                  Add a new task to your todo list.
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto pr-2 -mr-2 scroll-smooth">
                <div className="space-y-6 py-4">
                  {/* Basic Information Section */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</h4>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Task Title</label>
                        <Input
                          placeholder="What needs to be done?"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          className="bg-secondary/50 border-green-500/50 focus-visible:ring-primary/50"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Description</label>
                        <Textarea
                          placeholder="Add details, notes, or context..."
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={3}
                          className="bg-secondary/50 border-green-500/50 focus-visible:ring-primary/50"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Scheduling Section */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Scheduling</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Due Date</label>
                        <Input
                          type="date"
                          value={formData.due_date}
                          onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                          className="bg-secondary/50 border-green-500/50 focus-visible:ring-primary/50"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Estimated Time (minutes)</label>
                        <Input
                          type="number"
                          placeholder="e.g., 30"
                          value={formData.estimated_time}
                          onChange={(e) => setFormData({ ...formData, estimated_time: e.target.value })}
                          className="bg-secondary/50 border-green-500/50 focus-visible:ring-primary/50"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Status & Priority Section */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Status & Priority</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Priority</label>
                        <Select
                          value={formData.priority}
                          onValueChange={(value: Task['priority']) => 
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
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Status</label>
                        <Select
                          value={formData.status}
                          onValueChange={(value: TaskStatus) => 
                            setFormData({ ...formData, status: value })
                          }
                        >
                          <SelectTrigger className="bg-secondary/50 border-green-500/50 focus:ring-primary/50">
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
                    </div>
                  </div>
                  
                  {/* Organization Section */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Organization</h4>
                    <div className="space-y-3">
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
            <Progress value={stats.total > 0 ? (stats.inProgress / stats.total) * 100 : 0} className="mt-2" />
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
                className="pl-10 bg-secondary/50 border border-green-500/50 focus-visible:ring-1 focus-visible:ring-primary/50"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Select value={selectedPriority} onValueChange={setSelectedPriority}>
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
              
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[140px] bg-secondary/50 border border-green-500/50 focus:ring-1 focus:ring-primary/50">
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
                <SelectTrigger className="w-[140px] bg-secondary/50 border border-green-500/50 focus:ring-1 focus:ring-primary/50">
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
                <SelectTrigger className="w-[140px] bg-secondary/50 border border-green-500/50 focus:ring-1 focus:ring-primary/50">
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
          {filteredTasks?.length === 0 ? (
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
                  {groupTasks.map((task: Task) => (
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
                              className="cursor-pointer data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
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
                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-green-500/10">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={() => handleEdit(task)}
                                      className="cursor-pointer hover:bg-green-500/10 focus:bg-green-500/10"
                                    >
                                      <Edit className="mr-2 h-4 w-4" />
                                      Edit Task
                                    </DropdownMenuItem>
                                    {task.status !== 'completed' && (
                                      <DropdownMenuItem 
                                        onClick={() => handleStatusChange(task.id, 'completed')}
                                        className="cursor-pointer hover:bg-green-500/10 focus:bg-green-500/10"
                                      >
                                        <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                                        Mark Complete
                                      </DropdownMenuItem>
                                    )}
                                    {task.status !== 'in-progress' && task.status !== 'completed' && (
                                      <DropdownMenuItem 
                                        onClick={() => handleStatusChange(task.id, 'in-progress')}
                                        className="cursor-pointer hover:bg-blue-500/10 focus:bg-blue-500/10"
                                      >
                                        <Clock className="mr-2 h-4 w-4 text-blue-500" />
                                        Start Progress
                                      </DropdownMenuItem>
                                    )}
                                    {task.status !== 'blocked' && task.status !== 'completed' && (
                                      <DropdownMenuItem 
                                        onClick={() => handleStatusChange(task.id, 'blocked')}
                                        className="cursor-pointer hover:bg-orange-500/10 focus:bg-orange-500/10"
                                      >
                                        <AlertCircle className="mr-2 h-4 w-4 text-orange-500" />
                                        Mark Blocked
                                      </DropdownMenuItem>
                                    )}
                                    {task.status === 'completed' && (
                                      <DropdownMenuItem 
                                        onClick={() => handleStatusChange(task.id, 'pending')}
                                        className="cursor-pointer hover:bg-gray-500/10 focus:bg-gray-500/10"
                                      >
                                        <X className="mr-2 h-4 w-4" />
                                        Reopen Task
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      className="cursor-pointer text-destructive hover:bg-red-500/10 focus:bg-red-500/10 focus:text-destructive"
                                      onClick={() => deleteTaskMutation.mutate(task.id)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete Task
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
                                  
                                  {task.goal_id && (
                                    <div className="flex items-center">
                                      <Target className="mr-1 h-3 w-3" />
                                      {goals.find(g => g.id === task.goal_id)?.title}
                                    </div>
                                  )}
                                </div>
                                
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
            const statusTasks = filteredTasks.filter((t: Task) => t.status === status) || []
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
                              className="cursor-pointer hover:bg-green-500/10"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            
                            <div className="flex items-center gap-1">
                              {status !== 'completed' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStatusChange(task.id, 'completed')}
                                  className="cursor-pointer hover:bg-green-500/10 text-green-600"
                                >
                                  <CheckCircle className="h-3 w-3" />
                                </Button>
                              )}
                              {status === 'completed' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStatusChange(task.id, 'pending')}
                                  className="cursor-pointer hover:bg-gray-500/10"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteTaskMutation.mutate(task.id)}
                                className="cursor-pointer text-destructive hover:text-destructive hover:bg-red-500/10"
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
