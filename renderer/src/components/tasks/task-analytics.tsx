import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth, subMonths, addMonths } from 'date-fns'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { 
  Calendar,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  BarChart3,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { database, TaskAnalyticsChartSnapshot, TaskMonthlyHistoryPoint } from '@/lib/database'
import { safeParseDate, safeToDayKeyParts } from '@/lib/date-safe'
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

export const TaskAnalytics: React.FC<{ dayKey: string; showDailyActivity?: boolean }> = React.memo(({ dayKey, showDailyActivity = true }) => {
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
    enabled: showDailyActivity,
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
      {showDailyActivity && (
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
      )}
      
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
