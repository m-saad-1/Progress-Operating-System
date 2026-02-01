import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns'
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
  BookOpen,
  ListChecks,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
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
import { cn } from '@/lib/utils'
import { database, Review, ReviewInsights, CreateReviewDTO } from '@/lib/database'
import { useToaster } from '@/hooks/use-toaster'

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

// Review prompts for each type
const DAILY_PROMPTS = [
  { key: 'completedToday', question: 'What did I complete today?', placeholder: 'List your accomplishments, no matter how small...' },
  { key: 'blockers', question: 'What blocked me or slowed me down?', placeholder: 'Identify obstacles, distractions, or challenges...' },
  { key: 'habitsImpact', question: 'Did my habits support or hinder me?', placeholder: 'Reflect on how your daily habits affected your productivity...' },
  { key: 'tomorrowFocus', question: 'What should I focus on tomorrow?', placeholder: 'Set your top 1-3 priorities for tomorrow...' },
  { key: 'additionalNotes', question: 'Any additional thoughts?', placeholder: 'Free space for reflections, ideas, or gratitude...' },
]

const WEEKLY_PROMPTS = [
  { key: 'tasksThatMattered', question: 'Which tasks actually mattered this week?', placeholder: 'Identify high-impact work that moved the needle...' },
  { key: 'tasksWasted', question: 'What tasks turned out to be low value?', placeholder: 'Recognize time spent on things that didn\'t matter...' },
  { key: 'habitsSlipped', question: 'Which habits slipped or broke consistency?', placeholder: 'Be honest about which habits you struggled with...' },
  { key: 'habitsMaintained', question: 'Which habits did you maintain well?', placeholder: 'Celebrate the habits you kept consistent...' },
  { key: 'stopDoing', question: 'What should I STOP doing?', placeholder: 'Identify behaviors, tasks, or habits to eliminate...' },
  { key: 'continueDoing', question: 'What should I CONTINUE doing?', placeholder: 'What\'s working well that you should keep doing...' },
  { key: 'adjustments', question: 'What should I START or ADJUST?', placeholder: 'New approaches or modifications to try...' },
  { key: 'weeklyWin', question: 'What was your biggest win this week?', placeholder: 'Celebrate your top achievement...' },
  { key: 'biggestChallenge', question: 'What was your biggest challenge?', placeholder: 'Acknowledge difficulties you faced...' },
  { key: 'nextWeekPriorities', question: 'What are the priorities for next week?', placeholder: 'Set your top 3-5 priorities...' },
]

const MONTHLY_PROMPTS = [
  { key: 'progressAssessment', question: 'How do you assess your overall progress this month?', placeholder: 'Provide an honest evaluation of your month...' },
  { key: 'highProgressReasons', question: 'If progress was high, why?', placeholder: 'Identify what contributed to your success...' },
  { key: 'lowProgressReasons', question: 'If progress was low, why?', placeholder: 'Understand what held you back...' },
  { key: 'goalsAlignment', question: 'Am I working on the right goals?', placeholder: 'Evaluate if your goals still align with your vision...' },
  { key: 'goalsToAdjust', question: 'Which goals need adjustment?', placeholder: 'Identify goals that need changes to timeline, scope, or approach...' },
  { key: 'goalsToAdd', question: 'What new goals should I consider?', placeholder: 'Think about areas you want to develop...' },
  { key: 'goalsToRemove', question: 'What goals should I drop or defer?', placeholder: 'Be honest about what\'s not serving you...' },
  { key: 'habitsIdentityAlignment', question: 'Are my habits aligned with who I want to become?', placeholder: 'Reflect on identity-level behavior change...' },
  { key: 'keyLearnings', question: 'What are the key learnings from this month?', placeholder: 'Capture insights that will help you grow...' },
  { key: 'nextMonthChanges', question: 'What must change next month?', placeholder: 'Identify critical changes to make...' },
  { key: 'nextMonthGoals', question: 'What are your top goals for next month?', placeholder: 'Set clear intentions for the coming month...' },
  { key: 'monthlyHighlight', question: 'What was the highlight of this month?', placeholder: 'Capture your best moment or achievement...' },
]

