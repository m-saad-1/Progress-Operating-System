import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { 
  Plus, 
  
  MoreVertical, 
  CheckSquare,
  Calendar,
  Clock,
  Edit,
  X,
  Target,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  BarChart3,
  Activity,
  List,
  Grid3X3,
  Archive,
} from 'lucide-react'
import { format, parseISO, isToday, isYesterday, startOfMonth, endOfMonth, startOfYear, subMonths, addMonths, eachDayOfInterval, getWeek, getDay, isSameDay, differenceInCalendarDays } from 'date-fns'
import { useToaster } from '@/hooks/use-toaster'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import { database, CreateTaskDTO } from '@/lib/database'
import { Task, TaskProgress } from '@/types'
import { 
  ProgressSelector, 
  CircularProgressSelector,
  AnimatedProgressBar,
  getProgressTextColor,
  type ProgressValue 
} from '@/components/ui/progress-selector'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'

interface TaskFormData {
  title: string
  description: string
  due_date: string
  priority: Task['priority']
  status: Task['status']
  progress: TaskProgress
  estimated_time: string
  goal_id: string
  tags: string[]
}

// Progress level configuration
const PROGRESS_LEVELS = [
  { value: 0, label: 'Skipped', color: 'bg-red-500', textColor: 'text-red-500', borderColor: 'border-red-500' },
  { value: 25, label: 'Very Low', color: 'bg-gray-400', textColor: 'text-gray-400', borderColor: 'border-gray-400' },
  { value: 50, label: 'Partial', color: 'bg-yellow-500', textColor: 'text-yellow-500', borderColor: 'border-yellow-500' },
  { value: 75, label: 'Strong', color: 'bg-green-400', textColor: 'text-green-400', borderColor: 'border-green-400' },
  { value: 100, label: 'Done', color: 'bg-green-600', textColor: 'text-green-600', borderColor: 'border-green-600' },
] as const

