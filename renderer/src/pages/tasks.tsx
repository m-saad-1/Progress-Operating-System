import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { shallow } from 'zustand/shallow'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { 
  Plus, 
  Eye,
  EyeOff,
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
  Pause,
  Play,
  BarChart3,
  Activity,
  List,
  Grid3X3,
  Archive,
  HelpCircle,
} from 'lucide-react'
import { format, isToday, startOfMonth, endOfMonth, subMonths, addMonths, eachDayOfInterval, getWeek, getDay, isSameDay, startOfDay, subDays } from 'date-fns'
import { safeParseDate, safeToDayKeyParts } from '@/lib/date-safe'
import { useToaster } from '@/hooks/use-toaster'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import { database, CreateTaskDTO, TaskTabStatsSnapshot, TaskAnalyticsChartSnapshot, TaskMonthlyHistoryPoint } from '@/lib/database'
import { Task, TaskProgress, DailyTaskState, TaskStatus } from '@/types'
import { invalidateTaskRelatedQueries, buildTaskProgressUpdatePayload } from '@/lib/task-sync'
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
  AreaChart,
  Area,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts'
import { TaskDurationType } from '@/types'
import { getTodaysTasks, getYesterdaysTasks, getDailyProgress, normalizeDailyProgress, recordDailyProgress } from '@/lib/daily-reset'
import { ContextTipsDialog } from '@/components/context-tips-dialog'

interface TaskFormData {
  title: string
  description: string
  due_date: string
  priority: Task['priority']
  status: Task['status']
  estimated_time: string
  goal_id: string
  tags: string[]
  duration_type: TaskDurationType
}

// Progress level configuration - Skipped does NOT count as completed
// Allowed completion values: 25%, 50%, 75%, 100%
const PROGRESS_LEVELS = [
  { value: 0, label: 'Skipped', color: 'bg-red-500', textColor: 'text-red-500', borderColor: 'border-red-500', description: 'Task was skipped and not completed' },
  { value: 25, label: '25%', color: 'bg-gray-400', textColor: 'text-gray-400', borderColor: 'border-gray-400', description: 'Minimal progress made' },
  { value: 50, label: '50%', color: 'bg-yellow-500', textColor: 'text-yellow-500', borderColor: 'border-yellow-500', description: 'Halfway through the task' },
  { value: 75, label: '75%', color: 'bg-green-400', textColor: 'text-green-400', borderColor: 'border-green-400', description: 'Almost complete, final steps remaining' },
  { value: 100, label: 'Done', color: 'bg-green-600', textColor: 'text-green-600', borderColor: 'border-green-600', description: 'Task fully completed' },
] as const

const getProgressLabel = (value: number) =>
  PROGRESS_LEVELS.find((level) => level.value === value)?.label || ''

const TASK_TIPS_SECTIONS = [
  {
    title: 'Avoid Multitasking & Burnout',
    points: [
      'Multitasking reduces focus and increases mistakes—concentrating on one task is more efficient.',
      'Doing anything at 50% quality is better than spreading yourself thin across three tasks at 100% effort.',
      'Prevention is key: protect your energy by saying no to non-essential work and setting realistic limits.',
      'Risk of burnout rises when you juggle too many tasks—prioritize deeply meaningful work over quantity.',
      'Single-tasking builds momentum and momentum builds confidence—both essential for sustainable productivity.',
    ],
  },
  {
    title: 'Prioritization That Works',
    points: [
      'Use high priority only for truly time-critical items; keep most work in medium to reduce overload.',
      'Treat multi-day tasks as continuity work and today-only tasks as same-day commitments.',
      'Link tasks to goals when possible so effort contributes to measurable long-term progress.',
    ],
  },
  {
    title: 'Progress Tracking Meaning',
    points: [
      '0% means skipped for that day and does not count as completion.',
      '25/50/75% represent partial movement and preserve realistic daily history.',
      '100% is the only fully completed state and drives completion metrics directly.',
    ],
  },
  {
    title: 'Overdue Handling',
    points: [
      'Update missed work in Yesterday first so analytics reflect what happened when it happened.',
      'For continuous tasks, resume progress today after recording the previous day status correctly.',
      'Avoid backfilling older dates to keep daily trends trustworthy and actionable.',
    ],
  },
  {
    title: 'Productivity Best Practices',
    points: [
      'Start with 1-3 meaningful tasks and finish them before expanding scope.',
      'Review skipped items at end of day and either reschedule or archive intentionally.',
      'Use weighted progress to balance quantity of tasks with actual impact.',
    ],
  },
] as const

const YESTERDAY_TIPS_SECTIONS = [
  {
    title: 'Purpose of Yesterday Section',
    points: [
      'This section is ONLY for marking tasks that were completed but forgotten to mark yesterday.',
      'Use it to record the accurate completion status for tasks you actually finished.',
      'It is NOT for doing yesterday\'s missed tasks - focus on today\'s work instead.',
    ],
  },
  {
    title: 'How to Update Correctly',
    points: [
      'Mark tasks as complete (100%) if you finished them yesterday but forgot to update.',
      'Update progress to reflect what you actually accomplished yesterday, not new work.',
      'After correcting yesterday, continue your focus on today\'s tasks to maintain momentum.',
    ],
  },
] as const

