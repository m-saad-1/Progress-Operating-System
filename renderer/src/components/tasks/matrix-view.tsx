import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { format, isToday, startOfMonth, endOfMonth, subMonths, addMonths, eachDayOfInterval, getWeek, getDay, isSameDay, startOfDay, subDays } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { database, TaskAnalyticsChartSnapshot } from '@/lib/database'
import { Task } from '@/types'
import { type ProgressValue } from '@/components/ui/progress-selector'
import { safeParseDate } from '@/lib/date-safe'
import {
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
} from 'recharts'

// Progress level configuration
const PROGRESS_LEVELS = [
  { value: 0, label: 'Skipped', color: 'bg-red-500', textColor: 'text-red-500', borderColor: 'border-red-500', description: 'Task was skipped and not completed' },
  { value: 25, label: '25%', color: 'bg-gray-400', textColor: 'text-gray-400', borderColor: 'border-gray-400', description: 'Minimal progress made' },
  { value: 50, label: '50%', color: 'bg-yellow-500', textColor: 'text-yellow-500', borderColor: 'border-yellow-500', description: 'Halfway through the task' },
  { value: 75, label: '75%', color: 'bg-green-400', textColor: 'text-green-400', borderColor: 'border-green-400', description: 'Almost complete, final steps remaining' },
  { value: 100, label: 'Done', color: 'bg-green-600', textColor: 'text-green-600', borderColor: 'border-green-600', description: 'Task fully completed' },
] as const

// Calendar Matrix View - Daily Progress Ledger
const CalendarMatrixView: React.FC<{
  tasks: Task[]
  onProgressChange: (taskId: string, date: string, progress: ProgressValue) => void
  onTaskClick: (task: Task) => void
}> = ({ tasks, onProgressChange, onTaskClick }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const { data: checkboxDailyActivity = [] } = useQuery<TaskAnalyticsChartSnapshot['dailyActivity']>({
    queryKey: ['task-analytics-chart-checkbox-daily-activity', format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      const snapshot = await database.getTaskAnalyticsChartSnapshot(currentMonth)
      return snapshot.dailyActivity || []
    },
    staleTime: 30 * 1000,
  })

  const parentRef = React.useRef<HTMLDivElement>(null)
  
  // Transform daily activity data to include weight labels for chart display
  const checkboxChartData = useMemo(() => {
    return checkboxDailyActivity.map(point => ({
      ...point,
      weightLabel: `${Math.round(point.completed)}/${Math.round(point.updates)}`
    } as any))
  }, [checkboxDailyActivity])
  
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

  const rowVirtualizer = useVirtualizer({
    count: sortedTasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28, // h-7 is 28px
    overscan: 10,
  })

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
        
        <div className="overflow-auto max-h-[65vh] border-b relative" ref={parentRef}>
          {/* Header Container */}
          <div className="sticky top-0 z-20 flex bg-slate-50/95 dark:bg-zinc-900/95 backdrop-blur-sm border-b">
            {/* Left Header - Sticky Left */}
            <div className="sticky left-0 z-30 w-[200px] flex-shrink-0 bg-slate-100/95 dark:bg-zinc-800/95 flex flex-col border-r border-slate-200/50 dark:border-zinc-700/50">
               <div className="h-5" />
               <div className="h-7 flex items-center px-3">
                 <span className="text-sm text-muted-foreground/80 font-medium uppercase tracking-wider">Tasks</span>
                 <span className="ml-auto text-sm text-muted-foreground/50 font-medium">{sortedTasks.length}</span>
               </div>
            </div>
            
            {/* Right Header */}
            <div className="flex-1 min-w-max flex flex-col">
               <div className="flex h-5">
                 {weekGroups.map((group, idx) => (
                    <div key={idx} className="flex items-center justify-center text-xs text-muted-foreground/60 font-medium" style={{ width: `${group.days.length * 28}px` }}>
                      W{group.weekNum}
                    </div>
                 ))}
               </div>
               <div className="flex h-7">
                 {daysInMonth.map((day) => {
                   const isCurrentDay = isToday(day)
                   const isWeekend = getDay(day) === 0 || getDay(day) === 6
                   return (
                     <div key={day.toISOString()} className={cn("w-7 flex flex-col items-center justify-center", isCurrentDay && "bg-sky-500/30 rounded-t", isWeekend && !isCurrentDay && "bg-violet-500/15")}>
                       <span className={cn("text-[11px] leading-none", isCurrentDay ? "text-sky-600 dark:text-sky-400 font-bold" : "text-muted-foreground/50")}>{dayNames[getDay(day)]}</span>
                       <span className={cn("text-[11px] leading-none mt-0 font-medium", isCurrentDay ? "text-sky-600 dark:text-sky-400 font-bold" : "text-muted-foreground/70")}>{format(day, 'd')}</span>
                     </div>
                   )
                 })}
               </div>
            </div>
          </div>

          {/* Virtualized Body */}
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative', minWidth: '100%' }}>
            {sortedTasks.length === 0 ? (
              <div className="p-6 text-xs text-muted-foreground/60 text-center absolute w-full sticky left-0">
                 No tasks yet
              </div>
            ) : (
              rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const taskIndex = virtualRow.index
                const task = sortedTasks[taskIndex]
                
                return (
                  <div 
                    key={virtualRow.key} 
                    className="flex absolute top-0 left-0 min-w-max"
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                  >
                    {/* Left Column (Sticky) */}
                    <div 
                      className={cn(
                        "sticky left-0 z-10 w-[200px] flex-shrink-0 flex items-center gap-1.5 px-3 transition-colors group cursor-default",
                        taskIndex % 2 === 0 ? "bg-white/95 dark:bg-zinc-900/95" : "bg-slate-50/95 dark:bg-zinc-900/95",
                        "hover:bg-slate-100/95 dark:hover:bg-zinc-800/95 border-r border-slate-200/50 dark:border-zinc-700/50"
                      )}
                    >
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
                    
                    {/* Right Column */}
                    <div className="flex h-full">
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
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="px-4 pt-3 pb-1">
          <div className="overflow-x-auto">
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: `${checkboxChartData.length * 30}px` }}>
              {/* Weight labels row - aligned with chart bars */}
              <div className="flex h-6 text-[10px] font-medium text-foreground/70 mb-2" style={{ marginLeft: '0px' }}>
                {checkboxChartData.map((point, idx) => (
                  <div key={idx} style={{ flex: 1, textAlign: 'center', paddingBottom: '4px' }}>
                    {point.weightLabel}
                  </div>
                ))}
              </div>
              
              {/* Chart */}
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={checkboxChartData} margin={{ top: 0, right: 0, left: 0, bottom: 20 }}>
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }}
                      angle={0}
                      textAnchor="middle"
                      height={40}
                    />
                    <Bar
                      dataKey="completed"
                      fill="hsl(142 76% 36%)"
                      radius={[2, 2, 0, 0]}
                      isAnimationActive={false}
                      maxBarSize={20}
                    />
                  </BarChart>
                </ResponsiveContainer>
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
export const CheckboxView: React.FC<{
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
