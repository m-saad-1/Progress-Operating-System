import React from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

interface ProgressChartProps {
  days?: number
  showHabits?: boolean
  showTasks?: boolean
  className?: string
}

const generateData = (days: number) => {
  const data = []
  const today = new Date()
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    
    data.push({
      date: date.toLocaleDateString('en-US', { weekday: 'short' }),
      fullDate: date.toLocaleDateString(),
      tasks: Math.floor(Math.random() * 20) + 10,
      completed: Math.floor(Math.random() * 15) + 5,
      habits: Math.floor(Math.random() * 10) + 5,
      completedHabits: Math.floor(Math.random() * 8) + 3,
      productivity: Math.floor(Math.random() * 40) + 60,
      focusTime: Math.floor(Math.random() * 6) + 2,
    })
  }
  
  return data
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-popover p-4 shadow-lg">
        <p className="font-semibold text-sm mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between space-x-4 text-sm">
            <div className="flex items-center">
              <div 
                className="mr-2 h-3 w-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.dataKey}:</span>
            </div>
            <span className="font-bold">{entry.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function ProgressChart({ 
  days = 7, 
  showHabits = true, 
  showTasks = true,
  className 
}: ProgressChartProps) {
  const data = generateData(days)
  
  const weeklyStats = {
    totalTasks: data.reduce((sum, day) => sum + day.tasks, 0),
    completedTasks: data.reduce((sum, day) => sum + day.completed, 0),
    taskCompletionRate: Math.round(
      (data.reduce((sum, day) => sum + day.completed, 0) / 
       data.reduce((sum, day) => sum + day.tasks, 0)) * 100
    ),
    avgProductivity: Math.round(
      data.reduce((sum, day) => sum + day.productivity, 0) / days
    ),
    totalFocusTime: data.reduce((sum, day) => sum + day.focusTime, 0),
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Progress Analytics</CardTitle>
        <Tabs defaultValue="week" className="w-auto">
          <TabsList>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="quarter">Quarter</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-medium text-muted-foreground">Task Completion</div>
            <div className="text-2xl font-bold mt-1">
              {weeklyStats.taskCompletionRate}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {weeklyStats.completedTasks} of {weeklyStats.totalTasks} tasks
            </div>
          </div>
          
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-medium text-muted-foreground">Avg. Productivity</div>
            <div className="text-2xl font-bold mt-1">
              {weeklyStats.avgProductivity}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              ±2% from last week
            </div>
          </div>
          
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-medium text-muted-foreground">Focus Time</div>
            <div className="text-2xl font-bold mt-1">
              {weeklyStats.totalFocusTime}h
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {Math.round(weeklyStats.totalFocusTime / days * 10) / 10}h daily avg
            </div>
          </div>
          
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-medium text-muted-foreground">Consistency</div>
            <div className="text-2xl font-bold mt-1">94%</div>
            <div className="text-xs text-muted-foreground mt-1">
              6-day streak ongoing
            </div>
          </div>
        </div>

        <Tabs defaultValue="tasks">
          <TabsList className="mb-4">
            <TabsTrigger value="tasks">Task Progress</TabsTrigger>
            <TabsTrigger value="habits">Habit Tracking</TabsTrigger>
            <TabsTrigger value="productivity">Productivity</TabsTrigger>
          </TabsList>
          
          <TabsContent value="tasks" className="mt-0">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar 
                    dataKey="tasks" 
                    name="Total Tasks"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="completed" 
                    name="Completed"
                    fill="hsl(var(--status-completed))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          
          <TabsContent value="habits" className="mt-0">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="habits"
                    name="Total Habits"
                    stroke="hsl(var(--category-health))"
                    fill="hsl(var(--category-health))"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="completedHabits"
                    name="Completed"
                    stroke="hsl(var(--category-learning))"
                    fill="hsl(var(--category-learning))"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          
          <TabsContent value="productivity" className="mt-0">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="productivityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="productivity"
                    name="Productivity Score"
                    stroke="hsl(var(--primary))"
                    fill="url(#productivityGradient)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="focusTime"
                    name="Focus Hours"
                    stroke="hsl(var(--category-personal))"
                    fill="hsl(var(--category-personal))"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}