// Calendar Matrix View - Daily Progress Ledger
const CalendarMatrixView: React.FC<{
  tasks: Task[]
  onProgressChange: (taskId: string, date: string, progress: ProgressValue) => void
  onEdit: (task: Task) => void
  onDelete: (taskId: string) => void
}> = ({ tasks, onProgressChange, onEdit, onDelete }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
  
  // Group days by week for header
  const weekGroups = useMemo(() => {
    const groups: { weekNum: number; days: Date[] }[] = []
    let currentWeek: Date[] = []
    let currentWeekNum = getWeek(daysInMonth[0])
    
    daysInMonth.forEach((day, index) => {
      const weekNum = getWeek(day)
      if (weekNum !== currentWeekNum && currentWeek.length > 0) {
        groups.push({ weekNum: currentWeekNum, days: currentWeek })
        currentWeek = []
        currentWeekNum = weekNum
      }
      currentWeek.push(day)
      if (index === daysInMonth.length - 1) {
        groups.push({ weekNum: currentWeekNum, days: currentWeek })
      }
    })
    return groups
  }, [daysInMonth])
  
  // Get task progress for a specific date
  const getTaskDayProgress = useCallback((task: Task, date: Date): number => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const taskWithDaily = task as Task & { daily_progress?: Record<string, number> }
    if (taskWithDaily.daily_progress && taskWithDaily.daily_progress[dateStr] !== undefined) {
      return taskWithDaily.daily_progress[dateStr]
    }
    if (task.due_date && isSameDay(parseISO(task.due_date), date)) {
      return task.progress || 0
    }
    return -1
  }, [])
  
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  
  // Get cell background based on position for natural separation
  const getCellBg = (dayIndex: number, taskIndex: number, isCurrentDay: boolean, isWeekend: boolean) => {
    if (isCurrentDay) return "bg-sky-500/20" // Distinct blue tint for today
    if (isWeekend) return taskIndex % 2 === 0 ? "bg-violet-500/8" : "bg-violet-500/12"
    // Alternating soft tints for visual separation
    const pattern = (dayIndex + taskIndex) % 4
    if (pattern === 0) return "bg-slate-500/5"
    if (pattern === 1) return "bg-zinc-500/8"
    if (pattern === 2) return "bg-neutral-500/5"
    return "bg-stone-500/8"
  }
  
  return (
    <Card className="border-0 bg-white dark:bg-card/95 shadow-lg rounded-xl overflow-hidden">
      <CardContent className="p-0">
        {/* Month Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-secondary/30 dark:to-secondary/20">
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/80 dark:hover:bg-secondary/80" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col items-center">
            <h3 className="text-base font-semibold tracking-wide text-foreground">{format(currentMonth, 'MMMM yyyy')}</h3>
            <span className="text-[10px] text-muted-foreground/70">Today · {format(new Date(), 'MMM d')}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/80 dark:hover:bg-secondary/80" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex">
          {/* Left: Task Names */}
          <div className="flex-shrink-0 bg-slate-50/80 dark:bg-secondary/15" style={{ width: '200px' }}>
            {/* Header spacer */}
            <div className="h-14 flex items-end px-4 pb-2 bg-slate-100/50 dark:bg-secondary/10">
              <span className="text-xs text-muted-foreground/80 font-medium uppercase tracking-wider">Tasks</span>
              <span className="ml-auto text-xs text-muted-foreground/50 font-medium">{tasks.length}</span>
            </div>
            
            {/* Task names */}
            <div>
              {tasks.length === 0 ? (
                <div className="p-8 text-sm text-muted-foreground/60 text-center">
                  No tasks yet
                </div>
              ) : (
                tasks.map((task, index) => (
                  <div
                    key={task.id}
                    className={cn(
                      "h-10 px-4 flex items-center gap-2 transition-colors group cursor-default",
                      index % 2 === 0 ? "bg-white/60 dark:bg-slate-800/20" : "bg-slate-50/80 dark:bg-zinc-800/25",
                      "hover:bg-slate-100/80 dark:hover:bg-secondary/40"
                    )}
                  >
                    <span className="flex-1 text-xs truncate text-foreground/90 font-medium" title={task.title}>
                      {task.title}
                    </span>
                    <Badge variant={task.priority as any} className="text-[8px] px-1.5 py-0 h-4 opacity-70 font-semibold">
                      {task.priority[0].toUpperCase()}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-70 hover:opacity-100">
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-32">
                        <DropdownMenuItem onClick={() => onEdit(task)} className="text-xs">
                          <Edit className="mr-2 h-3 w-3" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-xs text-orange-600">
                          <Archive className="mr-2 h-3 w-3" /> Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Right: Calendar Grid */}
          <div className="flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <style>{`.matrix-scroll::-webkit-scrollbar { display: none; }`}</style>
            <div className="matrix-scroll" style={{ minWidth: `${daysInMonth.length * 28}px` }}>
              {/* Header: Week numbers + Dates */}
              <div className="bg-slate-50/50 dark:bg-secondary/10">
                {/* Week numbers row */}
                <div className="flex h-5">
                  {weekGroups.map((group, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-center text-[9px] text-muted-foreground/60 font-medium"
                      style={{ width: `${group.days.length * 28}px` }}
                    >
                      W{group.weekNum}
                    </div>
                  ))}
                </div>
                
                {/* Day names + dates row */}
                <div className="flex h-9">
                  {daysInMonth.map((day) => {
                    const isCurrentDay = isToday(day)
                    const isWeekend = getDay(day) === 0 || getDay(day) === 6
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "w-7 flex flex-col items-center justify-center",
                          isCurrentDay && "bg-sky-500/30 rounded-t",
                          isWeekend && !isCurrentDay && "bg-violet-500/15"
                        )}
                      >
                        <span className={cn(
                          "text-[9px] leading-none",
                          isCurrentDay ? "text-sky-600 dark:text-sky-400 font-bold" : "text-muted-foreground/50"
                        )}>{dayNames[getDay(day)]}</span>
                        <span className={cn(
                          "text-[11px] leading-none mt-0.5 font-medium",
                          isCurrentDay ? "text-sky-600 dark:text-sky-400 font-bold" : "text-muted-foreground/70"
                        )}>{format(day, 'd')}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              
              {/* Task rows with checkboxes */}
              <div>
                {tasks.map((task, taskIndex) => (
                  <div key={task.id} className="flex h-10">
                    {daysInMonth.map((day, dayIndex) => {
                      const dateStr = format(day, 'yyyy-MM-dd')
                      const progress = getTaskDayProgress(task, day)
                      const isCurrentDay = isToday(day)
                      const isWeekend = getDay(day) === 0 || getDay(day) === 6
                      
                      return (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            "w-7 flex items-center justify-center",
                            getCellBg(dayIndex, taskIndex, isCurrentDay, isWeekend)
                          )}
                        >
                          <MatrixCheckbox
                            value={progress}
                            onChange={(newProgress) => onProgressChange(task.id, dateStr, newProgress)}
                          />
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Legend - Clean minimal style */}
        <div className="px-6 py-3 bg-slate-50/80 dark:bg-secondary/10 flex items-center justify-center gap-8">
          {PROGRESS_LEVELS.map((level) => (
            <div key={level.value} className="flex items-center gap-2">
              <div className={cn(
                "w-4 h-4 rounded",
                level.value === 0 ? "bg-rose-500/90" :
                level.value === 25 ? "bg-slate-400/90" :
                level.value === 50 ? "bg-amber-500/90" :
                level.value === 75 ? "bg-emerald-400/90" :
                "bg-emerald-600"
              )} />
              <span className="text-[10px] text-muted-foreground/70 font-medium">{level.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-zinc-300/70 dark:bg-zinc-600/50" />
            <span className="text-[10px] text-muted-foreground/70 font-medium">Empty</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Matrix Checkbox Component
const MatrixCheckbox: React.FC<{
  value: number
  onChange: (value: ProgressValue) => void
}> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false)
  const [localValue, setLocalValue] = useState(value)
  
  // Sync local value with prop when it changes from parent
  useEffect(() => {
    setLocalValue(value)
  }, [value])
  
  const getCheckboxStyle = (val: number) => {
    // Empty state - distinct grayish color that's clearly visible
    if (val < 0) return "bg-zinc-300/70 dark:bg-zinc-500/50 hover:bg-zinc-400/70 dark:hover:bg-zinc-500/70"
    if (val === 0) return "bg-rose-500 hover:bg-rose-600"
    if (val === 25) return "bg-slate-400 hover:bg-slate-500"
    if (val === 50) return "bg-amber-500 hover:bg-amber-600"
    if (val === 75) return "bg-emerald-400 hover:bg-emerald-500"
    return "bg-emerald-600 hover:bg-emerald-700" // 100% completed
  }
  
  const handleSelect = (newValue: ProgressValue) => {
    setLocalValue(newValue) // Immediately update local state for instant UI feedback
    onChange(newValue) // Trigger the actual update
    setOpen(false)
  }
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "w-5 h-5 rounded-sm transition-all duration-100 hover:scale-110 cursor-pointer shadow-sm",
            getCheckboxStyle(localValue)
          )}
          aria-label="Set progress"
        />
      </PopoverTrigger>
      <PopoverContent className="w-40 p-2 bg-popover/98 backdrop-blur-sm shadow-xl rounded-lg" align="center" side="bottom" sideOffset={6}>
        <div className="space-y-1">
          {PROGRESS_LEVELS.map((level) => (
            <button
              key={level.value}
              onClick={() => handleSelect(level.value as ProgressValue)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition-colors",
                localValue === level.value ? "bg-secondary" : "hover:bg-secondary/70"
              )}
            >
              <div className={cn(
                "w-4 h-4 rounded-sm",
                level.value === 0 ? "bg-rose-500" :
                level.value === 25 ? "bg-slate-400" :
                level.value === 50 ? "bg-amber-500" :
                level.value === 75 ? "bg-emerald-400" :
                "bg-emerald-600"
              )} />
              <span className="text-foreground/90 font-medium">{level.value}%</span>
              <span className="text-muted-foreground/70 ml-auto text-[10px]">{level.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Checkbox View Component - Now uses Calendar Matrix
const CheckboxView: React.FC<{
  tasks: Task[]
  onProgressChange: (taskId: string, date: string, progress: ProgressValue) => void
  onEdit: (task: Task) => void
  onDelete: (taskId: string) => void
}> = ({ tasks, onProgressChange, onEdit, onDelete }) => {
  return (
    <CalendarMatrixView
      tasks={tasks}
      onProgressChange={onProgressChange}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  )
}

// Task Analytics Charts - Enhanced
const TaskAnalytics: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
  // Generate monthly progress data for the line chart
  const monthlyData = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i)
      const monthStart = startOfMonth(date)
      const monthEnd = endOfMonth(date)
      
      const monthTasks = tasks.filter(t => {
        const createdAt = parseISO(t.created_at)
        return createdAt >= monthStart && createdAt <= monthEnd
      })
      
      const completedTasks = monthTasks.filter(t => t.progress === 100)
      const avgProgress = monthTasks.length > 0 
        ? Math.round(monthTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / monthTasks.length)
        : 0
      
      // Calculate additional metrics for enhanced chart
      const taskCount = monthTasks.length
      const completionRate = monthTasks.length > 0 
        ? Math.round((completedTasks.length / monthTasks.length) * 100)
        : 0
      
      months.push({
        month: format(date, 'MMM'),
        fullMonth: format(date, 'MMMM yyyy'),
        progress: avgProgress,
        completionRate,
        completed: completedTasks.length,
        total: taskCount,
        target: 75, // Target line
      })
    }
    return months
  }, [tasks])
  
  // Generate daily completion data for bar chart (last 14 days)
  const dailyData = useMemo(() => {
    const days = []
    for (let i = 13; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = format(date, 'yyyy-MM-dd')
      
      const dayTasks = tasks.filter(t => {
        if (!t.completed_at) return false
        return format(parseISO(t.completed_at), 'yyyy-MM-dd') === dateStr
      })
      
      const progressUpdates = tasks.filter(t => {
        return format(parseISO(t.updated_at), 'yyyy-MM-dd') === dateStr && t.progress > 0
      })
      
      days.push({
        date: format(date, 'dd'),
        day: format(date, 'EEE'),
        completed: dayTasks.length,
        updates: progressUpdates.length,
      })
    }
    return days
  }, [tasks])
  
  // Consistency heatmap data (last 12 weeks)
  const heatmapData = useMemo(() => {
    const weeks: number[][] = []
    const today = new Date()
    
    for (let week = 11; week >= 0; week--) {
      const weekData: number[] = []
      for (let day = 0; day < 7; day++) {
        const date = new Date(today)
        date.setDate(date.getDate() - (week * 7 + (6 - day)))
        const dateStr = format(date, 'yyyy-MM-dd')
        
        const dayActivity = tasks.filter(t => {
          const updatedDate = format(parseISO(t.updated_at), 'yyyy-MM-dd')
          return updatedDate === dateStr
        }).length
        
        weekData.push(Math.min(dayActivity, 5)) // Cap at 5 for intensity
      }
      weeks.push(weekData)
    }
    return weeks
  }, [tasks])
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Enhanced Monthly Progress Line Chart - Primary */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Progress Trend
          </CardTitle>
          <CardDescription className="text-xs">Average completion & target comparison</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="completionGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142 76% 36%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142 76% 36%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 10 }} 
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  domain={[0, 100]} 
                  tick={{ fontSize: 10 }} 
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                  formatter={(value, name) => [
                    `${value}%`, 
                    name === 'progress' ? 'Avg Progress' : name === 'completionRate' ? 'Completion Rate' : 'Target'
                  ]}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullMonth || label}
                />
                {/* Target reference line */}
                <Area
                  type="monotone"
                  dataKey="target"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  fill="none"
                  dot={false}
                />
                {/* Completion Rate Area */}
                <Area
                  type="monotone"
                  dataKey="completionRate"
                  stroke="hsl(142 76% 36%)"
                  strokeWidth={1.5}
                  fill="url(#completionGradient)"
                  dot={{ r: 2, fill: 'hsl(142 76% 36%)' }}
                  activeDot={{ r: 4, strokeWidth: 2 }}
                />
                {/* Progress Area - Primary */}
                <Area
                  type="monotone"
                  dataKey="progress"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#progressGradient)"
                  dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Chart Legend */}
          <div className="flex items-center justify-center gap-4 mt-2 text-[10px]">
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-primary rounded" />
              <span className="text-muted-foreground">Avg Progress</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-green-500 rounded" />
              <span className="text-muted-foreground">Completion Rate</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 border-t border-dashed border-muted-foreground" />
              <span className="text-muted-foreground">Target (75%)</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Task Completion Bar Chart - Secondary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-green-500" />
            Daily Activity
          </CardTitle>
          <CardDescription className="text-xs">Last 14 days</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '10px',
                  }}
                />
                <Bar 
                  dataKey="completed" 
                  fill="hsl(142 76% 36%)" 
                  radius={[3, 3, 0, 0]}
                  name="Completed"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      
      {/* Consistency Heatmap - Optional */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-orange-500" />
            Consistency
          </CardTitle>
          <CardDescription className="text-xs">12 week activity</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-0.5">
            {heatmapData.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-0.5">
                {week.map((intensity, dayIndex) => (
                  <div
                    key={dayIndex}
                    className={cn(
                      "w-2.5 h-2.5 rounded-sm transition-colors",
                      intensity === 0 && "bg-secondary",
                      intensity === 1 && "bg-green-200 dark:bg-green-900",
                      intensity === 2 && "bg-green-300 dark:bg-green-700",
                      intensity === 3 && "bg-green-400 dark:bg-green-600",
                      intensity === 4 && "bg-green-500 dark:bg-green-500",
                      intensity >= 5 && "bg-green-600 dark:bg-green-400",
                    )}
                    title={`${intensity} activities`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 mt-2 text-[9px] text-muted-foreground">
            <span>Less</span>
            <div className="flex gap-0.5">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div 
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-sm",
                    i === 0 && "bg-secondary",
                    i === 1 && "bg-green-200 dark:bg-green-900",
                    i === 2 && "bg-green-300 dark:bg-green-700",
                    i === 3 && "bg-green-400 dark:bg-green-600",
                    i === 4 && "bg-green-500 dark:bg-green-500",
                    i >= 5 && "bg-green-600 dark:bg-green-400",
                  )}
                />
              ))}
            </div>
            <span>More</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Task Item Component with Progressive Completion
const TaskItem: React.FC<{
  task: Task
  goals: any[]
  expanded: boolean
  onToggleExpand: () => void
  onProgressChange: (progress: ProgressValue) => void
  onEdit: () => void
  onDelete: () => void
}> = ({ task, goals, expanded, onToggleExpand, onProgressChange, onEdit, onDelete }) => {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
      <Card interactive className={cn(
        "transition-all duration-300",
        task.progress === 100 && "bg-muted/30 dark:bg-muted/20"
      )}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            {/* Progress Selector */}
            <div className="mt-1">
              <CircularProgressSelector
                value={(task.progress || 0) as ProgressValue}
                onChange={onProgressChange}
                size="md"
              />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={onToggleExpand}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {expanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  <h3 className={cn(
                    "font-medium transition-all duration-300",
                    task.progress === 100 && "line-through text-muted-foreground"
                  )}>
                    {task.title}
                  </h3>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge variant={task.priority as any}>
                    {task.priority}
                  </Badge>
                  
                  {/* Progress Badge */}
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "transition-colors duration-300",
                      getProgressTextColor(task.progress || 0),
                      task.progress === 100 && "bg-green-500/10"
                    )}
                  >
                    {task.progress || 0}%
                  </Badge>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Task
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="cursor-pointer text-orange-600 focus:text-orange-600"
                        onClick={onDelete}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Archive Task
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              
              {/* Inline Progress Bar */}
              <div className="mb-2">
                <AnimatedProgressBar value={task.progress || 0} height="sm" />
              </div>
              
              {/* Expanded Details */}
              {expanded && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
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
                      
                      {/* Quick Progress Selector in expanded view */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Quick progress:</span>
                        <ProgressSelector
                          value={(task.progress || 0) as ProgressValue}
                          onChange={onProgressChange}
                          size="md"
                          showLabel
                        />
                      </div>
                      
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {task.tags.map((tag: string) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function Tasks() {
  const queryClient = useQueryClient()
  const { success, error: toastError } = useToaster()
  const { tasks, goals, addTask, updateTask, archiveTask } = useStore()
  
  const [viewMode, setViewMode] = useState<'list' | 'checkbox'>('list')
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    due_date: format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    priority: 'medium',
    status: 'pending',
    progress: 0,
    estimated_time: '',
    goal_id: '',
    tags: [],
  })
  
  const [newTag, setNewTag] = useState('')
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [dayKey, setDayKey] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  useEffect(() => {
    const interval = setInterval(() => {
      const nextDayKey = format(new Date(), 'yyyy-MM-dd')
      setDayKey((prev) => (prev === nextDayKey ? prev : nextDayKey))
    }, 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  // Filter and sort tasks
  const filteredTasks = useMemo(() => tasks.filter(task => {
    // In list mode, only show today's and yesterday's tasks (by creation date)
    const taskDate = task.created_at
      ? parseISO(task.created_at)
      : task.due_date
        ? parseISO(task.due_date)
        : null
    const matchesDate = viewMode === 'checkbox' || (taskDate ? (isToday(taskDate) || isYesterday(taskDate)) : false)

    return matchesDate
  }).sort((a, b) => {
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  }), [tasks, viewMode, dayKey])

  // Group tasks by date - only Today's Tasks and Yesterday's Tasks for list mode
  const tasksByDate = useMemo(() => {
    return filteredTasks?.reduce((groups: Record<string, Task[]>, task: Task) => {
      const taskDate = task.created_at
        ? parseISO(task.created_at)
        : task.due_date
          ? parseISO(task.due_date)
          : null
      const group = taskDate && isYesterday(taskDate) ? "Yesterday's Tasks" : "Today's Tasks"
      
      if (!groups[group]) groups[group] = []
      groups[group].push(task)
      return groups
    }, {})
  }, [filteredTasks])

  // Calculate statistics
  const stats = useMemo(() => {
    const now = new Date()
    const total = tasks.length || 0
    const completed = tasks.filter(t => (t.progress || 0) === 100).length || 0
    const incomplete = total - completed
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    const getTaskActivityDate = (task: Task) => {
      if (task.updated_at) return parseISO(task.updated_at)
      if (task.created_at) return parseISO(task.created_at)
      if (task.due_date) return parseISO(task.due_date)
      return null
    }

    const avgProgress = (items: Task[]) => {
      if (items.length === 0) return 0
      return Math.round(items.reduce((sum, t) => sum + (t.progress || 0), 0) / items.length)
    }

    // Monthly Progress
    const currentMonthStart = startOfMonth(now)
    const currentMonthEnd = endOfMonth(now)
    const lastMonthDate = subMonths(now, 1)
    const lastMonthStart = startOfMonth(lastMonthDate)
    const lastMonthEnd = endOfMonth(lastMonthDate)

    const currentMonthTasks = tasks.filter(t => {
      const date = getTaskActivityDate(t)
      return date ? date >= currentMonthStart && date <= currentMonthEnd : false
    })
    const lastMonthTasks = tasks.filter(t => {
      const date = getTaskActivityDate(t)
      return date ? date >= lastMonthStart && date <= lastMonthEnd : false
    })

    const currentMonthAvg = avgProgress(currentMonthTasks)
    const lastMonthAvg = avgProgress(lastMonthTasks)
    const monthDelta = currentMonthAvg - lastMonthAvg

    // Yearly Progress
    const yearStart = startOfYear(now)
    const ytdTasks = tasks.filter(t => {
      const date = getTaskActivityDate(t)
      return date ? date >= yearStart && date <= now : false
    })
    const ytdAvg = avgProgress(ytdTasks)

    const monthsToDate: { label: string; avg: number }[] = []
    for (let i = 0; i <= now.getMonth(); i++) {
      const date = new Date(now.getFullYear(), i, 1)
      const start = startOfMonth(date)
      const end = endOfMonth(date)
      const monthTasks = tasks.filter(t => {
        const activityDate = getTaskActivityDate(t)
        return activityDate ? activityDate >= start && activityDate <= end : false
      })
      monthsToDate.push({ label: format(date, 'MMM'), avg: avgProgress(monthTasks) })
    }
    const bestMonth = monthsToDate.reduce((best, current) => current.avg > best.avg ? current : best, monthsToDate[0] || { label: '—', avg: 0 })
    const worstMonth = monthsToDate.reduce((worst, current) => current.avg < worst.avg ? current : worst, monthsToDate[0] || { label: '—', avg: 0 })

    // Consistency Score (current month)
    const daysTotal = Math.max(differenceInCalendarDays(now, currentMonthStart) + 1, 1)
    const activeDaysSet = new Set<string>()
    tasks.forEach((task) => {
      const activityDate = getTaskActivityDate(task)
      if (!activityDate) return
      if (activityDate >= currentMonthStart && activityDate <= now) {
        activeDaysSet.add(format(activityDate, 'yyyy-MM-dd'))
      }
    })
    const activeDays = activeDaysSet.size

    const dayFlags: boolean[] = []
    for (let i = 0; i < daysTotal; i++) {
      const day = new Date(currentMonthStart)
      day.setDate(currentMonthStart.getDate() + i)
      dayFlags.push(activeDaysSet.has(format(day, 'yyyy-MM-dd')))
    }
    let maxStreak = 0
    let currentStreak = 0
    dayFlags.forEach((active) => {
      if (active) {
        currentStreak += 1
        maxStreak = Math.max(maxStreak, currentStreak)
      } else {
        currentStreak = 0
      }
    })
    const streakInfluence = daysTotal > 0 ? Math.round((maxStreak / daysTotal) * 100) : 0

    return {
      total,
      completed,
      incomplete,
      completionRate,
      currentMonthAvg,
      monthDelta,
      ytdAvg,
      bestMonth,
      worstMonth,
      activeDays,
      daysTotal,
      streakInfluence,
    }
  }, [tasks])

  // Mutations
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: CreateTaskDTO) => {
      const newTaskId = await database.createTask(taskData)
      const newTask = await database.getTaskById(newTaskId)
      return newTask
    },
    onSuccess: (newTask) => {
      if (newTask) {
        addTask(newTask)
        success('Task created successfully! 🎉')
        setIsCreating(false)
        resetForm()
      }
    },
    onError: () => toastError('Failed to create task'),
  })

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      await database.updateTask(id, updates)
      const updatedTask = await database.getTaskById(id)
      return updatedTask
    },
    onSuccess: (updatedTask) => {
      if (updatedTask) {
        updateTask(updatedTask)
        success('Task updated!')
        setIsCreating(false)
        setIsEditing(null)
        resetForm()
      }
    },
    onError: () => toastError('Failed to update task'),
  })

  useEffect(() => {
    const lastReset = localStorage.getItem('tasks:last-reset-date')
    if (lastReset === dayKey) return

    localStorage.setItem('tasks:last-reset-date', dayKey)

    const todayTasks = tasks.filter((task) => {
      if (!task.created_at) return false
      return format(parseISO(task.created_at), 'yyyy-MM-dd') === dayKey
    })

    if (todayTasks.length === 0) return

    const resetTodayTasks = async () => {
      await Promise.all(
        todayTasks.map(async (task) => {
          const currentProgress = task.progress || 0
          if (currentProgress === 0 && task.status === 'pending') return

          await database.updateTask(task.id, {
            progress: 0,
            status: 'pending',
          })

          const updatedTask = await database.getTaskById(task.id)
          if (updatedTask) updateTask(updatedTask)
        })
      )
    }

    resetTodayTasks()
  }, [dayKey, tasks, updateTask])

  const updateProgressMutation = useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      const updates: Partial<Task> = { 
        progress: progress as TaskProgress,
        status: progress === 100 ? 'completed' : progress > 0 ? 'in-progress' : 'pending',
        completed_at: progress === 100 ? new Date().toISOString() : undefined,
      }
      await database.updateTask(id, updates)
      const updatedTask = await database.getTaskById(id)
      return { updatedTask, progress }
    },
    onSuccess: ({ updatedTask, progress }) => {
      if (updatedTask) {
        updateTask(updatedTask)
        if (progress === 100) {
          success('Task completed! 🎉🎊')
        } else if (progress === 75) {
          success('Almost there! 75% done 💪')
        } else if (progress === 50) {
          success('Halfway there! 🚀')
        } else if (progress === 25) {
          success('Good start! 25% progress')
        }
      }
    },
    onError: () => toastError('Failed to update progress'),
  })

  const updateDailyProgressMutation = useMutation({
    mutationFn: async ({ id, dailyProgress }: { id: string; dailyProgress: Record<string, number> }) => {
      await database.updateTask(id, { daily_progress: dailyProgress })
      const updatedTask = await database.getTaskById(id)
      return updatedTask
    },
    onSuccess: (updatedTask) => {
      if (updatedTask) {
        updateTask(updatedTask)
      }
    },
    onError: () => toastError('Failed to update daily progress'),
  })

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      // Archive task instead of permanent delete - preserves progress history
      await database.archiveTask(id)
      return id
    },
    onSuccess: (id) => {
      archiveTask(id)
      // Invalidate archive queries so it shows up in archive
      queryClient.invalidateQueries({ queryKey: ['archive'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      success('Task archived. Progress history preserved.')
    },
    onError: () => toastError('Failed to archive task'),
  })

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      due_date: format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      priority: 'medium',
      status: 'pending',
      progress: 0,
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
      progress: (task.progress || 0) as TaskProgress,
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
      status: formData.progress === 100 ? 'completed' : formData.progress > 0 ? 'in-progress' : 'pending',
      progress: formData.progress,
      tags: formData.tags,
      estimated_time: formData.estimated_time ? parseInt(formData.estimated_time, 10) : undefined,
      goal_id: formData.goal_id || undefined,
      due_date: formData.due_date || undefined,
    }

    if (isEditing) {
      updateTaskMutation.mutate({ id: isEditing, updates: taskData })
    } else {
      createTaskMutation.mutate(taskData)
    }
  }

  const handleProgressChange = useCallback((taskId: string, progress: ProgressValue) => {
    updateProgressMutation.mutate({ id: taskId, progress })
  }, [updateProgressMutation])

  const handleMatrixProgressChange = useCallback((taskId: string, date: string, progress: ProgressValue) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const dailyProgress = { ...(task.daily_progress || {}) }
    dailyProgress[date] = progress
    updateDailyProgressMutation.mutate({ id: taskId, dailyProgress })

    if (isToday(parseISO(date))) {
      updateProgressMutation.mutate({ id: taskId, progress })
    }
  }, [tasks, updateDailyProgressMutation, updateProgressMutation])

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
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] })
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(tag => tag !== tagToRemove) })
  }
  
  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground text-sm">
            Track your progress with clarity and motivation
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center rounded-lg border bg-secondary/30 p-0.5">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2.5"
              onClick={() => setViewMode('list')}
            >
              <List className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">List</span>
            </Button>
            <Button
              variant={viewMode === 'checkbox' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2.5"
              onClick={() => setViewMode('checkbox')}
            >
              <Grid3X3 className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">Checkbox</span>
            </Button>
          </div>
          
          <Dialog open={isCreating} onOpenChange={(open) => {
            setIsCreating(open)
            if (!open) {
              setIsEditing(null)
              resetForm()
            }
          }}>
            <DialogTrigger asChild>
              <Button
                className="transition-all duration-300 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
                size="sm"
                onClick={() => {
                  setIsEditing(null)
                  resetForm()
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-card max-h-[90vh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>{isEditing ? 'Edit Task' : 'Create New Task'}</DialogTitle>
                <DialogDescription>
                  Set your task details and initial progress.
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Task Title</label>
                    <Input
                      placeholder="What needs to be done?"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="bg-secondary/50 border-green-500/20 focus-visible:ring-green-500/50 dark:border-green-500/15"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      placeholder="Add details, notes, or context..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                      className="bg-secondary/50 border-green-500/20 focus-visible:ring-green-500/50 dark:border-green-500/15"
                    />
                  </div>
                  
                  {/* Progress Section */}
                  <div className="p-4 bg-secondary/30 rounded-lg border border-green-500/10">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">Set starting progress</span>
                      <span className={cn("text-lg font-bold", getProgressTextColor(formData.progress))}>
                        {formData.progress}%
                      </span>
                    </div>
                    <ProgressSelector
                      value={formData.progress}
                      onChange={(value: ProgressValue) => setFormData({ ...formData, progress: value })}
                      size="lg"
                      showLabel
                    />
                    <AnimatedProgressBar value={formData.progress} height="md" className="mt-3" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Due Date</label>
                      <Input
                        type="date"
                        value={formData.due_date}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                        className="bg-secondary/50 border-green-500/20 focus-visible:ring-green-500/50 dark:border-green-500/15"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Estimated Time (minutes)</label>
                      <Input
                        type="number"
                        placeholder="e.g., 30"
                        value={formData.estimated_time}
                        onChange={(e) => setFormData({ ...formData, estimated_time: e.target.value })}
                        className="bg-secondary/50 border-green-500/20 focus-visible:ring-green-500/50 dark:border-green-500/15"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Priority</label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value: Task['priority']) => setFormData({ ...formData, priority: value })}
                      >
                        <SelectTrigger className="bg-secondary/50 border-green-500/20 focus:ring-green-500/50 dark:border-green-500/15">
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
                      <label className="text-sm font-medium">Related Goal</label>
                      <Select
                        value={formData.goal_id || "none"}
                        onValueChange={(value) => setFormData({ ...formData, goal_id: value === "none" ? "" : value })}
                      >
                        <SelectTrigger className="bg-secondary/50 border-green-500/20 focus:ring-green-500/50 dark:border-green-500/15">
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
                  </div>
                  
                  {/* Tags */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tags</label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a tag..."
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        className="bg-secondary/50 border-green-500/20 focus-visible:ring-green-500/50 dark:border-green-500/15"
                      />
                      <Button type="button" onClick={addTag} variant="secondary">
                        Add
                      </Button>
                    </div>
                    {formData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="gap-1">
                            {tag}
                            <button type="button" onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive">
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
            <CardTitle className="text-sm font-medium">Task Health</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>Total tasks</div>
              <div className="text-right">{stats.total}</div>
              <div>Completed</div>
              <div className="text-right text-green-500">{stats.completed}</div>
              <div>Incomplete</div>
              <div className="text-right text-orange-500">{stats.incomplete}</div>
              <div>Completion rate</div>
              <div className="text-right">{stats.completionRate}%</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className={cn("text-2xl font-bold", getProgressTextColor(stats.currentMonthAvg))}>
              {stats.currentMonthAvg}%
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>Current month</div>
              <div className="text-right">{stats.currentMonthAvg}%</div>
              <div>Delta vs last month</div>
              <div className={cn("text-right", stats.monthDelta >= 0 ? "text-green-500" : "text-red-500")}>
                {stats.monthDelta >= 0 ? `+${stats.monthDelta}` : stats.monthDelta}%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Yearly Progress</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className={cn("text-2xl font-bold", getProgressTextColor(stats.ytdAvg))}>
              {stats.ytdAvg}%
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>YTD</div>
              <div className="text-right">{stats.ytdAvg}%</div>
              <div>Best month</div>
              <div className="text-right">{stats.bestMonth.label}</div>
              <div>Worst month</div>
              <div className="text-right">{stats.worstMonth.label}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consistency Score</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">{stats.activeDays}/{stats.daysTotal}</div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>Days active / total</div>
              <div className="text-right">{stats.activeDays}/{stats.daysTotal}</div>
              <div>Habit streak influence</div>
              <div className="text-right">{stats.streakInfluence}%</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Checkbox View */}
      {viewMode === 'checkbox' && (
        <CheckboxView
          tasks={filteredTasks}
          onProgressChange={handleMatrixProgressChange}
          onEdit={handleEdit}
          onDelete={(id) => deleteTaskMutation.mutate(id)}
        />
      )}

      {/* Tasks List - Only show in list view */}
      {viewMode === 'list' && (
        <div className="space-y-6">
        {filteredTasks?.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No tasks found</h3>
              <p className="text-muted-foreground mb-4">
                Create your first task to get started!
              </p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Task
              </Button>
            </CardContent>
          </Card>
        ) : (
          Object.entries(tasksByDate || {}).sort((a, b) => {
            if (a[0] === b[0]) return 0
            return a[0] === "Today's Tasks" ? -1 : 1
          }).map(([group, groupTasks]) => {
            const tasks = groupTasks as Task[]
            return (
            <div key={group} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  {group} 
                  <Badge variant="outline" className="text-xs">
                    {tasks.length}
                  </Badge>
                </h2>
              </div>
              
              <div className="space-y-2">
                {tasks.map((task: Task) => (
                  <TaskItem
                      key={task.id}
                      task={task}
                      goals={goals}
                      expanded={expandedTasks.has(task.id)}
                      onToggleExpand={() => toggleTaskExpanded(task.id)}
                      onProgressChange={(progress) => handleProgressChange(task.id, progress)}
                    onEdit={() => handleEdit(task)}
                    onDelete={() => deleteTaskMutation.mutate(task.id)}
                  />
                ))}
              </div>
            </div>
          )})
        )}
        </div>
      )}

      {/* Analytics Section */}
      <div className="animate-in fade-in slide-in-from-top-4 duration-300">
        <TaskAnalytics tasks={tasks} />
      </div>
    </div>
  )
}
