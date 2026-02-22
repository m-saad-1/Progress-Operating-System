import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  parseISO,
  differenceInCalendarDays,
  differenceInCalendarWeeks,
  differenceInCalendarMonths,
  isSameWeek,
  isSameMonth,
} from 'date-fns'
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  Clock,
  CheckCircle2,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Plus,
  Edit3,
  Trash2,
  Save,
  FileText,
  Flame,
  BarChart3,
  Brain,
  Zap,
  RefreshCw,
  ListChecks,
  Settings2,
  Eye,
  EyeOff,
  RotateCcw,
  Smile,
  Meh,
  Frown,
  ArrowRight,
  ListPlus,
  Check,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { database, Review, ReviewInsights, CreateReviewDTO, TaskTabStatsSnapshot } from '@/lib/database'
import { useToaster } from '@/hooks/use-toaster'
import { useStore, ReviewQuestion } from '@/store'
import { useElectron } from '@/hooks/use-electron'
import type { HabitCompletion } from '@/types'
import { calculateHabitAnalytics, calculateGoalAnalytics, calculateTimeAnalytics, getDateRange } from '@/lib/progress'
import { ContextTipsDialog } from '@/components/context-tips-dialog'

// Sentiment types
type Sentiment = 'positive' | 'neutral' | 'negative'

const REVIEW_TIPS_SECTIONS = [
  {
    title: 'Why Reviews Matter',
    points: [
      'Reviews convert daily activity into learning so progress is intentional, not accidental.',
      'Consistent reflection helps identify repeated blockers before they become long-term patterns.',
      'A short high-quality review is better than a long but inconsistent process.',
    ],
  },
  {
    title: 'Reflection and Planning Impact',
    points: [
      'Use reviews to connect outcomes, causes, and next actions in one loop.',
      'Capture wins and misses together to preserve confidence while improving execution quality.',
      'Convert insights directly into concrete task or habit adjustments for the next period.',
    ],
  },
  {
    title: 'Daily, Weekly, Monthly Effects',
    points: [
      'Daily reviews maintain near-term clarity and improve next-day focus.',
      'Weekly reviews recalibrate priorities and expose trend-level performance changes.',
      'Monthly reviews strengthen strategic direction and feed richer streak/insight history.',
    ],
  },
] as const

