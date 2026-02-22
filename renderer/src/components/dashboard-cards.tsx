/**
 * Dashboard Card Components
 * These cards follow the new progress calculation requirements:
 * - Binary completion only (100% = completed)
 * - Weight-based progress
 * - Time-scoped metrics
 * - NO goal progress percentages on dashboard
 * - NO fixed task-habit split percentages
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Flame,
  AlertTriangle,
  Target,
  CheckCircle,
  Calendar,
  BarChart3,
} from 'lucide-react'
import type { DashboardSummary, ProductivityScore } from '@/lib/progress'

interface DashboardCardsProps {
  summary: DashboardSummary
}

interface OverallProgressCardProps {
  productivityScore: ProductivityScore
}

/**
 * Overall Progress Card
 * Displays completed task count and completed habit count
 */
export const OverallProgressCard = ({ productivityScore }: OverallProgressCardProps) => {
  const overallScore = productivityScore.overall || 0
  const completedTasks = productivityScore.completedTasks || 0;
  const completedHabits = productivityScore.completedHabits || 0;
  
  return (
    <Card className="bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
          <CardDescription className="mt-1">Productivity score (last 30 days)</CardDescription>
        </div>
        <Activity className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold text-primary mb-2">{overallScore}%</div>
        <Progress value={overallScore} className="h-2 mb-4" />
        <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
          <div className="space-y-1">
            <p>Tasks Completed</p>
            <p className="font-semibold text-sm text-foreground">{completedTasks}</p>
          </div>
          <div className="space-y-1">
            <p>Habits Completed</p>
            <p className="font-semibold text-sm text-foreground">{completedHabits}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Today Focus Card
 * Shows today's tasks and habits with completion count
 */
export const TodayFocusCard = ({ summary }: DashboardCardsProps) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">Today Focus</CardTitle>
          <CardDescription className="mt-1">Tasks due today & scheduled habits</CardDescription>
        </div>
        <Target className="h-4 w-4 text-blue-500" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Tasks</span>
            <Badge variant="outline">
              {summary.tasksCompletedToday}/{summary.tasksToday}
            </Badge>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-500 h-full transition-all"
              style={{
                width: `${summary.tasksToday > 0 ? (summary.tasksCompletedToday / summary.tasksToday) * 100 : 0}%`
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Habits</span>
            <Badge variant="outline">
              {summary.habitsCompletedToday}/{summary.habitsToday}
            </Badge>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-green-500 h-full transition-all"
              style={{
                width: `${summary.habitsToday > 0 ? (summary.habitsCompletedToday / summary.habitsToday) * 100 : 0}%`
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Task Progress Card
 * Binary completion rate and weighted progress
 */
export const TaskProgressCard = ({ summary }: DashboardCardsProps) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">Task Progress</CardTitle>
          <CardDescription className="mt-1">Completion rate & weighted effort</CardDescription>
        </div>
        <CheckCircle className="h-4 w-4 text-blue-500" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Completion Rate</span>
              <span className="text-sm font-bold">{summary.taskCompletionRateToday}%</span>
            </div>
            <Progress value={summary.taskCompletionRateToday} className="h-2" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Weighted Progress</span>
              <span className="text-sm font-bold">{summary.weightedTaskProgressToday}%</span>
            </div>
            <Progress value={summary.weightedTaskProgressToday} className="h-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Habit Consistency Card
 * Separate from task completion
 */
export const HabitConsistencyCard = ({ summary }: DashboardCardsProps) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">Habit Consistency</CardTitle>
          <CardDescription className="mt-1">Actual habit completion rate</CardDescription>
        </div>
        <TrendingUp className="h-4 w-4 text-green-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-2">{summary.habitConsistencyToday}%</div>
        <Progress value={summary.habitConsistencyToday} className="mb-3 [&>div]:bg-green-500" />
        <p className="text-xs text-muted-foreground">
          This week: {summary.habitConsistencyWeek}% average
        </p>
      </CardContent>
    </Card>
  )
}

/**
 * Month Health Card
 * Planned vs completed weight, days remaining
 */
export const MonthHealthCard = ({ summary }: DashboardCardsProps) => {
  const weightProgress = summary.plannedWeightMonth > 0
    ? Math.round((summary.completedWeightMonth / summary.plannedWeightMonth) * 100)
    : 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">Month Health</CardTitle>
          <CardDescription className="mt-1">Planned vs completed weight</CardDescription>
        </div>
        <Calendar className="h-4 w-4 text-purple-500" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm font-bold">
                {summary.completedWeightMonth} / {summary.plannedWeightMonth}
              </span>
            </div>
            <Progress value={weightProgress} className="h-2" />
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>{summary.daysRemainingInMonth} days remaining in month</p>
            <p>
              {weightProgress === 100 ? '✓ Month target on track!' : `${weightProgress}% of planned weight completed`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Overall Daily Progress Card
 * Combined tasks and habits completion for today
 * Layout: Circle progress on left, Tasks/Habits breakdown on right
 */
export const OverallDailyProgressCard = ({ summary }: DashboardCardsProps) => {
  const totalToday = (summary.tasksToday || 0) + (summary.habitsToday || 0)
  const completedToday = (summary.tasksCompletedToday || 0) + (summary.habitsCompletedToday || 0)
  const overallProgress = totalToday > 0 ? (completedToday / totalToday) * 100 : 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">Overall Daily Progress</CardTitle>
          <CardDescription className="mt-1">Tasks + Habits combined</CardDescription>
        </div>
        <Flame className="h-4 w-4 text-amber-500" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center gap-16">
          {/* Left: Circle progress indicator */}
          <div className="flex-shrink-0">
            <div className="relative h-24 w-24">
              <svg className="h-full w-full" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  className="text-muted-foreground"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 45}`}
                  strokeDashoffset={`${2 * Math.PI * 45 * (1 - overallProgress / 100)}`}
                  className="text-amber-500 transition-all"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{Math.round(overallProgress)}%</span>
                <span className="text-xs text-muted-foreground mt-1">today</span>
              </div>
            </div>
          </div>

          {/* Right: Tasks and Habits breakdown (stacked vertically) */}
          <div className="w-44 space-y-2">
            {/* Tasks Today */}
            <div className="rounded-lg p-3 bg-blue-500/5">
              <div className="text-xs text-muted-foreground">Tasks Today</div>
              <div className="mt-1 flex items-center justify-between">
                <div className="text-lg font-bold">{summary.tasksCompletedToday}/{summary.tasksToday}</div>
                <div className="text-xs text-muted-foreground">
                  {summary.tasksToday > 0 ? `${Math.round((summary.tasksCompletedToday! / summary.tasksToday) * 100)}%` : '—'}
                </div>
              </div>
            </div>

            {/* Habits Today */}
            <div className="rounded-lg p-3 bg-green-500/5">
              <div className="text-xs text-muted-foreground">Habits Today</div>
              <div className="mt-1 flex items-center justify-between">
                <div className="text-lg font-bold">{summary.habitsCompletedToday}/{summary.habitsToday}</div>
                <div className="text-xs text-muted-foreground">
                  {summary.habitsToday > 0 ? `${Math.round((summary.habitsCompletedToday! / summary.habitsToday) * 100)}%` : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status message */}
        <div className="mt-4 text-center text-sm font-medium">
          {overallProgress === 100 && <p className="text-green-600">✓ Perfect day!</p>}
          {overallProgress >= 75 && overallProgress < 100 && <p className="text-amber-600">On track</p>}
        
          {overallProgress === 0 && <p className="text-muted-foreground">Nothing completed yet</p>}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * At-Risk Items Card
 * Overdue tasks and slipped habits
 */
export const AtRiskItemsCard = ({ summary }: DashboardCardsProps) => {
  const hasRisk = summary.overdueTasks > 0 || summary.slippedHabits > 0

  return (
    <Card className={hasRisk ? 'border-red-200 bg-red-50/50' : ''}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">At-Risk Items</CardTitle>
          <CardDescription className="mt-1">Overdue tasks & low consistency habits</CardDescription>
        </div>
        <AlertTriangle className={`h-4 w-4 ${hasRisk ? 'text-red-500' : 'text-amber-500'}`} />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Overdue Tasks</span>
            <Badge variant={summary.overdueTasks > 0 ? 'destructive' : 'secondary'}>
              {summary.overdueTasks}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Low Consistency Habits</span>
            <Badge variant={summary.slippedHabits > 0 ? 'destructive' : 'secondary'}>
              {summary.slippedHabits}
            </Badge>
          </div>

          {hasRisk && (
            <p className="text-xs text-red-600 mt-3 font-medium">
              Review at-risk items to get back on track.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Goal Activity Summary Card
 * Active goals, with activity, neglected
 */
export const GoalActivityCard = ({ summary }: DashboardCardsProps) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">Goal Activity</CardTitle>
          <CardDescription className="mt-1">This period</CardDescription>
        </div>
        <Target className="h-4 w-4 text-amber-500" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Active Goals</span>
            <span className="text-lg font-bold">{summary.activeGoals}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">With Activity</span>
            <span className="text-lg font-bold text-green-600">{summary.goalsWithActivityThisPeriod}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Streaks & Trends Card
 * Informational only (no progress impact)
 * Streaks: Task completion only (≥1 task completed 100% per day)
 * Trend: Task completion % this week vs last week
 */
export const StreaksAndTrendsCard = ({ summary }: DashboardCardsProps) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">Streaks & Trends</CardTitle>
          <CardDescription className="mt-1">Tasks only • Informational</CardDescription>
        </div>
        <Flame className="h-4 w-4 text-orange-500" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Current Streak (Tasks)</span>
            <span className="text-lg font-bold">{summary.currentTaskStreak} days</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Longest Streak (Tasks)</span>
            <span className="text-lg font-bold">{summary.longestTaskStreak} days</span>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-muted">
            <div className="flex items-center gap-2">
              {summary.trendIndicator === 'improving' && (
                <>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-600">Improving vs last week</span>
                </>
              )}
              {summary.trendIndicator === 'declining' && (
                <>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-red-600">Declining vs last week</span>
                </>
              )}
              {summary.trendIndicator === 'stable' && (
                <>
                  <BarChart3 className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-600">Stable vs last week</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