// Calendar Matrix View - Daily Progress Ledger
const CalendarMatrixView: React.FC<{
  tasks: Task[]
  onProgressChange: (taskId: string, date: string, progress: ProgressValue) => void
  onTaskClick: (task: Task) => void
}> = ({ tasks, onProgressChange, onTaskClick }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  
  // Sort tasks: continuous/multi-day first, today-only last
  // Also exclude deleted tasks and non-paused tasks
  const sortedTasks = useMemo(() => {
    return [...tasks]
      .filter(t => !t.deleted_at) // Exclude deleted tasks
      .sort((a, b) => {
        // Continuous tasks come first
        if (a.duration_type === 'continuous' && b.duration_type !== 'continuous') return -1
        if (a.duration_type !== 'continuous' && b.duration_type === 'continuous') return 1
        // Within same type, sort by creation date (newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
  }, [tasks])
  
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
    if (task.daily_progress && task.daily_progress[dateStr]) {
      const dayEntry = task.daily_progress[dateStr]
      const dayProgress = dayEntry.progress ?? 0
      if (dayEntry.status === 'pending' && dayProgress === 0) {
        return -1
      }
      return dayProgress
    }
    if (task.due_date && isSameDay(safeParseDate(task.due_date), date)) {
      const currentProgress = task.progress ?? 0
      if ((task.status ?? 'pending') === 'pending' && currentProgress === 0) {
        return -1
      }
      return currentProgress
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
    <Card className="border-0 bg-white dark:bg-zinc-900/95 shadow-lg rounded-xl overflow-hidden">
      <CardContent className="p-0">
        {/* Month Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-100 dark:bg-zinc-800/85">
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/80 dark:hover:bg-zinc-700/80" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col items-center">
            <h3 className="text-base font-semibold tracking-wide text-foreground">{format(currentMonth, 'MMMM yyyy')}</h3>
            <span className="text-[10px] text-muted-foreground/70">Today · {format(new Date(), 'MMM d')}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/80 dark:hover:bg-zinc-700/80" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex">
          {/* Left: Task Names - reduced width */}
          <div className="flex-shrink-0 bg-slate-50/80 dark:bg-zinc-900/70" style={{ width: '200px' }}>
            {/* Header spacer */}
            <div className="h-5 bg-slate-100/50 dark:bg-zinc-800/65" />
            <div className="h-7 flex items-center px-3 bg-slate-100/50 dark:bg-zinc-800/65">
              <span className="text-sm text-muted-foreground/80 font-medium uppercase tracking-wider">Tasks</span>
              <span className="ml-auto text-sm text-muted-foreground/50 font-medium">{sortedTasks.length}</span>
            </div>
            
            {/* Task names */}
            <div>
              {sortedTasks.length === 0 ? (
                <div className="p-6 text-xs text-muted-foreground/60 text-center">
                  No tasks yet
                </div>
              ) : (
                sortedTasks.map((task, index) => (
                  <div
                    key={task.id}
                    className={cn(
                      "h-7 px-3 flex items-center gap-1.5 transition-colors group cursor-default",
                      index % 2 === 0 ? "bg-white/60 dark:bg-zinc-900/45" : "bg-slate-50/80 dark:bg-zinc-900/65",
                      "hover:bg-slate-100/80 dark:hover:bg-zinc-800/70"
                    )}
                  >
                    {/* Task row without pause button - will be added to modal instead */}
                    <button
                      onClick={() => onTaskClick(task)}
                      className={cn(
                        "flex-1 text-sm truncate text-foreground/90 font-medium text-left hover:text-primary hover:underline cursor-pointer",
                        task.is_paused && "line-through"
                      )}
                      title={`${task.title} (click to view details)`}
                    >
                      {task.title}
                    </button>
                    {/* Duration type indicator */}
                    {task.duration_type === 'continuous' && (
                      <Badge variant="outline" className="text-[8px] px-1 py-0 h-3 opacity-60 font-medium bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/35">
                        M
                      </Badge>
                    )}
                    {task.is_paused && (
                      <Badge variant="outline" className="text-[8px] px-1 py-0 h-3 font-medium bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/35">
                        ⏸
                      </Badge>
                    )}
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[9px] px-1 py-0 h-3.5 font-semibold",
                        task.priority === 'high' && "bg-red-100 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/35",
                        task.priority === 'medium' && "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/35",
                        task.priority === 'low' && "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/35"
                      )}
                    >
                      {task.priority[0].toUpperCase()}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Right: Calendar Grid - reduced cell width */}
          <div className="flex-1 overflow-x-auto">
            <div className="matrix-scroll" style={{ minWidth: `${daysInMonth.length * 28}px` }}>
              {/* Header: Week numbers + Dates */}
              <div className="bg-slate-50/50 dark:bg-zinc-900/65">
                {/* Week numbers row */}
                <div className="flex h-5">
                  {weekGroups.map((group, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-center text-xs text-muted-foreground/60 font-medium"
                      style={{ width: `${group.days.length * 28}px` }}
                    >
                      W{group.weekNum}
                    </div>
                  ))}
                </div>
                
                {/* Day names + dates row */}
                <div className="flex h-6">
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
                          "text-[11px] leading-none",
                          isCurrentDay ? "text-sky-600 dark:text-sky-400 font-bold" : "text-muted-foreground/50"
                        )}>{dayNames[getDay(day)]}</span>
                        <span className={cn(
                          "text-[11px] leading-none mt-0 font-medium",
                          isCurrentDay ? "text-sky-600 dark:text-sky-400 font-bold" : "text-muted-foreground/70"
                        )}>{format(day, 'd')}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              
              {/* Task rows with checkboxes - aligned to checkbox column */}
              <div>
                {sortedTasks.map((task, taskIndex) => (
                  <div key={task.id} className="flex h-7">
                    {daysInMonth.map((day, dayIndex) => {
                      const dateStr = format(day, 'yyyy-MM-dd')
                      const progress = getTaskDayProgress(task, day)
                      const isCurrentDay = isToday(day)
                      const isWeekend = getDay(day) === 0 || getDay(day) === 6
                      const taskCreatedDay = startOfDay(safeParseDate(task.created_at))
                      const dayStart = startOfDay(day)
                      const todayStart = startOfDay(new Date())
                      const yesterdayStart = startOfDay(subDays(todayStart, 1))
                      
                      const isBeforeCreation = dayStart.getTime() < taskCreatedDay.getTime()
                      const isYesterday = isSameDay(dayStart, yesterdayStart)
                      
                      // For CHECKBOX MODE: 
                      // 1. Only Today and Yesterday (1 day before today) are clickable/editable
                      // 2. All other past days must be read-only
                      // 3. Future dates must not be clickable
                      // 4. Dates before task creation must not be clickable
                      // 5. Task being paused disables editing
                      const isAllowedDay = isCurrentDay || isYesterday
                      const isDisabled = !isAllowedDay || isBeforeCreation || task.is_paused === true
                      
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
                            disabled={isDisabled}
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
        <div className="px-4 py-2 bg-slate-50/80 dark:bg-zinc-900/75 flex items-center justify-center gap-4">
          {PROGRESS_LEVELS.map((level) => (
            <div key={level.value} className="flex items-center gap-1.5">
              <div className={cn(
                "w-3 h-3 rounded",
                level.value === 0 ? "bg-rose-500/90" :
                level.value === 25 ? "bg-slate-400/90" :
                level.value === 50 ? "bg-amber-500/90" :
                level.value === 75 ? "bg-emerald-400/90" :
                "bg-emerald-600"
              )} />
              <span className="text-sm text-muted-foreground/70 font-medium">{level.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-zinc-300/70 dark:bg-zinc-600/50" />
            <span className="text-sm text-muted-foreground/70 font-medium">Empty</span>
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
  disabled?: boolean
}> = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false)
  const [localValue, setLocalValue] = useState(value)
  
  // Sync local value with prop when it changes from parent
  useEffect(() => {
    setLocalValue(value)
  }, [value])
  
  const getCheckboxStyle = (val: number) => {
    // Empty state - distinct grayish color that's clearly visible
    if (val < 0) return "bg-zinc-300/70 dark:bg-zinc-700/70 hover:bg-zinc-400/70 dark:hover:bg-zinc-600/80"
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

  if (disabled) {
    return (
      <div
        className={cn(
          "w-4 h-4 rounded-sm cursor-not-allowed pointer-events-none ring-1 ring-border/60",
          getCheckboxStyle(localValue)
        )}
      />
    )
  }
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "w-4 h-4 rounded-sm transition-all duration-100 hover:scale-110 cursor-pointer shadow-sm",
            getCheckboxStyle(localValue)
          )}
          aria-label="How much work done?"
        />
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2 bg-white dark:bg-zinc-900 shadow-xl rounded-lg border border-border/60" align="center" side="bottom" sideOffset={6}>
        <div className="space-y-1">
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-border/50">
            <span className="text-xs font-medium text-muted-foreground">How much work done?</span>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/70 hover:text-primary cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs p-3">
                  <div className="space-y-2 text-xs">
                    <p><strong>0% (Skipped):</strong> No work completed; excluded from completion.</p>
                    <p><strong>25% complete:</strong> Started with initial progress.</p>
                    <p><strong>50% complete:</strong> Roughly half of the work is done.</p>
                    <p><strong>75% complete:</strong> Most work finished; final steps remain.</p>
                    <p><strong>100% complete:</strong> Task fully completed.</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {PROGRESS_LEVELS.map((level) => (
            <button
              key={level.value}
              onClick={() => handleSelect(level.value as ProgressValue)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition-colors",
                localValue === level.value ? "bg-secondary dark:bg-zinc-800" : "hover:bg-secondary/70 dark:hover:bg-zinc-800/70"
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
  onTaskClick: (task: Task) => void
}> = React.memo(({ tasks, onProgressChange, onTaskClick }) => {
  return (
    <CalendarMatrixView
      tasks={tasks}
      onProgressChange={onProgressChange}
      onTaskClick={onTaskClick}
    />
  )
})

// Task Analytics Charts - Enhanced
const TaskAnalytics: React.FC<{ dayKey: string }> = React.memo(({ dayKey }) => {
  // Daily Activity section has independent month navigation
  const [selectedDailyActivityMonth, setSelectedDailyActivityMonth] = useState(new Date())
  // Previous Months Progress section has independent year navigation
  const [selectedMonthHistoryYear, setSelectedMonthHistoryYear] = useState(new Date().getFullYear())
  const previousDayKeyRef = useRef(dayKey)

  useEffect(() => {
    const previousDayKey = previousDayKeyRef.current
    if (previousDayKey === dayKey) return

    const prevParts = safeToDayKeyParts(previousDayKey)
    const currParts = safeToDayKeyParts(dayKey)
    if (!prevParts || !currParts) {
      previousDayKeyRef.current = dayKey
      return
    }
    const [prevYear, prevMonth, prevDay] = prevParts
    const [currYear, currMonth, currDay] = currParts

    if (!prevYear || !prevMonth || !prevDay || !currYear || !currMonth || !currDay) {
      previousDayKeyRef.current = dayKey
      return
    }

    const previousDate = new Date(prevYear, prevMonth - 1, prevDay, 0, 0, 0, 0)
    const currentDate = new Date(currYear, currMonth - 1, currDay, 0, 0, 0, 0)
    const previousMonthStart = startOfMonth(previousDate)
    const currentMonthStart = startOfMonth(currentDate)

    if (
      previousMonthStart.getTime() !== currentMonthStart.getTime() &&
      startOfMonth(selectedDailyActivityMonth).getTime() === previousMonthStart.getTime()
    ) {
      setSelectedDailyActivityMonth(currentMonthStart)
    }

    previousDayKeyRef.current = dayKey
  }, [dayKey, selectedDailyActivityMonth])

  const { data: rollingTrendSnapshot } = useQuery<TaskAnalyticsChartSnapshot>({
    queryKey: ['task-analytics-chart-rolling', dayKey],
    queryFn: () => database.getTaskAnalyticsChartSnapshot(new Date()),
    staleTime: 30 * 1000,
  })
  
  // Fetch analytics data for Daily Activity section (independent month) - Real historical task data
  const { data: dailyActivitySnapshot } = useQuery<TaskAnalyticsChartSnapshot>({
    queryKey: ['task-analytics-chart-daily-activity', format(selectedDailyActivityMonth, 'yyyy-MM'), dayKey],
    queryFn: () => database.getTaskAnalyticsChartSnapshot(selectedDailyActivityMonth),
    staleTime: 30 * 1000,
  })
  
  // Fetch analytics data for Consistency section (current year only)
  const { data: analyticsSnapshot } = useQuery<TaskAnalyticsChartSnapshot>({
    queryKey: ['task-analytics-chart-consistency', dayKey],
    queryFn: () => database.getTaskAnalyticsChartSnapshot(new Date()),
    staleTime: 30 * 1000,
  })

  const { data: previousMonthsHistory = [] } = useQuery<TaskMonthlyHistoryPoint[]>({
    queryKey: ['task-monthly-history', dayKey],
    queryFn: () => database.getTaskMonthlyHistory(),
    staleTime: 60 * 1000,
  })

  const monthlyData = rollingTrendSnapshot?.monthlyTrend || []
  const dailyData = dailyActivitySnapshot?.dailyActivity || []
  const heatmapData = analyticsSnapshot?.heatmap || []

  const dailyActivityMonthLabel = useMemo(() => {
    return format(selectedDailyActivityMonth, 'MMMM yyyy')
  }, [selectedDailyActivityMonth])

  const canNavigateToPreviousDailyActivityMonth = useMemo(() => {
    // Allow navigation up to 12 months back for Daily Activity
    const twelveMonthsAgo = subMonths(new Date(), 12)
    return startOfMonth(selectedDailyActivityMonth) > startOfMonth(twelveMonthsAgo)
  }, [selectedDailyActivityMonth])

  const canNavigateToNextDailyActivityMonth = useMemo(() => {
    // Can't navigate beyond current month for Daily Activity
    return startOfMonth(selectedDailyActivityMonth) < startOfMonth(new Date())
  }, [selectedDailyActivityMonth])

  // Y-axis dynamically adjusts per month based on highest daily weight in that specific month
  const dailyMaxWeight = useMemo(() => {
    if (!dailyData || dailyData.length === 0) {
      return 4
    }
    const maxPlanned = dailyData.reduce((max, point) => Math.max(max, point.updates || 0), 0)
    // Ensure minimum scale of 4, add 1 to provide visual headroom
    return Math.max(4, Math.ceil(maxPlanned + 1))
  }, [dailyData])

  // Filter previous months history to only show selected year
  const filteredMonthlyHistory = useMemo(() => {
    return previousMonthsHistory.filter((month) => {
      const monthYear = parseInt(month.monthKey.split('-')[0], 10)
      return monthYear === selectedMonthHistoryYear
    })
  }, [previousMonthsHistory, selectedMonthHistoryYear])

  const canNavigateToPreviousYear = useMemo(() => {
    // Get earliest year from all historical data
    if (previousMonthsHistory.length === 0) return false
    const earliestYear = Math.min(...previousMonthsHistory.map(m => parseInt(m.monthKey.split('-')[0], 10)))
    return selectedMonthHistoryYear > earliestYear
  }, [selectedMonthHistoryYear, previousMonthsHistory])

  const canNavigateToNextYear = useMemo(() => {
    // Can't navigate beyond current year
    const currentYear = new Date().getFullYear()
    return selectedMonthHistoryYear < currentYear
  }, [selectedMonthHistoryYear])

  const monthlyTotalEarned = useMemo(() => {
    return monthlyData.reduce((sum, point) => sum + point.completed, 0)
  }, [monthlyData])

  const monthlyTotalPlanned = useMemo(() => {
    return monthlyData.reduce((sum, point) => sum + point.total, 0)
  }, [monthlyData])

  const dailyTotalEarned = useMemo(() => {
    return dailyData.reduce((sum, point) => sum + point.completed, 0)
  }, [dailyData])

  const dailyTotalPlanned = useMemo(() => {
    return dailyData.reduce((sum, point) => sum + point.updates, 0)
  }, [dailyData])

  const heatmapDateMap = useMemo(() => {
    const dateMap = new Map<string, string>()
    if (!analyticsSnapshot?.heatmapStartDate) return dateMap
    
    const start = safeParseDate(`${analyticsSnapshot.heatmapStartDate}T00:00:00`)
    for (let weekIndex = 0; weekIndex < heatmapData.length; weekIndex++) {
      const week = heatmapData[weekIndex]
      for (let dayIndex = 0; dayIndex < week.length; dayIndex++) {
        const date = new Date(start)
        date.setDate(start.getDate() + (weekIndex * 7) + dayIndex)
        const dateKey = format(date, 'MMM dd, yyyy')
        dateMap.set(`${weekIndex}-${dayIndex}`, dateKey)
      }
    }
    return dateMap
  }, [heatmapData, analyticsSnapshot?.heatmapStartDate])

  const heatmapCellSize = 12
  const heatmapGap = 4

  const heatmapMonthLabels = useMemo(() => {
    if (!analyticsSnapshot?.heatmapStartDate || heatmapData.length === 0) return [] as Array<{ index: number; label: string }>

    const labels: Array<{ index: number; label: string }> = []
    const start = safeParseDate(`${analyticsSnapshot.heatmapStartDate}T00:00:00`)
    const seenMonths = new Set<string>()

    for (let weekIndex = 0; weekIndex < heatmapData.length; weekIndex++) {
      const weekDate = new Date(start)
      weekDate.setDate(start.getDate() + (weekIndex * 7))

      if (weekDate.getFullYear() !== analyticsSnapshot.heatmapYear) continue

      const monthKey = format(weekDate, 'MMM')
      if (!seenMonths.has(monthKey)) {
        seenMonths.add(monthKey)
        labels.push({ index: weekIndex, label: monthKey })
      }
    }

    return labels
  }, [analyticsSnapshot?.heatmapStartDate, analyticsSnapshot?.heatmapYear, heatmapData])

  const heatmapLabelByIndex = useMemo(
    () => new Map(heatmapMonthLabels.map(label => [label.index, label.label])),
    [heatmapMonthLabels],
  )

  const heatmapColumnTemplate = useMemo(() => {
    return `34px repeat(${Math.max(heatmapData.length, 1)}, ${heatmapCellSize}px)`
  }, [heatmapData.length])

  const heatmapRowTemplate = `repeat(7, ${heatmapCellSize}px)`
  
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <TrendingUp className="h-4 w-4 text-amber-500" />
              Progress Trend
            </CardTitle>
            <div className="text-xs font-medium text-muted-foreground">Rolling 30 days</div>
          </div>
          <CardDescription className="text-sm">Daily weight completion score • rolling earned/planned trend</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 pb-6 px-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground">Earned / Planned Weight:</div>
            <div className="text-sm font-semibold">{Math.round(monthlyTotalEarned * 10) / 10} / {Math.round(monthlyTotalPlanned * 10) / 10}</div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 5, right: 12, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="dateKey" className="text-xs" tickFormatter={(value) => String(value).slice(8, 10)} />
                <YAxis domain={[0, 100]} className="text-xs" />
                <RechartsTooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0]?.payload
                      return (
                        <div className="rounded-lg border bg-popover p-3 shadow-lg">
                          <p className="font-semibold text-sm mb-2">{data?.fullMonth}</p>
                          <div className="flex items-center justify-between gap-4 text-sm">
                            <span className="text-muted-foreground">Progress:</span>
                            <span className="font-bold">{data?.completionRate}%</span>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="completionRate" 
                  name="Completion Rate (%)"
                  stroke="#22c55e" 
                  fill="#22c55e" 
                  fillOpacity={0.4}
                  isAnimationActive={true}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BarChart3 className="h-4 w-4 text-green-500" />
              Daily Activity
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSelectedDailyActivityMonth(prev => subMonths(prev, 1))}
                disabled={!canNavigateToPreviousDailyActivityMonth}
                title="View previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-32 text-center">
                <button
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
                >
                  {dailyActivityMonthLabel}
                </button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSelectedDailyActivityMonth(prev => addMonths(prev, 1))}
                disabled={!canNavigateToNextDailyActivityMonth}
                title="View next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSelectedDailyActivityMonth(startOfMonth(new Date()))}
                title="Go to current month"
              >
                <Calendar className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardDescription className="text-sm">{dailyActivityMonthLabel || 'Current month'} • earned/planned weight by day</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 pb-6 px-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground">Month Total:</div>
            <div className="text-sm font-semibold">{Math.round(dailyTotalEarned * 10) / 10} / {Math.round(dailyTotalPlanned * 10) / 10}</div>
          </div>
          <div className="h-48 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
            <div style={{ minWidth: `${Math.max(dailyData.length * 28, 900)}px`, height: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 5, right: 12, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, dailyMaxWeight]} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '10px',
                    }}
                    formatter={(value: any, name: any) => {
                      if (name === 'completed') return [`${Math.round(value * 100) / 100}`, 'Earned Weight']
                      if (name === 'updates') return [`${Math.round(value * 100) / 100}`, 'Planned Weight']
                      return value
                    }}
                    labelFormatter={(_label: any, payload: any) => {
                      const point = payload?.[0]?.payload
                      if (!point) return ''
                      return `${point.dateKey} • ${point.progress}% progress`
                    }}
                  />
                  <Bar 
                    dataKey="completed" 
                    fill="hsl(142 76% 36%)" 
                    radius={[3, 3, 0, 0]}
                    name="completed"
                  >
                    <LabelList
                      dataKey="completed"
                      position="top"
                      content={(props: any) => {
                        const { x, y, index } = props
                        const point = typeof index === 'number' ? dailyData[index] : undefined
                        if (!point) return null
                        const earned = Math.round(point.completed * 10) / 10
                        const planned = Math.round(point.updates * 10) / 10
                        return (
                          <text
                            x={(x || 0) + 10}
                            y={(y || 0) - 10}
                            textAnchor="middle"
                            fontSize={8}
                            fill="hsl(var(--foreground))"
                            fontWeight="500"
                          >
                            {`${earned}/${planned}`}
                          </text>
                        )
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Activity className="h-4 w-4 text-orange-500" />
            Consistency
          </CardTitle>
          <CardDescription className="text-sm">{analyticsSnapshot?.heatmapYear || new Date().getFullYear()} • weighted activity intensity (0-5 scale)</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 pb-6 px-6">
          <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
            <div className="min-w-max p-2">
              <div
                className="grid mb-3 items-end"
                style={{ gridTemplateColumns: heatmapColumnTemplate, columnGap: `${heatmapGap}px` }}
              >
                <div />
                {heatmapData.map((_week, weekIndex) => (
                  <div
                    key={`month-${weekIndex}`}
                    className="text-[11px] leading-none text-muted-foreground font-medium text-center"
                  >
                    {heatmapLabelByIndex.get(weekIndex) || ''}
                  </div>
                ))}
              </div>

              <div
                className="grid items-start"
                style={{ gridTemplateColumns: heatmapColumnTemplate, columnGap: `${heatmapGap}px` }}
              >
                <div
                  className="grid text-[11px] text-muted-foreground font-medium pr-1"
                  style={{ gridTemplateRows: heatmapRowTemplate, rowGap: `${heatmapGap}px` }}
                >
                  <span className="flex items-center justify-end">Sun</span>
                  <span className="flex items-center justify-end">Mon</span>
                  <span className="flex items-center justify-end">Tue</span>
                  <span className="flex items-center justify-end">Wed</span>
                  <span className="flex items-center justify-end">Thu</span>
                  <span className="flex items-center justify-end">Fri</span>
                  <span className="flex items-center justify-end">Sat</span>
                </div>

                {heatmapData.map((week, weekIndex) => (
                  <div
                    key={weekIndex}
                    className="grid"
                    style={{ gridTemplateRows: heatmapRowTemplate, rowGap: `${heatmapGap}px` }}
                  >
                    {week.map((intensity, dayIndex) => {
                      const dateKey = `${weekIndex}-${dayIndex}`
                      const dateLabel = heatmapDateMap.get(dateKey)
                      const intensityLabel = intensity === 0 ? 'No activity' : `${intensity} intensity`
                      return (
                        <TooltipProvider key={dateKey}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "rounded-sm transition-all hover:shadow-sm hover:ring-1 hover:ring-offset-1 cursor-help",
                                  intensity === 0 && "bg-slate-200 dark:bg-slate-700 hover:ring-slate-400",
                                  intensity === 1 && "bg-green-100 dark:bg-green-900 hover:ring-green-400",
                                  intensity === 2 && "bg-green-300 dark:bg-green-700 hover:ring-green-400",
                                  intensity === 3 && "bg-green-400 dark:bg-green-600 hover:ring-green-500",
                                  intensity === 4 && "bg-green-500 dark:bg-green-500 hover:ring-green-600",
                                  intensity >= 5 && "bg-green-600 dark:bg-green-400 hover:ring-green-700",
                                )}
                                style={{ width: `${heatmapCellSize}px`, height: `${heatmapCellSize}px` }}
                              />
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">
                              <p>{dateLabel}</p>
                              <p className="font-semibold">{intensityLabel}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )
                    })}
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground font-medium">
                <span>Less</span>
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 3, 4, 5].map((intensity) => (
                    <div
                      key={`legend-${intensity}`}
                      className={cn(
                        "rounded-sm",
                        intensity === 0 && "bg-slate-200 dark:bg-slate-700",
                        intensity === 1 && "bg-green-100 dark:bg-green-900",
                        intensity === 2 && "bg-green-300 dark:bg-green-700",
                        intensity === 3 && "bg-green-400 dark:bg-green-600",
                        intensity === 4 && "bg-green-500 dark:bg-green-500",
                        intensity >= 5 && "bg-green-600 dark:bg-green-400",
                      )}
                      style={{ width: `${heatmapCellSize}px`, height: `${heatmapCellSize}px` }}
                    />
                  ))}
                </div>
                <span>More</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Calendar className="h-4 w-4 text-blue-500" />
              Previous Months Progress
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSelectedMonthHistoryYear(prev => prev - 1)}
                disabled={!canNavigateToPreviousYear}
                title="View previous year"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-16 text-center">
                <button
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
                  title={`Viewing ${selectedMonthHistoryYear}`}
                >
                  {selectedMonthHistoryYear}
                </button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSelectedMonthHistoryYear(prev => prev + 1)}
                disabled={!canNavigateToNextYear}
                title="View next year"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSelectedMonthHistoryYear(new Date().getFullYear())}
                title="Go to current year"
              >
                <Calendar className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardDescription className="text-sm">{selectedMonthHistoryYear} monthly performance with weighted completion metrics</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 pb-6 px-6">
          {filteredMonthlyHistory.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">No data available for {selectedMonthHistoryYear}. Data will show after first month completes.</div>
          ) : (
            <div className="space-y-2">
              {filteredMonthlyHistory.map((month) => {
                const completionRate = month.completionRate || 0
                const completedCount = month.completionRate >= 100 ? month.total : Math.round((month.completionRate / 100) * month.total)
                const partiallyCompletedCount = Math.max(0, month.total - completedCount)
                const skippedCount = month.total > 0 ? Math.max(0, month.total - (month.completed || 0) - partiallyCompletedCount) : 0
                
                return (
                  <div 
                    key={month.monthKey} 
                    className="rounded border bg-card hover:bg-muted/50 transition-colors p-3"
                  >
                    {/* Month Header with Completion Badge */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{month.monthLabel}</span>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs font-semibold",
                            completionRate >= 80 && "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300",
                            completionRate >= 60 && completionRate < 80 && "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300",
                            completionRate < 60 && "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300"
                          )}
                        >
                          {completionRate}%
                        </Badge>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        Weight: <span className="font-medium text-foreground">{Math.round(month.earnedWeight * 10) / 10}/{Math.round(month.plannedWeight * 10) / 10}</span>
                      </div>
                    </div>

                    {/* Data Grid */}
                    <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground font-medium mb-0.5">Total</span>
                        <span className="font-semibold text-sm">{month.total}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-muted-foreground font-medium mb-0.5">Completed</span>
                        <span className="font-semibold text-sm text-emerald-600 dark:text-emerald-400">{month.completed}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-muted-foreground font-medium mb-0.5">Skipped</span>
                        <span className="font-semibold text-sm text-red-600 dark:text-red-400">{skippedCount}</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all",
                          completionRate >= 80 ? "bg-emerald-500" :
                          completionRate >= 60 ? "bg-amber-500" :
                          "bg-red-500"
                        )}
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
})

// Task Item Component with Progressive Completion
const TaskItem: React.FC<{
  task: Task
  goals: any[]
  expanded: boolean
  onToggleExpand: () => void
  onProgressChange: (progress: ProgressValue) => void
  onEdit: () => void
  onDelete: () => void
  onOpenDetails: () => void
  onPauseToggle?: (isPaused: boolean) => void
  readonly?: boolean
  hideActions?: boolean
  allowProgressEditWhenPaused?: boolean
}> = ({ task, goals, expanded, onToggleExpand, onProgressChange, onEdit, onDelete, onOpenDetails, onPauseToggle, readonly = false, hideActions = false, allowProgressEditWhenPaused = false }) => {
  const progress = task.progress ?? 0
  const displayProgress = (task.status ?? 'pending') === 'pending' && progress === 0 ? -1 : progress
  const isCompleted = task.status === 'completed' || progress === 100
  const isInteractionLocked = readonly || (task.is_paused && !allowProgressEditWhenPaused)

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
      <Card interactive className={cn(
        "transition-all duration-300",
        isCompleted && "bg-muted/30 dark:bg-muted/20"
      )}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            {/* Progress Selector */}
            <div className="mt-1">
              <CircularProgressSelector
                value={(task.progress || 0) as ProgressValue}
                onChange={isInteractionLocked ? () => {} : onProgressChange}
                size="md"
                showPercentage={(task.progress || 0) > 0}
                disabled={isInteractionLocked}
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
                    isCompleted && "line-through text-muted-foreground",
                    task.is_paused && "line-through text-muted-foreground"
                  )}>
                    {task.title}
                  </h3>
                  {task.is_paused && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs h-5">
                      ⏸ Paused
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline"
                    className={cn(
                      "capitalize",
                      task.priority === 'high' && "bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20",
                      task.priority === 'medium' && "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20",
                      task.priority === 'low' && "bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20"
                    )}
                  >
                    {task.priority}
                  </Badge>

                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      task.duration_type === 'today' && "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20",
                      task.duration_type === 'continuous' && "bg-purple-500/10 text-purple-600 border-purple-500/20 hover:bg-purple-500/20"
                    )}
                  >
                    {task.duration_type === 'today' ? 'Today-only' : 'Continuous'}
                  </Badge>
                  
                  {/* Progress Badge */}
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "transition-colors duration-300",
                      getProgressTextColor(task.progress || 0),
                      isCompleted && "bg-green-500/10"
                    )}
                  >
                    {task.progress || 0}%
                  </Badge>

                  <div className="flex items-center gap-1">
                    {!readonly && !hideActions && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-primary/10"
                          onClick={onEdit}
                          aria-label="Edit task"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {/* Pause/Resume Button - Icon only, for Continuous Tasks */}
                        {task.duration_type === 'continuous' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onPauseToggle?.(!task.is_paused)
                                  }}
                                >
                                  {task.is_paused ? (
                                    <Play className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <Pause className="h-4 w-4 text-amber-600" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="w-56 p-3">
                                <div className="space-y-2">
                                  {task.is_paused ? (
                                    <>
                                      <p className="font-semibold text-green-600 flex items-center gap-1">
                                        <Play className="h-4 w-4" />
                                        Resume Task
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Click to resume tracking progress. Task will start counting toward daily progress.
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="font-semibold text-amber-600 flex items-center gap-1">
                                        <Pause className="h-4 w-4" />
                                        Pause Task
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Progress will be frozen ❄️ and won't count toward daily goals, analytics, or statistics.
                                      </p>
                                      <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                                        Resume later to continue tracking.
                                      </p>
                                    </>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-orange-600 hover:bg-orange-500/10 hover:text-orange-600"
                          onClick={onDelete}
                          aria-label="Archive task"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
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
                        {task.due_date && task.duration_type !== 'continuous' && (
                          <div className="flex items-center">
                            <Calendar className="mr-1 h-3 w-3" />
                            Due: {format(safeParseDate(task.due_date), 'MMM d, yyyy')}
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
                      
                      {/* Quick Progress Selector in expanded view - starts empty if no progress */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Quick progress:</span>
                          <ProgressSelector
                            value={displayProgress as ProgressValue}
                            onChange={isInteractionLocked ? () => {} : onProgressChange}
                            size="md"
                            showLabel={false}
                            disabled={isInteractionLocked}
                          />
                          <span className={cn("text-sm font-medium", displayProgress === -1 ? "text-muted-foreground" : getProgressTextColor(progress))}>
                            {displayProgress === -1 ? 'Not set' : getProgressLabel(progress)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={onOpenDetails}
                          className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline transition-colors"
                        >
                          Details
                        </button>
                      </div>
                      
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {task.tags.map((tag: string) => (
                            <Badge key={tag} variant="outline" className="text-xs bg-purple-500/10 text-purple-700 border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/40">
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
  const { tasks, goals, addTask, updateTask, archiveTask, deleteTask } = useStore(
    (state) => ({
      tasks: state.tasks,
      goals: state.goals,
      addTask: state.addTask,
      updateTask: state.updateTask,
      archiveTask: state.archiveTask,
      deleteTask: state.deleteTask,
    }),
    shallow,
  )
  
  const [viewMode, setViewMode] = useState<'list' | 'checkbox'>('list')
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [taskDetailModal, setTaskDetailModal] = useState<Task | null>(null)
  const [taskToArchive, setTaskToArchive] = useState<Task | null>(null)
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    priority: 'medium',
    status: 'pending',
    estimated_time: '',
    goal_id: '',
    tags: [],
    duration_type: 'today', // Default to today-only
  })
  
  const [newTag, setNewTag] = useState('')
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [dayKey, setDayKey] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [showYesterdayTasks, setShowYesterdayTasks] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      const nextDayKey = format(new Date(), 'yyyy-MM-dd')
      setDayKey((prev) => (prev === nextDayKey ? prev : nextDayKey))
    }, 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    // In list view mode, only show today's and yesterday's tasks using daily reset logic
    if (viewMode === 'list') {
      const todaysTasks = getTodaysTasks(tasks)
      const yesterdaysTasks = getYesterdaysTasks(tasks)
      return [...todaysTasks, ...yesterdaysTasks].sort((a, b) => {
        // Sort by due date if available, otherwise by created date
        const aDate = a.due_date ? safeParseDate(a.due_date) : safeParseDate(a.created_at)
        const bDate = b.due_date ? safeParseDate(b.due_date) : safeParseDate(b.created_at)
        return aDate.getTime() - bDate.getTime()
      })
    }
    
    // In calendar/checkbox view, show non-deleted tasks
    // - Continuous tasks always visible
    // - Today-only tasks only visible on their creation day
    const todayDay = startOfDay(new Date())
    return tasks
      .filter(task => !task.deleted_at)
      .filter(task => {
        if (task.duration_type === 'today') {
          const taskCreatedAt = startOfDay(safeParseDate(task.created_at))
          return taskCreatedAt.getTime() === todayDay.getTime()
        }
        return true
      })
      .sort((a, b) => {
        // Sort: continuous tasks first, then by creation date
        if (a.duration_type === 'continuous' && b.duration_type !== 'continuous') return -1
        if (a.duration_type !== 'continuous' && b.duration_type === 'continuous') return 1
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      })
  }, [tasks, viewMode, dayKey])

  // Group tasks by date - STRICTLY only Today's Tasks and Yesterday's Tasks for list mode
  // ⚠️ DATA INTEGRITY: This is visual grouping only
  // Removing tasks from "Yesterday's Tasks" display at midnight does NOT delete them
  // Tasks remain in database and are still counted in all statistics
  // Per final specification: Only two sections allowed (TODAY and YESTERDAY)
  // Uses centralized daily-reset logic as SINGLE SOURCE OF TRUTH for date-based filtering
  const tasksByDate = useMemo(() => {
    if (viewMode !== 'list') return {}
    
    // Use helper functions as single source of truth
    // This ensures consistent behavior across the app
    const todaysTasks = getTodaysTasks(tasks)
    const yesterdaysTasks = getYesterdaysTasks(tasks)
    
    const groups: Record<string, Task[]> = {}
    
    if (todaysTasks.length > 0) {
      groups["Today's Tasks"] = todaysTasks.sort((a, b) => {
        // Sort by due date if available, otherwise by created date
        const aDate = a.due_date ? safeParseDate(a.due_date) : safeParseDate(a.created_at)
        const bDate = b.due_date ? safeParseDate(b.due_date) : safeParseDate(b.created_at)
        return aDate.getTime() - bDate.getTime()
      })
    }
    
    if (yesterdaysTasks.length > 0) {
      groups["Yesterday's Tasks"] = yesterdaysTasks.sort((a, b) => {
        // Sort by due date if available, otherwise by created date
        const aDate = a.due_date ? safeParseDate(a.due_date) : safeParseDate(a.created_at)
        const bDate = b.due_date ? safeParseDate(b.due_date) : safeParseDate(b.created_at)
        return aDate.getTime() - bDate.getTime()
      })
    }
    
    return groups
  }, [tasks, viewMode, dayKey])

  const { data: statsSnapshot } = useQuery<TaskTabStatsSnapshot>({
    queryKey: ['task-stats', dayKey],
    queryFn: () => database.getTaskTabStats(),
    staleTime: 30 * 1000,
  })

  // Calculate statistics strictly from database snapshot
  const stats = useMemo(() => {
    const emptyPeriod = {
      total: 0,
      completed: 0,
      partially: 0,
      skipped: 0,
      plannedWeight: 0,
      earnedWeight: 0,
      weightedProgress: 0,
    }

    if (!statsSnapshot) {
      return {
        dailyProgress: 0,
        totalToday: 0,
        completedToday: 0,
        totalWeightToday: 0,
        currentWeightToday: 0,
        total: 0,
        completed: 0,
        partially: 0,
        skipped: 0,
        incomplete: 0,
        completionRate: 0,
        weightedProgress: 0,
        totalWeight: 0,
        completedWeight: 0,
        weeklyStats: emptyPeriod,
        weekDelta: 0,
        monthlyStats: emptyPeriod,
        monthDelta: 0,
      }
    }

    const weekDelta = statsSnapshot.weekly.weightedProgress - statsSnapshot.previousWeekly.weightedProgress
    const monthDelta = statsSnapshot.monthly.weightedProgress - statsSnapshot.previousMonthly.weightedProgress
    const total = statsSnapshot.health.total
    const completed = statsSnapshot.health.completed

    return {
      dailyProgress: statsSnapshot.today.weightedProgress,
      totalToday: statsSnapshot.today.total,
      completedToday: statsSnapshot.today.completed,
      totalWeightToday: statsSnapshot.today.plannedWeight,
      currentWeightToday: statsSnapshot.today.earnedWeight,
      total,
      completed,
      partially: statsSnapshot.health.partially,
      skipped: statsSnapshot.health.skipped,
      incomplete: Math.max(total - completed, 0),
      completionRate: statsSnapshot.health.weightedProgress,
      weightedProgress: statsSnapshot.health.weightedProgress,
      totalWeight: statsSnapshot.health.plannedWeight,
      completedWeight: statsSnapshot.health.earnedWeight,
      weeklyStats: statsSnapshot.weekly,
      weekDelta,
      monthlyStats: statsSnapshot.monthly,
      monthDelta,
    }
  }, [statsSnapshot])

  const invalidateTaskDerivedQueries = useCallback(() => {
    invalidateTaskRelatedQueries(queryClient)
  }, [queryClient])

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
        invalidateTaskDerivedQueries()
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
        invalidateTaskDerivedQueries()
      }
    },
    onError: () => toastError('Failed to update task'),
  })

  // Pause/Resume mutation for continuous tasks
  const pauseToggleMutation = useMutation({
    mutationFn: async ({ id, isPaused }: { id: string; isPaused: boolean }) => {
      const existingTask = tasks.find(task => task.id === id)
      const updates: Partial<Task> = {
        is_paused: isPaused,
      }
      if (existingTask) {
        const todayKey = format(new Date(), 'yyyy-MM-dd')
        const dailyProgress = normalizeDailyProgress(existingTask)
        const currentEntry = dailyProgress[todayKey]

        dailyProgress[todayKey] = {
          progress: (currentEntry?.progress ?? existingTask.progress ?? 0) as TaskProgress,
          status: (currentEntry?.status ?? existingTask.status ?? 'pending') as TaskStatus,
          recorded_at: new Date().toISOString(),
          source: isPaused ? 'paused' : 'user',
        }

        updates.daily_progress = dailyProgress
      }
      if (isPaused) {
        updates.paused_at = new Date().toISOString()
      }
      await database.updateTask(id, updates)
      const updatedTask = await database.getTaskById(id)
      return { updatedTask, isPaused }
    },
    onSuccess: ({ updatedTask, isPaused }) => {
      if (updatedTask) {
        updateTask(updatedTask)
        if (isPaused) {
          success('Task paused ⏸️ Progress frozen')
        } else {
          success('Task resumed ▶️')
        }
        invalidateTaskDerivedQueries()
      }
    },
    onError: () => toastError('Failed to toggle pause state'),
  })

  // NOTE: The conflicting per-page reset effect has been removed.
  // All daily reset logic is handled centrally by the useDailyReset() hook in App.tsx.
  // That hook snapshots daily_progress and resets continuous tasks at midnight.
  // Today-only tasks don't need resetting — they simply age out of getTodaysTasks().

  const updateProgressMutation = useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      // Get existing task to update daily_progress history
      const existingTask = await database.getTaskById(id)
      if (!existingTask) throw new Error('Task not found')

      const { updates } = buildTaskProgressUpdatePayload(existingTask as Task, progress)

      await database.updateTask(id, updates)
      const updatedTask = await database.getTaskById(id)
      return { updatedTask, progress }
    },
    onSuccess: ({ updatedTask, progress }) => {
      if (updatedTask) {
        updateTask(updatedTask)
        // Task is completed only at 100%
        if (progress === 100) {
          success('Task completed! 🎉🎊')
        }
        queryClient.invalidateQueries({ queryKey: ['review-insights'] })
        invalidateTaskDerivedQueries()
      }
    },
    onError: () => toastError('Failed to update progress'),
  })

  const updateDailyProgressMutation = useMutation({
    mutationFn: async ({ id, dailyProgress }: { id: string; dailyProgress: Record<string, DailyTaskState> }) => {
      await database.updateTask(id, { daily_progress: dailyProgress })
      const updatedTask = await database.getTaskById(id)
      return updatedTask
    },
    onSuccess: (updatedTask) => {
      if (updatedTask) {
        updateTask(updatedTask)
        queryClient.invalidateQueries({ queryKey: ['review-insights'] })
        invalidateTaskDerivedQueries()
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
      queryClient.invalidateQueries({ queryKey: ['review-insights'] })
      invalidateTaskDerivedQueries()
      success('Task archived. Progress history preserved.')
    },
    onError: () => toastError('Failed to archive task'),
  })

  // Permanent delete mutation - completely removes task and all its data
  const permanentDeleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      // Completely remove task and all associated data (checklist items, time blocks, notes, etc.)
      await database.permanentlyDeleteTask(id, { deleteHistory: true })
      return id
    },
    onSuccess: (id) => {
      deleteTask(id)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      queryClient.invalidateQueries({ queryKey: ['review-insights'] })
      invalidateTaskDerivedQueries()
      success('Task permanently deleted. All data removed.')
    },
    onError: () => toastError('Failed to permanently delete task'),
  })

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      due_date: format(new Date(), 'yyyy-MM-dd'),
      priority: 'medium',
      status: 'pending',
      estimated_time: '',
      goal_id: '',
      tags: [],
      duration_type: 'today',
    })
    setNewTag('')
  }

  useEffect(() => {
    const openCreateTask = () => {
      setIsEditing(null)
      resetForm()
      setIsCreating(true)
    }

    window.addEventListener('app:new-task', openCreateTask as EventListener)
    return () => window.removeEventListener('app:new-task', openCreateTask as EventListener)
  }, [])

  const handleEdit = (task: Task) => {
    setIsEditing(task.id)
    setIsCreating(true)
    setFormData({
      title: task.title,
      description: task.description || '',
      due_date: task.due_date ? format(safeParseDate(task.due_date), 'yyyy-MM-dd') : '',
      priority: task.priority,
      status: task.status,
      estimated_time: task.estimated_time?.toString() || '',
      goal_id: task.goal_id || '',
      tags: task.tags || [],
      duration_type: task.duration_type || 'today',
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
      status: 'pending', // Always start as pending - progress is set via progress selector
      progress: isEditing ? undefined : 0,
      duration_type: formData.duration_type,
      tags: formData.tags,
      estimated_time: formData.estimated_time ? parseInt(formData.estimated_time, 10) : undefined,
      goal_id: formData.goal_id || undefined,
      due_date: formData.due_date || undefined,
      is_paused: false, // Initialize as not paused for continuous tasks
    }

    if (isEditing) {
      updateTaskMutation.mutate({ id: isEditing, updates: taskData })
    } else {
      createTaskMutation.mutate(taskData)
    }
  }

  const handleMatrixProgressChange = useCallback((taskId: string, date: string, progress: ProgressValue) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    if (task.is_paused) return

    const taskCreatedDay = startOfDay(safeParseDate(task.created_at))
    const targetDay = startOfDay(safeParseDate(date))
    if (targetDay.getTime() < taskCreatedDay.getTime()) return

    // Derive proper status from progress value
    const status = progress >= 100 ? 'completed' : progress > 0 ? 'in-progress' : 'pending'
    const dailyProgress = recordDailyProgress(task, safeParseDate(date), progress as any, status, 'user')
    updateDailyProgressMutation.mutate({ id: taskId, dailyProgress })

    // For today's date, also update the live task progress/status
    if (isToday(safeParseDate(date))) {
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
          <div className="flex items-baseline gap-1.5">
            <h1 className="text-3xl font-bold">Tasks</h1>
            <ContextTipsDialog
              title="Task Tab Tips"
              description="Practical guidance for prioritization, progress tracking, overdue handling, and daily execution."
              sections={TASK_TIPS_SECTIONS}
              triggerLabel="Open task tips"
            />
          </div>
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
            <DialogContent className="max-w-2xl bg-card">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>{isEditing ? 'Edit Task' : 'Create New Task'}</DialogTitle>
                <DialogDescription>
                  Define your task with a clear title, description, and deadline.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto pr-2 -mr-2 scroll-smooth">
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Task Title
                      <span className="text-red-500 ml-1">*</span>
                    </label>
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
                      key={`task-description-${isEditing ?? 'new'}`}
                      placeholder="Add details, notes, or context..."
                      defaultValue={formData.description}
                      onBlur={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="bg-secondary/50 border-green-500/20 focus-visible:ring-green-500/50 dark:border-green-500/15"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Priority (Weight)</label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value: Task['priority']) => setFormData({ ...formData, priority: value })}
                      >
                        <SelectTrigger className="bg-secondary/50 border-green-500/20 focus:ring-green-500/50 dark:border-green-500/15">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                              High (Weight: 3)
                            </div>
                          </SelectItem>
                          <SelectItem value="medium">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-amber-500" />
                              Medium (Weight: 2)
                            </div>
                          </SelectItem>
                          <SelectItem value="low">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                              Low (Weight: 1)
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Duration Type *</label>
                      <Select
                        value={formData.duration_type}
                        onValueChange={(value: TaskDurationType) => {
                          // Clear due_date when switching to "today" type
                          if (value === 'today') {
                            setFormData({ ...formData, duration_type: value, due_date: '' })
                          } else {
                            setFormData({ ...formData, duration_type: value })
                          }
                        }}
                      >
                        <SelectTrigger className="bg-secondary/50 border-green-500/20 focus:ring-green-500/50 dark:border-green-500/15">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="today">Today Only</SelectItem>
                          <SelectItem value="continuous">Multi-day / Continuous</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={cn("text-sm font-medium", formData.duration_type === 'today' && "text-muted-foreground")}>Due Date</label>
                      <Input
                        type="date"
                        disabled={formData.duration_type === 'today'}
                        value={formData.due_date}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                        className={cn("bg-secondary/50 border-green-500/20 focus-visible:ring-green-500/50 dark:border-green-500/15", formData.duration_type === 'today' && "opacity-50 cursor-not-allowed")}
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
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Related Goal</label>
                    <Select
                      value={formData.goal_id || "none"}
                      onValueChange={(value: string) => setFormData({ ...formData, goal_id: value === "none" ? "" : value })}
                    >
                      <SelectTrigger className="bg-secondary/50 border-green-500/20 focus:ring-green-500/50 dark:border-green-500/15">
                        <SelectValue placeholder="Select a goal..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Goal</SelectItem>
                        {goals?.filter((g: any) => g.status === 'active').map((goal: any) => (
                          <SelectItem key={goal.id} value={goal.id}>
                            {goal.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                          <Badge key={tag} variant="outline" className="gap-1 bg-purple-500/10 text-purple-700 border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/40">
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
                }} className="bg-transparent dark:bg-transparent border-green-500/30 text-green-600 dark:text-green-300 hover:bg-green-500/10 hover:border-green-500/50 transition-colors duration-200">
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
            <CardTitle className="text-sm font-medium">Daily Progress</CardTitle>
            <Target className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className={cn("text-2xl font-bold", getProgressTextColor(stats.dailyProgress))}>
              {stats.dailyProgress}%
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>Total tasks</div>
              <div className="text-right">{stats.totalToday}</div>
              <div>Completed</div>
              <div className="text-right text-green-500">{stats.completedToday}</div>
              <div>Weight</div>
              <div className="text-right font-semibold">({Math.round(stats.currentWeightToday)}/{Math.round(stats.totalWeightToday)})</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className={cn("text-2xl font-bold", getProgressTextColor(stats.weeklyStats.weightedProgress))}>
              {stats.weeklyStats.weightedProgress}%
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Total Tasks</span>
                <span className="font-semibold text-foreground">{stats.weeklyStats.total}</span>
              </div>
              <div className="flex justify-between">
                <span>Completed</span>
                <span className="font-semibold text-green-500">{stats.weeklyStats.completed}</span>
              </div>
              <div className="flex justify-between">
                <span>Partially</span>
                <span className="font-semibold text-blue-500">{stats.weeklyStats.partially}</span>
              </div>
              <div className="flex justify-between">
                <span>Skipped</span>
                <span className="font-semibold text-red-500">{stats.weeklyStats.skipped}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>Weight (earned/planned)</span>
                <span className="font-semibold text-purple-500">
                  {Math.round(stats.weeklyStats.earnedWeight)}/{Math.round(stats.weeklyStats.plannedWeight)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Progress</CardTitle>
            <Calendar className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className={cn("text-2xl font-bold", getProgressTextColor(stats.monthlyStats.weightedProgress))}>
              {stats.monthlyStats.weightedProgress}%
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Total Tasks</span>
                <span className="font-semibold text-foreground">{stats.monthlyStats.total}</span>
              </div>
              <div className="flex justify-between">
                <span>Completed</span>
                <span className="font-semibold text-green-500">{stats.monthlyStats.completed}</span>
              </div>
              <div className="flex justify-between">
                <span>Partially</span>
                <span className="font-semibold text-blue-500">{stats.monthlyStats.partially}</span>
              </div>
              <div className="flex justify-between">
                <span>Skipped</span>
                <span className="font-semibold text-red-500">{stats.monthlyStats.skipped}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>Weight (earned/planned)</span>
                <span className="font-semibold text-purple-500">
                  {Math.round(stats.monthlyStats.earnedWeight)}/{Math.round(stats.monthlyStats.plannedWeight)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Task Health</CardTitle>
            <CheckSquare className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold text-purple-500">{stats.completionRate}%</div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Total Tasks</span>
                <span className="font-semibold text-foreground">{stats.total}</span>
              </div>
              <div className="flex justify-between">
                <span>Completed</span>
                <span className="font-semibold text-green-500">{stats.completed}</span>
              </div>
              <div className="flex justify-between">
                <span>Partially</span>
                <span className="font-semibold text-blue-500">{stats.partially}</span>
              </div>
              <div className="flex justify-between">
                <span>Skipped</span>
                <span className="font-semibold text-red-500">{stats.skipped}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>Weight (earned/planned)</span>
                <span className="font-semibold text-purple-500">
                  {Math.round(stats.completedWeight)}/{Math.round(stats.totalWeight)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Checkbox View */}
      {viewMode === 'checkbox' && (
        <CheckboxView
          tasks={filteredTasks}
          onProgressChange={handleMatrixProgressChange}
          onTaskClick={(task) => setTaskDetailModal(task)}
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
            
            /**
             * MIDNIGHT STATUS PRESERVATION
             * ============================
             * After 12:00 AM (local time):
             * 
             * 1. YESTERDAY SECTION:
             *    - Displays tasks with their PRESERVED status from yesterday
             *    - Reads progress from daily_progress[yesterday-date]
             *    - Shows final status (Skipped/25%/50%/75%/100%)
             *    - Fully editable (updates yesterday's daily_progress)
             * 
             * 2. TODAY SECTION:
             *    - Continuous/multi-day tasks REAPPEAR with progress reset to 0
             *    - Today-only tasks do NOT appear if created yesterday
             *    - Progress updates go to daily_progress[today-date] AND task.progress
             * 
             * This ensures:
             *    - No loss of completion data
             *    - Daily task history is date-scoped
             *    - Analytics read from preserved daily status
             */
            const isYesterdaySection = group === "Yesterday's Tasks"
            const displayDate = isYesterdaySection ? (() => {
              const yesterday = new Date()
              yesterday.setDate(yesterday.getDate() - 1)
              return yesterday
            })() : new Date()
            const displayDateStr = format(displayDate, 'yyyy-MM-dd')
            
            return (
            <div key={group} className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  {group} 
                  <Badge variant="outline" className="text-xs">
                    {tasks.length}
                  </Badge>
                  {isYesterdaySection && (
                    <ContextTipsDialog
                      title="Yesterday Section Guidance"
                      description="Use this section only for yesterday corrections so your timeline remains accurate."
                      sections={YESTERDAY_TIPS_SECTIONS}
                      triggerLabel="Open yesterday section guidance"
                    />
                  )}
                  {isYesterdaySection && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setShowYesterdayTasks(!showYesterdayTasks)}
                      aria-label={showYesterdayTasks ? "Hide yesterday tasks" : "Show yesterday tasks"}
                    >
                      {showYesterdayTasks ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </h2>
              </div>
              
              {isYesterdaySection && !showYesterdayTasks ? null : (
              <div className="space-y-2">
                {tasks.map((task: Task) => {
                  // For YESTERDAY section, create a display task with preserved progress
                  const displayTask = isYesterdaySection ? (() => {
                    const history = normalizeDailyProgress(task)
                    const yesterdayEntry = history[displayDateStr]
                    return {
                      ...task,
                      progress: getDailyProgress(task, displayDate) as ProgressValue,
                      is_paused: yesterdayEntry?.source === 'paused',
                    }
                  })() : task
                  
                  return (
                    <TaskItem
                      key={task.id}
                      task={displayTask}
                      goals={goals}
                      expanded={expandedTasks.has(task.id)}
                      onToggleExpand={() => toggleTaskExpanded(task.id)}
                      onProgressChange={(progress) => handleMatrixProgressChange(task.id, displayDateStr, progress)}
                      onEdit={() => handleEdit(task)}
                      onDelete={() => setTaskToArchive(task)}
                      onOpenDetails={() => setTaskDetailModal(task)}
                      onPauseToggle={(isPaused) => pauseToggleMutation.mutate({ id: task.id, isPaused })}
                      readonly={false}
                      hideActions={isYesterdaySection}
                      allowProgressEditWhenPaused={isYesterdaySection}
                    />
                  )
                })}
              </div>
              )}
            </div>
          )})
        )}
        </div>
      )}

      {/* Analytics Section */}
      <div className="animate-in fade-in slide-in-from-top-4 duration-300">
        <TaskAnalytics dayKey={dayKey} />
      </div>

      {/* Task Detail Modal */}
      <Dialog open={taskDetailModal !== null} onOpenChange={(open) => !open && setTaskDetailModal(null)}>
        <DialogContent className="max-w-lg bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              Task Details
            </DialogTitle>
          </DialogHeader>
          
          {taskDetailModal && (
            <div className="space-y-4 py-2">
              {/* Title and Status */}
              <div className="space-y-2">
                <h3 className={cn(
                  "text-lg font-semibold",
                  taskDetailModal.is_paused && "line-through text-muted-foreground"
                )}>
                  {taskDetailModal.title}
                </h3>
                
                <div className="flex flex-wrap items-center gap-2">
                  <Badge 
                    className={cn(
                      "font-semibold",
                      taskDetailModal.priority === 'high' && "bg-red-600 hover:bg-red-700",
                      taskDetailModal.priority === 'medium' && "bg-amber-600 hover:bg-amber-700",
                      taskDetailModal.priority === 'low' && "bg-blue-600 hover:bg-blue-700"
                    )}
                  >
                    {taskDetailModal.priority.toUpperCase()} PRIORITY
                  </Badge>
                  <Badge 
                    variant="outline"
                    className={cn(
                      taskDetailModal.duration_type === 'continuous' 
                        ? "bg-purple-50 text-purple-700 border-purple-200" 
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    )}
                  >
                    {taskDetailModal.duration_type === 'continuous' ? 'Multi-day' : 'Today-only'}
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className={cn(getProgressTextColor(taskDetailModal.progress || 0))}
                  >
                    {taskDetailModal.progress || 0}%
                  </Badge>
                  {taskDetailModal.is_paused && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      ⏸️ Paused
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Description */}
              {taskDetailModal.description && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <p className="text-sm bg-secondary/30 p-3 rounded-lg max-h-40 overflow-y-auto scroll-smooth">
                    {taskDetailModal.description}
                  </p>
                </div>
              )}
              
              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {taskDetailModal.due_date && taskDetailModal.duration_type !== 'continuous' && (
                  <div className="space-y-1">
                    <label className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Due Date
                    </label>
                    <p className="font-medium">{format(safeParseDate(taskDetailModal.due_date), 'MMM d, yyyy')}</p>
                  </div>
                )}
                
                {taskDetailModal.estimated_time && (
                  <div className="space-y-1">
                    <label className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Estimated Time
                    </label>
                    <p className="font-medium">{taskDetailModal.estimated_time} minutes</p>
                  </div>
                )}
                
                <div className="space-y-1">
                  <label className="text-muted-foreground">Created</label>
                  <p className="font-medium">{format(safeParseDate(taskDetailModal.created_at), 'MMM d, yyyy')}</p>
                </div>
                
                {taskDetailModal.goal_id && (
                  <div className="space-y-1">
                    <label className="text-muted-foreground flex items-center gap-1">
                      <Target className="h-3 w-3" /> Goal
                    </label>
                    <p className="font-medium">{goals.find(g => g.id === taskDetailModal.goal_id)?.title || 'Unknown'}</p>
                  </div>
                )}
              </div>
              
              {/* Tags */}
              {taskDetailModal.tags && taskDetailModal.tags.length > 0 && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Tags</label>
                  <div className="flex flex-wrap gap-1">
                    {taskDetailModal.tags.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-xs bg-purple-500/10 text-purple-700 border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/40">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* All-Time Progress (Aggregated across daily_progress) */}
              {taskDetailModal.duration_type === 'continuous' && taskDetailModal.daily_progress && Object.keys(taskDetailModal.daily_progress).length > 0 && (
                <div className="space-y-2 p-3 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <label className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    All-Time Progress
                  </label>
                  <div className="space-y-1">
                    {(() => {
                      const dailyProgress = taskDetailModal.daily_progress
                      const completedDays = Object.values(dailyProgress).filter((p: any) => p.progress === 100 || p.status === 'completed').length
                      const totalDays = Object.keys(dailyProgress).length
                      const avgProgress = Math.round(
                        Object.values(dailyProgress).reduce((sum: number, val: any) => sum + (val.progress || 0), 0) / totalDays
                      )
                      return (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Completed Days</span>
                            <span className="font-semibold text-green-600 dark:text-green-400">{completedDays} / {totalDays}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Average Progress</span>
                            <span className={cn("font-semibold", getProgressTextColor(avgProgress))}>{avgProgress}%</span>
                          </div>
                          <div className="mt-2 space-y-1">
                            <AnimatedProgressBar value={avgProgress as ProgressValue} height="sm" />
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>
              )}
              
              {/* Current Progress Bar */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Current Progress</label>
                <AnimatedProgressBar value={taskDetailModal.progress || 0} height="md" />
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            {/* START / PAUSE Button - Only for Continuous Tasks */}
            {/* Default State: START (when task is paused) | Active State: PAUSE (when task is active) */}
            {taskDetailModal?.duration_type === 'continuous' && (
              taskDetailModal.is_paused ? (
                /* START Button - Task is paused, click to resume */
                <Button 
                  variant="outline"
                  className="text-green-600 hover:bg-green-500/10 hover:text-green-700"
                  onClick={() => {
                    if (taskDetailModal) {
                      pauseToggleMutation.mutate({ id: taskDetailModal.id, isPaused: !taskDetailModal.is_paused })
                      setTaskDetailModal(null)
                    }
                  }}
                >
                  <Play className="mr-2 h-4 w-4" />
                  START
                </Button>
              ) : (
                /* PAUSE Button - Task is active, click to pause */
                <Button 
                  variant="outline"
                  className="text-amber-600 hover:bg-amber-500/10 hover:text-amber-700"
                  onClick={() => {
                    if (taskDetailModal) {
                      pauseToggleMutation.mutate({ id: taskDetailModal.id, isPaused: !taskDetailModal.is_paused })
                      setTaskDetailModal(null)
                    }
                  }}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  PAUSE
                </Button>
              )
            )}
            <Button 
              variant="outline"
              className="text-orange-600 hover:bg-orange-500/10 hover:text-orange-700"
              onClick={() => {
                if (taskDetailModal) {
                  setTaskToArchive(taskDetailModal)
                }
              }}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setTaskDetailModal(null)}
            >
              Close
            </Button>
            <Button 
              onClick={() => {
                if (taskDetailModal) {
                  handleEdit(taskDetailModal)
                  setTaskDetailModal(null)
                }
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Alert */}
      <AlertDialog open={!!taskToArchive} onOpenChange={(open: boolean) => !open && setTaskToArchive(null)}>
        <AlertDialogContent className="bg-white dark:bg-card border border-border shadow-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {taskToArchive?.duration_type === 'today' ? 'Archive or Delete Task?' : 'Archive Task'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                {taskToArchive?.duration_type === 'today' 
                  ? `Choose how to handle "${taskToArchive?.title}":`
                  : `Are you sure you want to archive "${taskToArchive?.title}"?`
                }
              </p>
              {taskToArchive?.duration_type === 'today' && (
                <div className="space-y-2 text-sm">
                  <div className="p-3 rounded-md bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/30">
                    <p className="font-medium text-orange-900 dark:text-orange-200 mb-1">📦 Archive</p>
                    <p className="text-orange-700 dark:text-orange-300">Move to Archive tab. Can be restored later. Progress history preserved.</p>
                  </div>
                  <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30">
                    <p className="font-medium text-red-900 dark:text-red-200 mb-1">🗑️ Permanent Delete</p>
                    <p className="text-red-700 dark:text-red-300">Completely remove all data including completion status, counts, weighted progress, dashboard contributions, analytics, and related statistics. <strong>This action cannot be undone.</strong></p>
                  </div>
                </div>
              )}
              {taskToArchive?.duration_type !== 'today' && (
                <p>This will move it to the Archive tab. You can restore it later.</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={taskToArchive?.duration_type === 'today' ? 'flex-col sm:flex-row gap-2' : ''}>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (taskToArchive) {
                  deleteTaskMutation.mutate(taskToArchive.id)
                  if (taskDetailModal?.id === taskToArchive.id) {
                    setTaskDetailModal(null)
                  }
                  setTaskToArchive(null)
                }
              }}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Archive
            </AlertDialogAction>
            {taskToArchive?.duration_type === 'today' && (
              <AlertDialogAction
                onClick={() => {
                  if (taskToArchive) {
                    permanentDeleteTaskMutation.mutate(taskToArchive.id)
                    if (taskDetailModal?.id === taskToArchive.id) {
                      setTaskDetailModal(null)
                    }
                    setTaskToArchive(null)
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Permanent Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