// Review type configurations
const REVIEW_TYPES = {
  daily: {
    label: 'Daily Review',
    description: 'Reflect on your day and plan for tomorrow',
    icon: Calendar,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
  weekly: {
    label: 'Weekly Review',
    description: 'Analyze your week and adjust your approach',
    icon: CalendarDays,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
  },
  monthly: {
    label: 'Monthly Review',
    description: 'Evaluate your month and set new directions',
    icon: CalendarRange,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
  },
} as const

type ReviewType = keyof typeof REVIEW_TYPES

type ReviewStreaks = {
  daily: number
  weekly: number
  monthly: number
  total: number
}

type ReviewInsightsData = ReviewInsights & {
  timeTrackedMinutes?: number
  timeActiveDays?: number
  goalsActiveCount?: number
  analyticsProductivityScore?: number
}

function getCombinedCompletionRate(insights: ReviewInsightsData | null | undefined): number {
  if (!insights) return 0

  if (typeof insights.combinedCompletionRate === 'number') {
    return insights.combinedCompletionRate
  }

  const taskEligibleCount = insights.taskEligibleCount ?? 0
  const habitPeriodsExpected = insights.habitPeriodsExpected ?? 0
  const habitPeriodsCompleted = insights.habitPeriodsCompleted ?? 0

  if (taskEligibleCount > 0 || habitPeriodsExpected > 0) {
    const denominator = taskEligibleCount + habitPeriodsExpected
    const numerator = (insights.tasksCompleted || 0) + habitPeriodsCompleted
    return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0
  }

  const taskRate = insights.taskCompletionRate || 0
  const habitRate = insights.habitConsistencyRate || 0
  return Math.round((taskRate + habitRate) / 2)
}

// Sentiment configuration
const SENTIMENTS = {
  positive: { icon: Smile, color: 'text-green-500', bgColor: 'bg-green-500/10', activeBg: 'bg-green-500', label: 'Positive' },
  neutral: { icon: Meh, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', activeBg: 'bg-yellow-500', label: 'Neutral' },
  negative: { icon: Frown, color: 'text-red-500', bgColor: 'bg-red-500/10', activeBg: 'bg-red-500', label: 'Negative' },
} as const

function getPeriodDates(type: ReviewType, date: Date = new Date()) {
  switch (type) {
    case 'daily':
      return {
        start: startOfDay(date).toISOString(),
        end: endOfDay(date).toISOString(),
      }
    case 'weekly':
      return {
        start: startOfWeek(date, { weekStartsOn: 1 }).toISOString(),
        end: endOfWeek(date, { weekStartsOn: 1 }).toISOString(),
      }
    case 'monthly':
      return {
        start: startOfMonth(date).toISOString(),
        end: endOfMonth(date).toISOString(),
      }
  }
}

function formatPeriodLabel(type: ReviewType, periodStart: string, periodEnd: string) {
  const start = parseISO(periodStart)
  const end = parseISO(periodEnd)
  
  switch (type) {
    case 'daily':
      return format(start, 'EEEE, MMMM d, yyyy')
    case 'weekly':
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`
    case 'monthly':
      return format(start, 'MMMM yyyy')
  }
}

function calculateReviewStreakForType(type: ReviewType, completedReviews: Review[]): number {
  const reviewsOfType = completedReviews.filter((r) => r.type === type)
  if (reviewsOfType.length === 0) return 0

  const uniquePeriods = new Map<string, Date>()

  for (const review of reviewsOfType) {
    const reviewDate = parseISO(review.period_end)
    let periodKey = ''

    if (type === 'daily') {
      periodKey = format(startOfDay(reviewDate), 'yyyy-MM-dd')
    } else if (type === 'weekly') {
      periodKey = format(startOfWeek(reviewDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    } else {
      periodKey = format(startOfMonth(reviewDate), 'yyyy-MM')
    }

    const existing = uniquePeriods.get(periodKey)
    if (!existing || reviewDate.getTime() > existing.getTime()) {
      uniquePeriods.set(periodKey, reviewDate)
    }
  }

  const periodDates = Array.from(uniquePeriods.values()).sort((a, b) => b.getTime() - a.getTime())
  if (periodDates.length === 0) return 0

  const today = new Date()
  const mostRecentReviewDate = periodDates[0]

  if (type === 'daily') {
    if (differenceInCalendarDays(today, mostRecentReviewDate) > 0) return 0

    let streak = 1
    for (let i = 0; i < periodDates.length - 1; i++) {
      if (differenceInCalendarDays(periodDates[i], periodDates[i + 1]) !== 1) break
      streak++
    }
    return streak
  }

  if (type === 'weekly') {
    if (!isSameWeek(mostRecentReviewDate, today, { weekStartsOn: 1 })) return 0

    let streak = 1
    for (let i = 0; i < periodDates.length - 1; i++) {
      if (differenceInCalendarWeeks(periodDates[i], periodDates[i + 1], { weekStartsOn: 1 }) !== 1) break
      streak++
    }
    return streak
  }

  if (!isSameMonth(mostRecentReviewDate, today)) return 0

  let streak = 1
  for (let i = 0; i < periodDates.length - 1; i++) {
    if (differenceInCalendarMonths(periodDates[i], periodDates[i + 1]) !== 1) break
    streak++
  }
  return streak
}

function calculateReviewStreaks(reviews: Review[]): ReviewStreaks {
  const completed = reviews.filter((r) => r.status === 'completed' && !r.deleted_at)

  const daily = calculateReviewStreakForType('daily', completed)
  const weekly = calculateReviewStreakForType('weekly', completed)
  const monthly = calculateReviewStreakForType('monthly', completed)

  return {
    daily,
    weekly,
    monthly,
    total: daily + weekly + monthly,
  }
}

// Generate auto-filled context based on real data from all modules
function generateAutoContext(insights: ReviewInsightsData | null, type: ReviewType): string {
  if (!insights) return ''
  
  const sections: string[] = []
  
  // --- Tasks Section ---
  const taskParts: string[] = []
  if (insights.tasksCompleted > 0) {
    taskParts.push(`Completed ${insights.tasksCompleted} task${insights.tasksCompleted !== 1 ? 's' : ''}`)
  }
  if (insights.tasksCreated > 0) {
    taskParts.push(`Created ${insights.tasksCreated} new task${insights.tasksCreated !== 1 ? 's' : ''}`)
  }
  if (insights.taskCompletionRate > 0) {
    taskParts.push(`Weighted completion rate: ${insights.taskCompletionRate}%`)
  }
  if (insights.overdueTasksCount > 0) {
    taskParts.push(`${insights.overdueTasksCount} overdue task${insights.overdueTasksCount !== 1 ? 's' : ''}`)
  }
  if (insights.blockedTasksCount > 0) {
    taskParts.push(`${insights.blockedTasksCount} blocked task${insights.blockedTasksCount !== 1 ? 's' : ''}`)
  }
  if (taskParts.length > 0) {
    sections.push(`📋 Tasks:\n${taskParts.map(p => `  • ${p}`).join('\n')}`)
  }
  
  // --- Habits Section ---
  const habitParts: string[] = []
  if (insights.habitsCompleted > 0) {
    habitParts.push(`${insights.habitsCompleted} habit${insights.habitsCompleted !== 1 ? 's' : ''} completed`)
  }
  if (insights.habitConsistencyRate > 0) {
    habitParts.push(`Consistency: ${insights.habitConsistencyRate}%`)
  }

  const combinedCompletionRate = getCombinedCompletionRate(insights)
  if (combinedCompletionRate > 0) {
    habitParts.push(`Combined completion rate: ${combinedCompletionRate}%`)
  }
  if (insights.currentStreaks && insights.currentStreaks.length > 0) {
    const topStreak = insights.currentStreaks[0]
    habitParts.push(`Top streak: ${topStreak.title} (${topStreak.streak} days)`)
  }
  if (insights.habitsMissed > 0) {
    habitParts.push(`${insights.habitsMissed} habit${insights.habitsMissed !== 1 ? 's' : ''} missed`)
  }
  if (habitParts.length > 0) {
    sections.push(`🎯 Habits:\n${habitParts.map(p => `  • ${p}`).join('\n')}`)
  }
  
  // --- Goals Section ---
  const goalParts: string[] = []
  if (insights.goalsCompletedThisPeriod > 0) {
    goalParts.push(`${insights.goalsCompletedThisPeriod} goal${insights.goalsCompletedThisPeriod !== 1 ? 's' : ''} achieved`)
  }
  if (insights.activeGoalsProgress && insights.activeGoalsProgress.length > 0) {
    const avgProgress = Math.round(insights.activeGoalsProgress.reduce((s, g) => s + g.progress, 0) / insights.activeGoalsProgress.length)
    goalParts.push(`${insights.activeGoalsProgress.length} active goal${insights.activeGoalsProgress.length !== 1 ? 's' : ''} (avg ${avgProgress}%)`)
  }
  if (insights.goalsAtRisk && insights.goalsAtRisk.length > 0) {
    goalParts.push(`${insights.goalsAtRisk.length} goal${insights.goalsAtRisk.length !== 1 ? 's' : ''} needing attention`)
  }
  if (goalParts.length > 0) {
    sections.push(`🏆 Goals:\n${goalParts.map(p => `  • ${p}`).join('\n')}`)
  }

  // --- Time Section ---
  const timeParts: string[] = []
  if ((insights.timeTrackedMinutes || 0) > 0) {
    const minutes = insights.timeTrackedMinutes || 0
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    timeParts.push(`Tracked time: ${hours > 0 ? `${hours}h ` : ''}${mins}m`)
  }
  if ((insights.timeActiveDays || 0) > 0) {
    timeParts.push(`Active days: ${insights.timeActiveDays}`)
  }
  if (timeParts.length > 0) {
    sections.push(`⏱️ Time:\n${timeParts.map(p => `  • ${p}`).join('\n')}`)
  }

  // --- Analytics / Trends Section ---
  const analytParts: string[] = []
  if (insights.productivityTrend) {
    const arrow = insights.productivityTrend === 'improving' ? '↑' : insights.productivityTrend === 'declining' ? '↓' : '→'
    analytParts.push(`Productivity: ${arrow} ${insights.productivityTrend}`)
  }
  if (insights.habitTrend) {
    const arrow = insights.habitTrend === 'improving' ? '↑' : insights.habitTrend === 'declining' ? '↓' : '→'
    analytParts.push(`Habit trend: ${arrow} ${insights.habitTrend}`)
  }
  if (insights.consistencyScore > 0) {
    analytParts.push(`Overall consistency score: ${insights.consistencyScore}%`)
  }
  if ((insights.analyticsProductivityScore || 0) > 0) {
    analytParts.push(`Productivity score: ${insights.analyticsProductivityScore}%`)
  }
  if (analytParts.length > 0) {
    sections.push(`📊 Analytics:\n${analytParts.map(p => `  • ${p}`).join('\n')}`)
  }
  
  if (sections.length === 0) return ''
  
  const periodLabel = type === 'daily' ? 'today' : type === 'weekly' ? 'this week' : 'this month'
  return `Here's what happened ${periodLabel}:\n\n${sections.join('\n\n')}`
}

// Insight Card Component
function InsightCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  color = 'text-primary' 
}: { 
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  trend?: 'up' | 'down' | 'stable' | 'improving' | 'declining'
  color?: string
}) {
  const normalizedTrend = trend === 'improving' ? 'up' : trend === 'declining' ? 'down' : trend
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-2xl font-bold", color)}>{value}</span>
              {normalizedTrend && (
                <span className={cn(
                  "flex items-center text-xs",
                  normalizedTrend === 'up' && "text-green-500",
                  normalizedTrend === 'down' && "text-red-500",
                  normalizedTrend === 'stable' && "text-muted-foreground"
                )}>
                  {normalizedTrend === 'up' && <TrendingUp className="h-3 w-3 mr-0.5" />}
                  {normalizedTrend === 'down' && <TrendingDown className="h-3 w-3 mr-0.5" />}
                  {normalizedTrend === 'stable' && <Minus className="h-3 w-3 mr-0.5" />}
                  {normalizedTrend}
                </span>
              )}
            </div>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={cn("p-2 rounded-lg bg-primary/10", color)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Questions Customization Dialog
function QuestionsCustomizationDialog({
  type,
  questions,
  onUpdate,
  onAdd,
  onRemove,
  onToggle,
  onReset,
}: {
  type: ReviewType
  questions: ReviewQuestion[]
  onUpdate: (questions: ReviewQuestion[]) => void
  onAdd: (question: Omit<ReviewQuestion, 'id' | 'order'>) => void
  onRemove: (id: string) => void
  onToggle: (id: string) => void
  onReset: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')
  const [newPlaceholder, setNewPlaceholder] = useState('')
  const [editingQuestion, setEditingQuestion] = useState<ReviewQuestion | null>(null)
  
  const handleAddQuestion = () => {
    if (!newQuestion.trim()) return
    onAdd({
      key: `custom-${Date.now()}`,
      question: newQuestion.trim(),
      placeholder: newPlaceholder.trim() || 'Enter your response...',
      enabled: true,
      isCustom: true,
    })
    setNewQuestion('')
    setNewPlaceholder('')
  }
  
  const handleEditQuestion = (q: ReviewQuestion) => {
    setEditingQuestion(q)
  }
  
  const handleSaveEdit = () => {
    if (!editingQuestion) return
    const updated = questions.map(q => 
      q.id === editingQuestion.id ? editingQuestion : q
    )
    onUpdate(updated)
    setEditingQuestion(null)
  }
  
  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= questions.length) return
    
    const newQuestions = [...questions]
    const [removed] = newQuestions.splice(index, 1)
    newQuestions.splice(newIndex, 0, removed)
    onUpdate(newQuestions.map((q, i) => ({ ...q, order: i })))
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-transparent dark:bg-transparent border-primary/25 text-primary dark:text-primary/90 hover:bg-primary/10 hover:border-primary/50 dark:hover:bg-primary/20 dark:hover:border-primary/60 transition-colors duration-200 shadow-none"
        >
          <Settings2 className="h-4 w-4 mr-2" />
          Customize Questions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col bg-card">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Customize {REVIEW_TYPES[type].label} Questions</DialogTitle>
          <DialogDescription>
            Add, edit, reorder, or disable questions to match your reflection style.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto pr-2 -mr-2 scroll-smooth">
          <div className="space-y-4 py-4">
            {/* Existing questions */}
            <div className="space-y-2">
              {questions.map((q, index) => (
                <div
                  key={q.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                    q.enabled ? "bg-secondary/30 border-green-500/20 dark:border-green-500/15" : "bg-muted/50 opacity-60 border-border"
                  )}
                >
                  <div className="flex flex-col gap-1 mt-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveQuestion(index, 'up')}
                      disabled={index === 0}
                    >
                      <ChevronLeft className="h-3 w-3 rotate-90" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveQuestion(index, 'down')}
                      disabled={index === questions.length - 1}
                    >
                      <ChevronRight className="h-3 w-3 rotate-90" />
                    </Button>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    {editingQuestion?.id === q.id ? (
                      <div className="space-y-2">
                        <Input
                          value={editingQuestion.question}
                          onChange={(e) => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                          placeholder="Question text..."
                          className="bg-secondary/50 border-green-500/20 focus-visible:ring-green-500/50 dark:border-green-500/15"
                        />
                        <Input
                          value={editingQuestion.placeholder}
                          onChange={(e) => setEditingQuestion({ ...editingQuestion, placeholder: e.target.value })}
                          placeholder="Placeholder text..."
                          className="bg-secondary/50 border-green-500/20 focus-visible:ring-green-500/50 dark:border-green-500/15"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveEdit}>
                            <Check className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingQuestion(null)}>
                            <X className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className={cn("font-medium", !q.enabled && "line-through")}>
                          {q.question}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {q.placeholder}
                        </p>
                        {q.isCustom && (
                          <Badge variant="outline" className="mt-1 text-xs">Custom</Badge>
                        )}
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onToggle(q.id)}
                    >
                      {q.enabled ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEditQuestion(q)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    {q.isCustom && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => onRemove(q.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Add new question - matching Task Form design */}
            <div className="space-y-3 pt-4 border-t">
              <label className="text-sm font-medium">Add Custom Question</label>
              <Input
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="Enter your question..."
                className="bg-secondary/50 border-green-500/20 focus-visible:ring-green-500/50 dark:border-green-500/15"
              />
              <Input
                value={newPlaceholder}
                onChange={(e) => setNewPlaceholder(e.target.value)}
                placeholder="Placeholder text (optional)..."
                className="bg-secondary/50 border-green-500/20 focus-visible:ring-green-500/50 dark:border-green-500/15"
              />
              <Button onClick={handleAddQuestion} disabled={!newQuestion.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Question
              </Button>
            </div>
          </div>
        </div>
        
        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Default
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card">
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Questions?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset all {type} review questions to their defaults. Custom questions will be removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onReset}>Reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={() => setIsOpen(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Action Item Creator for Review -> Planning link
function ActionItemCreator({
  insights,
  onCreateTask,
}: {
  insights: ReviewInsights | null
  onCreateTask: (title: string, description: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  
  const handleCreateTask = () => {
    if (!taskTitle.trim()) return
    onCreateTask(taskTitle.trim(), taskDescription.trim())
    setTaskTitle('')
    setTaskDescription('')
    setIsOpen(false)
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ListPlus className="h-4 w-4 mr-2" />
          Create Action Item
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white dark:bg-card border border-border">
        <DialogHeader>
          <DialogTitle>Create Action Item from Review</DialogTitle>
          <DialogDescription>
            Turn your insights into actionable tasks or habit adjustments.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Suggestions based on insights */}
          {insights && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Suggested Actions</Label>
              <div className="space-y-2">
                {insights.goalsAtRisk?.slice(0, 3).map(goal => (
                  <Button
                    key={goal.id}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left"
                    onClick={() => setTaskTitle(`Review and update goal: ${goal.title}`)}
                  >
                    <Target className="h-4 w-4 mr-2 text-amber-500" />
                    <span className="truncate">Focus on: {goal.title}</span>
                  </Button>
                ))}
                {insights.overdueTasksCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setTaskTitle(`Review ${insights.overdueTasksCount} overdue tasks`)}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2 text-red-500" />
                    Review {insights.overdueTasksCount} overdue tasks
                  </Button>
                )}
              </div>
            </div>
          )}
          
          <Separator />
          
          {/* Custom action */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Custom Action</Label>
            <Input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Action title..."
            />
            <Textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Description (optional)..."
              className="min-h-[80px]"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateTask} disabled={!taskTitle.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Review Editor Component
function ReviewEditor({
  type,
  review,
  insights,
  questions,
  onSave,
  onCancel,
  isLoading,
  onCreateTask,
}: {
  type: ReviewType
  review: Review | null
  insights: ReviewInsightsData | null
  questions: ReviewQuestion[]
  onSave: (data: any) => void
  onCancel: () => void
  isLoading: boolean
  onCreateTask: (title: string, description: string) => void
}) {
  const enabledQuestions = questions.filter(q => q.enabled).sort((a, b) => a.order - b.order)
  const [responses, setResponses] = useState<Record<string, string>>(
    review?.responses || {}
  )
  const [ratings, setRatings] = useState({
    energyLevel: review?.responses?.energyLevel || 3,
    productivityRating: review?.responses?.productivityRating || 3,
    overallSatisfaction: review?.responses?.overallSatisfaction || 3,
    overallRating: review?.responses?.overallRating || 3,
  })
  const [sentiment, setSentiment] = useState<Sentiment>(
    review?.mood as Sentiment || 'neutral'
  )
  const [currentStep, setCurrentStep] = useState(0)
  const [showAutoContext, setShowAutoContext] = useState(true)

  const autoContext = useMemo(() => generateAutoContext(insights, type), [insights, type])
  const handleResponseChange = (key: string, value: string) => {
    setResponses(prev => ({ ...prev, [key]: value }))
  }

  const handleRatingChange = (key: string, value: number) => {
    setRatings(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = (status: 'draft' | 'completed') => {
    const data = {
      responses: {
        ...responses,
        ...ratings,
      },
      mood: sentiment,
      status,
    }
    onSave(data)
  }

  const currentPrompt = enabledQuestions[currentStep]
  const isLastStep = currentStep === enabledQuestions.length - 1
  const isFirstStep = currentStep === 0

  const completedPrompts = enabledQuestions.filter(p => responses[p.key]?.trim()).length
  const progress = enabledQuestions.length > 0 ? (completedPrompts / enabledQuestions.length) * 100 : 0

  // Check if this is a past review (completed reviews should be read-only for historical accuracy)
  const isPastCompleted = review?.status === 'completed'

  if (enabledQuestions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <CardContent>
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No questions enabled for this review type.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Use "Customize Questions" to add or enable questions.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator with live question counter */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Question {currentStep + 1} of {enabledQuestions.length}
          </span>
          <span className="font-medium text-primary">
            {completedPrompts}/{enabledQuestions.length} answered
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Auto-filled Context Panel */}
      {autoContext && showAutoContext && (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                Auto-filled Context
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAutoContext(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <pre className="text-sm whitespace-pre-wrap font-sans text-muted-foreground">
              {autoContext}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Current Question */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{currentPrompt.question}</CardTitle>
            {currentPrompt.isCustom && (
              <Badge variant="outline">Custom</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={responses[currentPrompt.key] || ''}
            onChange={(e) => handleResponseChange(currentPrompt.key, e.target.value)}
            placeholder={currentPrompt.placeholder}
            className="min-h-[150px] resize-none"
            disabled={isPastCompleted}
          />
        </CardContent>
      </Card>

      {/* Rating sections based on review type */}
      {type === 'daily' && isLastStep && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How would you rate today?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Energy Level: {ratings.energyLevel}/5</Label>
              <div className="flex gap-4">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleRatingChange('energyLevel', val)}
                    disabled={isPastCompleted}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all",
                      ratings.energyLevel === val
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30 hover:border-primary"
                    )}
                  >
                    {ratings.energyLevel === val && <div className="h-2 w-2 rounded-full bg-white" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Label>Productivity: {ratings.productivityRating}/5</Label>
              <div className="flex gap-4">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleRatingChange('productivityRating', val)}
                    disabled={isPastCompleted}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all",
                      ratings.productivityRating === val
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30 hover:border-primary"
                    )}
                  >
                    {ratings.productivityRating === val && <div className="h-2 w-2 rounded-full bg-white" />}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {type === 'weekly' && isLastStep && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Week Satisfaction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Label>Overall Satisfaction: {ratings.overallSatisfaction}/5</Label>
              <div className="flex gap-4">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleRatingChange('overallSatisfaction', val)}
                    disabled={isPastCompleted}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all",
                      ratings.overallSatisfaction === val
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30 hover:border-primary"
                    )}
                  >
                    {ratings.overallSatisfaction === val && <div className="h-2 w-2 rounded-full bg-white" />}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {type === 'monthly' && isLastStep && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Month Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Label>Overall Rating: {ratings.overallRating}/5</Label>
              <div className="flex gap-4">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleRatingChange('overallRating', val)}
                    disabled={isPastCompleted}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all",
                      ratings.overallRating === val
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30 hover:border-primary"
                    )}
                  >
                    {ratings.overallRating === val && <div className="h-2 w-2 rounded-full bg-white" />}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sentiment Tagging */}
      {isLastStep && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Overall Sentiment</CardTitle>
            <CardDescription>How do you feel about this {type === 'daily' ? 'day' : type === 'weekly' ? 'week' : 'month'}?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 justify-center">
              {(Object.keys(SENTIMENTS) as Sentiment[]).map((s) => {
                const config = SENTIMENTS[s]
                const Icon = config.icon
                return (
                  <Button
                    key={s}
                    variant="ghost"
                    className={cn(
                      "flex flex-col gap-2 h-auto py-4 px-6 border-0",
                      sentiment === s ? cn(config.activeBg, "text-white shadow-md scale-105") : "bg-secondary/50 hover:bg-secondary"
                    )}
                    onClick={() => setSentiment(s)}
                    disabled={isPastCompleted}
                  >
                    <Icon className={cn("h-8 w-8", sentiment === s ? 'text-white' : config.color)} />
                    <span className="text-sm">{config.label}</span>
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Items - Review to Planning link */}
      {isLastStep && !isPastCompleted && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-primary" />
              Turn Insights into Action
            </CardTitle>
            <CardDescription>
              Create tasks or adjustments based on your review
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionItemCreator
              insights={insights}
              onCreateTask={onCreateTask}
            />
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
            disabled={isFirstStep}
            className="bg-transparent dark:bg-transparent border border-transparent hover:bg-primary/10 hover:text-primary hover:border-primary/30 dark:hover:bg-primary/20 dark:hover:text-primary-foreground transition-colors duration-200"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="ghost"
            onClick={() => setCurrentStep(s => Math.min(enabledQuestions.length - 1, s + 1))}
            disabled={isLastStep}
            className="bg-transparent dark:bg-transparent border border-transparent hover:bg-primary/10 hover:text-primary hover:border-primary/30 dark:hover:bg-primary/20 dark:hover:text-primary-foreground transition-colors duration-200"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            onClick={onCancel}
            className="hover:bg-secondary/80 border-0"
          >
            Cancel
          </Button>
          {!isPastCompleted && (
            <>
              <Button 
                variant="ghost" 
                onClick={() => handleSave('draft')}
                disabled={isLoading}
                className="bg-transparent dark:bg-transparent border border-transparent hover:bg-primary/10 hover:text-primary hover:border-primary/30 dark:hover:bg-primary/20 dark:hover:text-primary-foreground transition-colors duration-200"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              <Button 
                onClick={() => handleSave('completed')}
                disabled={isLoading || completedPrompts < enabledQuestions.length * 0.5}
                className="bg-green-600 hover:bg-green-700 text-white border-0 shadow-sm"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Complete Review
              </Button>
            </>
          )}
          {isPastCompleted && (
            <Badge variant="secondary" className="py-2 px-4">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Completed Review (Read-only)
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

// Review Card for History
function ReviewCard({ review, onEdit, onDelete }: { 
  review: Review
  onEdit: (review: Review) => void
  onDelete: (id: string) => void
}) {
  const config = REVIEW_TYPES[review.type as ReviewType]
  const Icon = config.icon

  const responseEntries = Object.entries((review.responses || {}) as Record<string, unknown>)
  const completedQuestions = responseEntries.filter(([, value]) => {
    if (typeof value === 'string') return value.trim().length > 0
    if (typeof value === 'number') return Number.isFinite(value)
    return false
  }).length

  const totalQuestions = responseEntries.filter(([, value]) => {
    return typeof value === 'string' || typeof value === 'number'
  }).length
  
  // Get sentiment
  const sentimentConfig = review.mood ? SENTIMENTS[review.mood as Sentiment] : null
  const SentimentIcon = sentimentConfig?.icon

  return (
    <Card className={cn(
      "hover:shadow-md transition-all cursor-pointer",
      config.borderColor,
      review.status === 'draft' && "border-dashed"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", config.bgColor)}>
              <Icon className={cn("h-5 w-5", config.color)} />
            </div>
            <div>
              <CardTitle className="text-base">
                {formatPeriodLabel(review.type as ReviewType, review.period_start, review.period_end)}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Badge variant={review.status === 'completed' ? 'default' : 'secondary'}>
                  {review.status}
                </Badge>
                <span className="text-xs">
                  {totalQuestions > 0
                    ? `${completedQuestions}/${totalQuestions} questions`
                    : `${completedQuestions} answered`}
                </span>
                {sentimentConfig && SentimentIcon && (
                  <span className={cn("flex items-center gap-1 text-xs", sentimentConfig.color)}>
                    <SentimentIcon className="h-3 w-3" />
                    {sentimentConfig.label}
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => onEdit(review)}>
              <Edit3 className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Trash2 className="h-4 w-4 text-orange-500 hover:text-orange-600" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-white dark:bg-card border border-border shadow-lg">
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive Review</AlertDialogTitle>
                  <AlertDialogDescription>
                    This review will be moved to the Archive. You can restore it later from the Archive section.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => onDelete(review.id)}
                    className="bg-orange-500 text-white hover:bg-orange-600"
                  >
                    Archive
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      {review.status === 'completed' && review.responses && (
        <CardContent className="pt-0">
          <div className="text-sm text-muted-foreground line-clamp-2">
            {(() => {
              const responses = review.responses as Record<string, unknown>
              const firstText = Object.values(responses).find(v => typeof v === 'string' && v.trim())
              return typeof firstText === 'string' ? firstText : 'No content'
            })()}
          </div>
          {review.insights && (
            <div className="flex gap-4 mt-3 text-xs">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                {review.insights.tasksCompleted} tasks
              </span>
              <span className="flex items-center gap-1">
                <Flame className="h-3 w-3 text-orange-500" />
                {review.insights.habitConsistencyRate}% habits
              </span>
              {review.insights.productivityTrend && (
                <span className="flex items-center gap-1">
                  {review.insights.productivityTrend === 'improving' ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : review.insights.productivityTrend === 'declining' ? (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  ) : (
                    <Minus className="h-3 w-3 text-muted-foreground" />
                  )}
                  {review.insights.productivityTrend}
                </span>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// Main Reviews Page Component
export default function Reviews() {
  const { toast } = useToaster()
  const queryClient = useQueryClient()
  const electron = useElectron()
  const [activeTab, setActiveTab] = useState<ReviewType>('daily')
  const [isEditing, setIsEditing] = useState(false)
  const [editingReview, setEditingReview] = useState<Review | null>(null)
  const [currentPeriod, setCurrentPeriod] = useState(getPeriodDates('daily'))
  
  // Get custom questions from store
  const {
    customReviewQuestions,
    updateReviewQuestions,
    addReviewQuestion,
    removeReviewQuestion,
    toggleReviewQuestion,
    resetReviewQuestions,
    tasks,
    habits,
    goals,
  } = useStore()

  // Update period when tab changes
  useEffect(() => {
    setCurrentPeriod(getPeriodDates(activeTab))
  }, [activeTab])

  // Fetch reviews
  const { data: reviews = [], isLoading: loadingReviews } = useQuery({
    queryKey: ['reviews', activeTab],
    queryFn: () => database.getReviews(activeTab, 50),
  })

  const { data: allReviews = [] } = useQuery({
    queryKey: ['reviews-history-all'],
    queryFn: () => database.getReviewHistory(),
  })

  const { data: taskStatsSnapshot } = useQuery<TaskTabStatsSnapshot>({
    queryKey: ['task-stats', 'reviews-sync'],
    queryFn: () => database.getTaskTabStats(),
    staleTime: 30_000,
  })

  const { data: allHabitCompletions = [] } = useQuery<HabitCompletion[]>({
    queryKey: ['habit-completions-all', 'reviews'],
    queryFn: async () => {
      if (!electron.isReady) return []
      const earliestHabitDate = habits.length > 0
        ? habits
            .map((habit) => format(parseISO(habit.created_at), 'yyyy-MM-dd'))
            .sort()[0]
        : format(new Date(), 'yyyy-MM-dd')
      const today = format(new Date(), 'yyyy-MM-dd')
      return database.getHabitCompletions(earliestHabitDate, today)
    },
    enabled: electron.isReady,
    staleTime: 30_000,
  })

  // Check for existing review in current period
  const { data: existingReview } = useQuery({
    queryKey: ['review-existing', activeTab, currentPeriod.start, currentPeriod.end],
    queryFn: () => database.getReviewForPeriod(activeTab, currentPeriod.start, currentPeriod.end),
  })

  const latestCompletedReview = useMemo(() => {
    return reviews
      .filter((r) => r.status === 'completed')
      .sort((a, b) => parseISO(b.updated_at).getTime() - parseISO(a.updated_at).getTime())[0] || null
  }, [reviews])

  const periodRange = useMemo(
    () => ({ start: parseISO(currentPeriod.start), end: parseISO(currentPeriod.end) }),
    [currentPeriod.end, currentPeriod.start]
  )

  const previousPeriodRange = useMemo(() => {
    const start = periodRange.start
    const end = periodRange.end
    if (activeTab === 'daily') {
      const prevDate = new Date(start)
      prevDate.setDate(prevDate.getDate() - 1)
      return { start: startOfDay(prevDate), end: endOfDay(prevDate) }
    }
    if (activeTab === 'weekly') {
      const prevStart = new Date(start)
      prevStart.setDate(prevStart.getDate() - 7)
      const prevEnd = new Date(end)
      prevEnd.setDate(prevEnd.getDate() - 7)
      return { start: prevStart, end: prevEnd }
    }
    const prevStart = startOfMonth(new Date(start.getFullYear(), start.getMonth() - 1, 1))
    const prevEnd = endOfMonth(prevStart)
    return { start: prevStart, end: prevEnd }
  }, [activeTab, periodRange.end, periodRange.start])

  const periodInsights = useMemo<ReviewInsightsData | null>(() => {
    if (!taskStatsSnapshot) return null

    const habitRangeMap = {
      daily: 'day',
      weekly: 'week',
      monthly: 'month',
    } as const

    const taskPeriodStats =
      activeTab === 'daily'
        ? taskStatsSnapshot.today
        : activeTab === 'weekly'
          ? taskStatsSnapshot.weekly
          : taskStatsSnapshot.monthly

    const previousTaskRate =
      activeTab === 'daily'
        ? taskPeriodStats.weightedProgress
        : activeTab === 'weekly'
          ? taskStatsSnapshot.previousWeekly.weightedProgress
          : taskStatsSnapshot.previousMonthly.weightedProgress

    const habitAnalytics = calculateHabitAnalytics(
      habits,
      getDateRange(habitRangeMap[activeTab]),
      allHabitCompletions
    )
    const previousHabitAnalytics = calculateHabitAnalytics(habits, previousPeriodRange, allHabitCompletions)
    const goalAnalytics = calculateGoalAnalytics(goals, tasks, habits, periodRange)
    const timeAnalytics = calculateTimeAnalytics(tasks, periodRange)

    const tasksCreated = tasks.filter((task) => {
      if (task.deleted_at) return false
      const created = parseISO(task.created_at)
      return created >= periodRange.start && created <= periodRange.end
    }).length

    const incompleteStatuses = new Set(['pending', 'in-progress', 'blocked', 'skipped'])
    const overdueTasksCount = tasks.filter((task) => {
      if (task.deleted_at || !task.due_date) return false
      const due = parseISO(task.due_date)
      if (!(due >= periodRange.start && due <= periodRange.end)) return false
      if (due >= startOfDay(new Date())) return false
      return incompleteStatuses.has(task.status)
    }).length

    const blockedTasksCount = tasks.filter((task) => {
      if (task.deleted_at || task.status !== 'blocked') return false
      const updated = parseISO(task.updated_at)
      return updated >= periodRange.start && updated <= periodRange.end
    }).length

    const combinedDenominator = taskPeriodStats.plannedWeight + habitAnalytics.expectedPeriods
    const combinedNumerator = taskPeriodStats.earnedWeight + habitAnalytics.completedPeriods
    const combinedCompletionRate = combinedDenominator > 0
      ? Math.round((combinedNumerator / combinedDenominator) * 100)
      : 0

    const productivityTrend: ReviewInsights['productivityTrend'] =
      taskPeriodStats.weightedProgress > previousTaskRate
        ? 'improving'
        : taskPeriodStats.weightedProgress < previousTaskRate
          ? 'declining'
          : 'stable'

    const habitTrend: ReviewInsights['habitTrend'] =
      habitAnalytics.avgConsistency > previousHabitAnalytics.avgConsistency
        ? 'improving'
        : habitAnalytics.avgConsistency < previousHabitAnalytics.avgConsistency
          ? 'declining'
          : 'stable'

    const topCompletedTasks = tasks
      .filter((task) => {
        if (task.deleted_at || !task.completed_at) return false
        const completedAt = parseISO(task.completed_at)
        return completedAt >= periodRange.start && completedAt <= periodRange.end
      })
      .sort((a, b) => parseISO(b.completed_at || b.updated_at).getTime() - parseISO(a.completed_at || a.updated_at).getTime())
      .slice(0, 5)
      .map((task) => ({ id: task.id, title: task.title, completedAt: task.completed_at || task.updated_at }))

    const activeGoalsProgress = goalAnalytics.goalsWithProgress
      .filter((goal) => goal.status === 'active')
      .slice(0, 8)
      .map((goal) => ({ id: goal.id, title: goal.title, progress: goal.calculatedProgress, change: 0 }))

    const goalsAtRisk = goals
      .filter((goal) => goal.status === 'active' && !!goal.target_date && !goal.deleted_at)
      .filter((goal) => parseISO(goal.target_date!) < periodRange.end)
      .slice(0, 5)
      .map((goal) => ({ id: goal.id, title: goal.title, progress: goal.progress || 0, reason: 'Overdue' }))

    const dailyTaskCounts = new Map<string, number>()
    topCompletedTasks.forEach((task) => {
      const key = format(parseISO(task.completedAt), 'yyyy-MM-dd')
      dailyTaskCounts.set(key, (dailyTaskCounts.get(key) || 0) + 1)
    })
    const sortedTaskDays = Array.from(dailyTaskCounts.entries()).sort((a, b) => b[1] - a[1])

    const consistencyScore = Math.round((taskPeriodStats.weightedProgress + habitAnalytics.avgConsistency) / 2)

    return {
      tasksCompleted: taskPeriodStats.completed,
      tasksCreated,
      taskCompletionRate: taskPeriodStats.weightedProgress,
      taskEligibleCount: taskPeriodStats.total,
      overdueTasksCount,
      blockedTasksCount,
      avgTaskCompletionTime: timeAnalytics.avgDailyTime,
      topCompletedTasks,
      skippedOrAbandonedTasks: [],
      habitConsistencyRate: habitAnalytics.avgConsistency,
      habitsCompleted: habitAnalytics.completedPeriods,
      habitsMissed: Math.max(habitAnalytics.expectedPeriods - habitAnalytics.completedPeriods, 0),
      habitPeriodsCompleted: habitAnalytics.completedPeriods,
      habitPeriodsExpected: habitAnalytics.expectedPeriods,
      currentStreaks: habitAnalytics.topHabits.slice(0, 5).map((habit) => ({ id: habit.id, title: habit.title, streak: habit.streak_current })),
      brokenStreaks: [],
      habitTrend,
      activeGoalsProgress,
      goalsCompletedThisPeriod: goalAnalytics.completedInRange || 0,
      goalsAtRisk,
      mostProductiveDay: sortedTaskDays[0]?.[0],
      leastProductiveDay: sortedTaskDays[sortedTaskDays.length - 1]?.[0],
      productivityTrend,
      consistencyScore,
      combinedCompletionRate,
      periodStart: currentPeriod.start,
      periodEnd: currentPeriod.end,
      timeTrackedMinutes: Math.round(timeAnalytics.totalActualTime),
      timeActiveDays: timeAnalytics.daysWithActivity,
      goalsActiveCount: goalAnalytics.active,
      analyticsProductivityScore: consistencyScore,
    }
  }, [
    activeTab,
    allHabitCompletions,
    currentPeriod.end,
    currentPeriod.start,
    goals,
    habits,
    periodRange,
    previousPeriodRange,
    taskStatsSnapshot,
    tasks,
  ])

  const latestInsights = useMemo(() => {
    if (periodInsights) return periodInsights
    return latestCompletedReview?.insights || null
  }, [periodInsights, latestCompletedReview])

  const combinedCompletionRate = useMemo(() => {
    return getCombinedCompletionRate(latestInsights)
  }, [latestInsights])

  const reviewStreaks = useMemo(() => calculateReviewStreaks(allReviews), [allReviews])

  // Create review mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateReviewDTO) => database.createReview(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.invalidateQueries({ queryKey: ['review-existing'] })
      queryClient.invalidateQueries({ queryKey: ['reviews-history-all'] })
      toast({
        title: 'Review saved',
        description: 'Your review has been saved successfully.',
      })
      setIsEditing(false)
      setEditingReview(null)
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save review',
      })
    },
  })

  // Update review mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => database.updateReview(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.invalidateQueries({ queryKey: ['review-existing'] })
      queryClient.invalidateQueries({ queryKey: ['reviews-history-all'] })
      toast({
        title: 'Review updated',
        description: 'Your review has been updated successfully.',
      })
      setIsEditing(false)
      setEditingReview(null)
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update review',
      })
    },
  })

  // Delete review mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => database.deleteReview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.invalidateQueries({ queryKey: ['review-existing'] })
      queryClient.invalidateQueries({ queryKey: ['reviews-history-all'] })
      toast({
        title: 'Review deleted',
        description: 'Your review has been deleted.',
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete review',
      })
    },
  })

  // Create task mutation for Review -> Planning link
  const createTaskMutation = useMutation({
    mutationFn: async ({ title, description }: { title: string; description: string }) => {
      return database.createTask({
        title,
        description,
        priority: 'medium',
        tags: ['from-review'],
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      toast({
        title: 'Task created',
        description: 'Action item has been added to your tasks.',
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create task',
      })
    },
  })

  const handleStartReview = () => {
    if (existingReview) {
      setEditingReview(existingReview)
    }
    setIsEditing(true)
  }

  useEffect(() => {
    const openDailyReview = () => {
      setActiveTab('daily')
      setCurrentPeriod(getPeriodDates('daily'))
      setTimeout(() => {
        if (existingReview?.type === 'daily') {
          setEditingReview(existingReview)
        } else {
          setEditingReview(null)
        }
        setIsEditing(true)
      }, 0)
    }

    window.addEventListener('app:start-review', openDailyReview as EventListener)
    return () => window.removeEventListener('app:start-review', openDailyReview as EventListener)
  }, [existingReview])

  const handleEditReview = (review: Review) => {
    setEditingReview(review)
    setCurrentPeriod({
      start: review.period_start,
      end: review.period_end,
    })
    setIsEditing(true)
  }

  const handleSaveReview = (data: any) => {
    if (editingReview) {
      updateMutation.mutate({
        id: editingReview.id,
        data: {
          ...data,
          insights: periodInsights,
        },
      })
    } else {
      createMutation.mutate({
        type: activeTab,
        period_start: currentPeriod.start,
        period_end: currentPeriod.end,
        ...data,
        insights: periodInsights,
      })
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditingReview(null)
    setCurrentPeriod(getPeriodDates(activeTab))
  }

  const handleCreateTask = (title: string, description: string) => {
    createTaskMutation.mutate({ title, description })
  }

  const config = REVIEW_TYPES[activeTab]
  const Icon = config.icon

  // Check if review is due
  const isDue = useMemo(() => {
    if (existingReview?.status === 'completed') return false
    
    const now = new Date()
    switch (activeTab) {
      case 'daily':
        return true // Always show daily
      case 'weekly':
        // Show on Sundays or if no review this week
        return now.getDay() === 0 || !existingReview
      case 'monthly':
        // Show on last 3 days of month or if no review this month
        const daysLeft = endOfMonth(now).getDate() - now.getDate()
        return daysLeft <= 3 || !existingReview
      default:
        return true
    }
  }, [activeTab, existingReview])

  // Get current questions
  const currentQuestions = customReviewQuestions[activeTab] || []

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-baseline gap-1.5">
            Reviews
            <ContextTipsDialog
              title="Reviews Tab Tips"
              description="How reviews improve reflection, planning quality, and long-term insight reliability."
              sections={REVIEW_TIPS_SECTIONS}
              triggerLabel="Open review tips"
            />
          </h1>
          <p className="text-muted-foreground mt-1">
            Transform tracking into insight, activity into learning
          </p>
        </div>
        
        {/* Customize Questions Button */}
        <QuestionsCustomizationDialog
          type={activeTab}
          questions={currentQuestions}
          onUpdate={(questions) => updateReviewQuestions(activeTab, questions)}
          onAdd={(question) => addReviewQuestion(activeTab, question)}
          onRemove={(id) => removeReviewQuestion(activeTab, id)}
          onToggle={(id) => toggleReviewQuestion(activeTab, id)}
          onReset={() => resetReviewQuestions(activeTab)}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReviewType)}>
        <TabsList className="grid w-full grid-cols-3 max-w-md bg-secondary/30 dark:bg-secondary/20 p-1 h-12 border-transparent">
          {(Object.keys(REVIEW_TYPES) as ReviewType[]).map((type) => {
            const cfg = REVIEW_TYPES[type]
            const TypeIcon = cfg.icon
            return (
              <TabsTrigger key={type} value={type} className="flex items-center gap-2">
                <TypeIcon className={cn("h-4 w-4", cfg.color)} />
                {cfg.label.replace(' Review', '')}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {(Object.keys(REVIEW_TYPES) as ReviewType[]).map((type) => (
          <TabsContent key={type} value={type} className="space-y-6">
            {isEditing ? (
              <ReviewEditor
                type={type}
                review={editingReview}
                insights={periodInsights || null}
                questions={customReviewQuestions[type] || []}
                onSave={handleSaveReview}
                onCancel={handleCancelEdit}
                isLoading={createMutation.isPending || updateMutation.isPending}
                onCreateTask={handleCreateTask}
              />
            ) : (
              <>
                <Card className={cn(
                  "border-2",
                  config.borderColor,
                  isDue && "ring-2 ring-primary/20"
                )}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-3 rounded-xl", config.bgColor)}>
                          <Icon className={cn("h-6 w-6", config.color)} />
                        </div>
                        <div>
                          <CardTitle>{config.label}</CardTitle>
                          <CardDescription>{config.description}</CardDescription>
                        </div>
                      </div>
                      {isDue && (
                        <Badge variant="outline" className="bg-primary/10 text-primary">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Due
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {formatPeriodLabel(type, currentPeriod.start, currentPeriod.end)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {existingReview 
                            ? `${existingReview.status === 'completed' ? 'Completed' : 'Draft'} • ${format(parseISO(existingReview.updated_at), 'PPp')}`
                            : 'Not started yet'
                          }
                        </p>
                      </div>
                      <Button onClick={handleStartReview} className={cn(config.bgColor, config.color, "hover:opacity-90 hover:text-white transition-colors duration-200")}>
                        {existingReview ? (
                          <>
                            <Edit3 className="h-4 w-4 mr-2" />
                            {existingReview.status === 'completed' ? 'View' : 'Continue'}
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            Start Review
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Stats from live aggregated insights */}
                {latestInsights && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Latest Insights
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <>
                        <InsightCard
                          title="Tasks Completed"
                          value={latestInsights.tasksCompleted || 0}
                          icon={ListChecks}
                          trend={latestInsights.productivityTrend}
                          color="text-blue-500"
                        />
                        <InsightCard
                          title="Habit Consistency"
                          value={`${latestInsights.habitConsistencyRate || 0}%`}
                          icon={Flame}
                          trend={latestInsights.habitTrend}
                          color="text-orange-500"
                        />
                        <InsightCard
                          title="Completion Rate"
                          value={`${combinedCompletionRate}%`}
                          subtitle="Task + Habit completion"
                          icon={Target}
                          color="text-green-500"
                        />
                        <InsightCard
                          title="Review Streak"
                          value={
                            activeTab === 'daily' ? reviewStreaks.daily :
                            activeTab === 'weekly' ? reviewStreaks.weekly :
                            reviewStreaks.monthly
                          }
                          icon={Zap}
                          color="text-purple-500"
                        />
                      </>
                    </div>
                  </div>
                )}

                {/* Review History */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      Review History
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['reviews'] })}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </div>

                  {loadingReviews ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading reviews...
                    </div>
                  ) : reviews.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <p className="text-muted-foreground text-center">
                          No {type} reviews yet.<br />
                          Start your first review to track your progress.
                        </p>
                        <Button className="mt-4" onClick={handleStartReview}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create First Review
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {reviews.map((review) => (
                        <ReviewCard
                          key={review.id}
                          review={review}
                          onEdit={handleEditReview}
                          onDelete={(id) => deleteMutation.mutate(id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