function getPrompts(type: ReviewType) {
  switch (type) {
    case 'daily': return DAILY_PROMPTS
    case 'weekly': return WEEKLY_PROMPTS
    case 'monthly': return MONTHLY_PROMPTS
  }
}

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
  trend?: 'up' | 'down' | 'stable'
  color?: string
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-2xl font-bold", color)}>{value}</span>
              {trend && (
                <span className={cn(
                  "flex items-center text-xs",
                  trend === 'up' && "text-green-500",
                  trend === 'down' && "text-red-500",
                  trend === 'stable' && "text-muted-foreground"
                )}>
                  {trend === 'up' && <TrendingUp className="h-3 w-3 mr-0.5" />}
                  {trend === 'down' && <TrendingDown className="h-3 w-3 mr-0.5" />}
                  {trend === 'stable' && <Minus className="h-3 w-3 mr-0.5" />}
                  {trend}
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

// Review Editor Component
function ReviewEditor({
  type,
  review,
  insights,
  onSave,
  onCancel,
  isLoading,
}: {
  type: ReviewType
  review: Review | null
  insights: ReviewInsights | null
  onSave: (data: any) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const prompts = getPrompts(type)
  const [responses, setResponses] = useState<Record<string, string>>(
    review?.responses || {}
  )
  const [ratings, setRatings] = useState({
    energyLevel: review?.responses?.energyLevel || 3,
    productivityRating: review?.responses?.productivityRating || 3,
    overallSatisfaction: review?.responses?.overallSatisfaction || 3,
    overallRating: review?.responses?.overallRating || 3,
  })
  const [currentStep, setCurrentStep] = useState(0)

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
      status,
    }
    onSave(data)
  }

  const currentPrompt = prompts[currentStep]
  const isLastStep = currentStep === prompts.length - 1
  const isFirstStep = currentStep === 0

  const completedPrompts = prompts.filter(p => responses[p.key]?.trim()).length
  const progress = (completedPrompts / prompts.length) * 100

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Question {currentStep + 1} of {prompts.length}
          </span>
          <span className="text-muted-foreground">
            {completedPrompts} answered
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Insights Panel (collapsible on the side) */}
      {insights && (
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              Period Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Tasks Completed</p>
                <p className="text-lg font-semibold">{insights.tasksCompleted}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Completion Rate</p>
                <p className="text-lg font-semibold">{insights.taskCompletionRate}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">Habit Consistency</p>
                <p className="text-lg font-semibold">{insights.habitConsistencyRate}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">Active Streaks</p>
                <p className="text-lg font-semibold">{insights.currentStreaks.length}</p>
              </div>
            </div>
            
            {/* Goals at risk */}
            {insights.goalsAtRisk.length > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Goals Needing Attention</span>
                </div>
                <ul className="text-sm space-y-1">
                  {insights.goalsAtRisk.slice(0, 3).map(goal => (
                    <li key={goal.id} className="text-muted-foreground">
                      • {goal.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Top completed tasks */}
            {insights.topCompletedTasks.length > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Completed Tasks</span>
                </div>
                <ul className="text-sm space-y-1">
                  {insights.topCompletedTasks.slice(0, 3).map(task => (
                    <li key={task.id} className="text-muted-foreground">
                      • {task.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Current Question */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{currentPrompt.question}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={responses[currentPrompt.key] || ''}
            onChange={(e) => handleResponseChange(currentPrompt.key, e.target.value)}
            placeholder={currentPrompt.placeholder}
            className="min-h-[150px] resize-none"
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
              <Slider
                value={[ratings.energyLevel]}
                onValueChange={([v]) => handleRatingChange('energyLevel', v)}
                min={1}
                max={5}
                step={1}
              />
            </div>
            <div className="space-y-3">
              <Label>Productivity: {ratings.productivityRating}/5</Label>
              <Slider
                value={[ratings.productivityRating]}
                onValueChange={([v]) => handleRatingChange('productivityRating', v)}
                min={1}
                max={5}
                step={1}
              />
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
              <Slider
                value={[ratings.overallSatisfaction]}
                onValueChange={([v]) => handleRatingChange('overallSatisfaction', v)}
                min={1}
                max={5}
                step={1}
              />
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
              <Slider
                value={[ratings.overallRating]}
                onValueChange={([v]) => handleRatingChange('overallRating', v)}
                min={1}
                max={5}
                step={1}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
            disabled={isFirstStep}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrentStep(s => Math.min(prompts.length - 1, s + 1))}
            disabled={isLastStep}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleSave('draft')}
            disabled={isLoading}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button 
            onClick={() => handleSave('completed')}
            disabled={isLoading || completedPrompts < prompts.length * 0.5}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Complete Review
          </Button>
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
  
  const completedQuestions = Object.keys(review.responses || {}).filter(
    k => typeof review.responses[k] === 'string' && review.responses[k].trim()
  ).length
  
  const totalQuestions = getPrompts(review.type as ReviewType).length

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
                  {completedQuestions}/{totalQuestions} questions
                </span>
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
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Review</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this review? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(review.id)}>
                    Delete
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
  const [activeTab, setActiveTab] = useState<ReviewType>('daily')
  const [isEditing, setIsEditing] = useState(false)
  const [editingReview, setEditingReview] = useState<Review | null>(null)
  const [currentPeriod, setCurrentPeriod] = useState(getPeriodDates('daily'))

  // Update period when tab changes
  useEffect(() => {
    setCurrentPeriod(getPeriodDates(activeTab))
  }, [activeTab])

  // Fetch reviews
  const { data: reviews = [], isLoading: loadingReviews } = useQuery({
    queryKey: ['reviews', activeTab],
    queryFn: () => database.getReviews(activeTab, 50),
  })

  // Fetch insights for current period
  const { data: insights } = useQuery({
    queryKey: ['review-insights', currentPeriod.start, currentPeriod.end],
    queryFn: () => database.getReviewInsights(currentPeriod.start, currentPeriod.end),
    enabled: isEditing,
  })

  // Check for existing review in current period
  const { data: existingReview } = useQuery({
    queryKey: ['review-existing', activeTab, currentPeriod.start, currentPeriod.end],
    queryFn: () => database.getReviewForPeriod(activeTab, currentPeriod.start, currentPeriod.end),
  })

  // Create review mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateReviewDTO) => database.createReview(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.invalidateQueries({ queryKey: ['review-existing'] })
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

  const handleStartReview = () => {
    if (existingReview) {
      setEditingReview(existingReview)
    }
    setIsEditing(true)
  }

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
          insights,
        },
      })
    } else {
      createMutation.mutate({
        type: activeTab,
        period_start: currentPeriod.start,
        period_end: currentPeriod.end,
        ...data,
        insights,
      })
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditingReview(null)
    setCurrentPeriod(getPeriodDates(activeTab))
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            Reviews
          </h1>
          <p className="text-muted-foreground mt-1">
            Transform tracking into insight, activity into learning
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReviewType)}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
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
                insights={insights || null}
                onSave={handleSaveReview}
                onCancel={handleCancelEdit}
                isLoading={createMutation.isPending || updateMutation.isPending}
              />
            ) : (
              <>
                {/* Current Period Review Card */}
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
                      <Button onClick={handleStartReview} className={cn(config.bgColor, config.color, "hover:opacity-90")}>
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

                {/* Quick Stats from Latest Completed Review */}
                {reviews.filter(r => r.status === 'completed').length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Latest Insights
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {reviews[0]?.insights && (
                        <>
                          <InsightCard
                            title="Tasks Completed"
                            value={reviews[0].insights.tasksCompleted || 0}
                            icon={ListChecks}
                            trend={reviews[0].insights.productivityTrend as any}
                            color="text-blue-500"
                          />
                          <InsightCard
                            title="Habit Consistency"
                            value={`${reviews[0].insights.habitConsistencyRate || 0}%`}
                            icon={Flame}
                            trend={reviews[0].insights.habitTrend as any}
                            color="text-orange-500"
                          />
                          <InsightCard
                            title="Completion Rate"
                            value={`${reviews[0].insights.taskCompletionRate || 0}%`}
                            icon={Target}
                            color="text-green-500"
                          />
                          <InsightCard
                            title="Active Streaks"
                            value={reviews[0].insights.currentStreaks?.length || 0}
                            icon={Zap}
                            color="text-purple-500"
                          />
                        </>
                      )}
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
