import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDay } from 'date-fns'
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Clock,
  BookOpen,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { database, Review } from '@/lib/database'

type ReviewType = 'daily' | 'weekly' | 'monthly'

interface ReviewTypeConfig {
  label: string
  shortLabel: string
  icon: React.ElementType
  color: string
  bgColor: string
  checkDue: () => boolean
  getPeriod: () => { start: string; end: string }
}

const REVIEW_CONFIGS: Record<ReviewType, ReviewTypeConfig> = {
  daily: {
    label: 'Daily Review',
    shortLabel: 'Daily',
    icon: Calendar,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    checkDue: () => true, // Always due if not completed today
    getPeriod: () => ({
      start: startOfDay(new Date()).toISOString(),
      end: endOfDay(new Date()).toISOString(),
    }),
  },
  weekly: {
    label: 'Weekly Review',
    shortLabel: 'Weekly',
    icon: CalendarDays,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    checkDue: () => {
      const today = getDay(new Date())
      // Due only on Sunday (Sunday = 0)
      return today === 0
    },
    getPeriod: () => ({
      start: startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString(),
      end: endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString(),
    }),
  },
  monthly: {
    label: 'Monthly Review',
    shortLabel: 'Monthly',
    icon: CalendarRange,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    checkDue: () => {
      const today = new Date()
      const endOfMo = endOfMonth(today)
      // Due only on the last day of month
      return today.getDate() === endOfMo.getDate()
    },
    getPeriod: () => ({
      start: startOfMonth(new Date()).toISOString(),
      end: endOfMonth(new Date()).toISOString(),
    }),
  },
}

interface ReviewReminderProps {
  compact?: boolean
  showAll?: boolean
  className?: string
}

export function ReviewReminder({ compact = false, showAll = false, className }: ReviewReminderProps) {
  const navigate = useNavigate()

  // Fetch latest reviews for each type
  const { data: dailyReview } = useQuery({
    queryKey: ['review-check', 'daily'],
    queryFn: async () => {
      const period = REVIEW_CONFIGS.daily.getPeriod()
      return database.getReviewForPeriod('daily', period.start, period.end)
    },
    staleTime: 60000, // 1 minute
  })

  const { data: weeklyReview } = useQuery({
    queryKey: ['review-check', 'weekly'],
    queryFn: async () => {
      const period = REVIEW_CONFIGS.weekly.getPeriod()
      return database.getReviewForPeriod('weekly', period.start, period.end)
    },
    staleTime: 60000,
  })

  const { data: monthlyReview } = useQuery({
    queryKey: ['review-check', 'monthly'],
    queryFn: async () => {
      const period = REVIEW_CONFIGS.monthly.getPeriod()
      return database.getReviewForPeriod('monthly', period.start, period.end)
    },
    staleTime: 60000,
  })

  // Check if there's actual content to review
  const { data: hasReviewableContent } = useQuery({
    queryKey: ['reviewable-content-check'],
    queryFn: async () => {
      try {
        // Check for any tasks
        const tasks = await database.getTasks({ status: undefined })
        const activeTasks = tasks.filter(t => !t.deleted_at)
        
        // Check for any goals
        const goals = await database.getGoals()
        const activeGoals = goals.filter(g => !g.deleted_at)
        
        // Check for any habits
        const habits = await database.getHabits()
        const activeHabits = habits.filter(h => !h.deleted_at)
        
        // Check for any time blocks (activity indicator)
        const todayStart = startOfDay(new Date()).toISOString()
        const todayEnd = endOfDay(new Date()).toISOString()
        const timeBlocks = await database.getTimeBlocks({ startDate: todayStart, endDate: todayEnd })
        
        // Check for any notes
        const notes = await database.getNotes()
        const activeNotes = notes.filter(n => !n.deleted_at)
        
        // Return true if there's any meaningful data
        const hasContent = activeTasks.length > 0 || 
                          activeGoals.length > 0 || 
                          activeHabits.length > 0 || 
                          timeBlocks.length > 0 ||
                          activeNotes.length > 0
        
        return hasContent
      } catch (error) {
        console.error('Error checking reviewable content:', error)
        return false
      }
    },
    staleTime: 300000, // 5 minutes
  })

  // Determine which reviews are due
  const dueReviews = useMemo(() => {
    // Don't show any reviews if there's no content to review
    if (!hasReviewableContent) {
      return []
    }

    const reviews: { type: ReviewType; config: ReviewTypeConfig; review: Review | null; isDue: boolean }[] = []

    // Check daily
    const dailyCompleted = dailyReview?.status === 'completed'
    const dailyDue = REVIEW_CONFIGS.daily.checkDue() && !dailyCompleted
    reviews.push({ type: 'daily', config: REVIEW_CONFIGS.daily, review: dailyReview || null, isDue: dailyDue })

    // Check weekly
    const weeklyCompleted = weeklyReview?.status === 'completed'
    const weeklyDue = REVIEW_CONFIGS.weekly.checkDue() && !weeklyCompleted
    reviews.push({ type: 'weekly', config: REVIEW_CONFIGS.weekly, review: weeklyReview || null, isDue: weeklyDue })

    // Check monthly
    const monthlyCompleted = monthlyReview?.status === 'completed'
    const monthlyDue = REVIEW_CONFIGS.monthly.checkDue() && !monthlyCompleted
    reviews.push({ type: 'monthly', config: REVIEW_CONFIGS.monthly, review: monthlyReview || null, isDue: monthlyDue })

    if (showAll) return reviews
    return reviews.filter(r => r.isDue || r.review?.status === 'draft')
  }, [dailyReview, weeklyReview, monthlyReview, showAll, hasReviewableContent])

  if (dueReviews.length === 0) {
    return null
  }

  const handleStartReview = (type: ReviewType) => {
    navigate(`/reviews?type=${type}`)
  }

  if (compact) {
    // Compact view for dashboard
    const primaryDue = dueReviews.find(r => r.isDue) || dueReviews[0]
    const Icon = primaryDue.config.icon

    return (
      <Card className={cn("cursor-pointer hover:shadow-md transition-shadow", className)} onClick={() => handleStartReview(primaryDue.type)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", primaryDue.config.bgColor)}>
                <Icon className={cn("h-5 w-5", primaryDue.config.color)} />
              </div>
              <div>
                <p className="font-medium text-sm">
                  {primaryDue.review?.status === 'draft' ? 'Continue' : 'Start'} {primaryDue.config.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dueReviews.filter(r => r.isDue).length} review{dueReviews.filter(r => r.isDue).length !== 1 ? 's' : ''} pending
                </p>
              </div>
            </div>
            <Button size="sm" variant="ghost">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Full view
  return (
    <Card className={cn("border-primary/20", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Reviews</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/reviews')}>
            View All
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        <CardDescription>
          Reflect, learn, and improve
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {dueReviews.map(({ type, config, review, isDue }) => {
          const Icon = config.icon
          const isCompleted = review?.status === 'completed'
          const isDraft = review?.status === 'draft'

          return (
            <div
              key={type}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer",
                isDue && "border-primary/30 bg-primary/5 hover:bg-primary/10",
                isCompleted && "border-green-500/30 bg-green-500/5",
                isDraft && "border-amber-500/30 bg-amber-500/5",
                !isDue && !isCompleted && !isDraft && "hover:bg-muted/50"
              )}
              onClick={() => handleStartReview(type)}
            >
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", config.bgColor)}>
                  <Icon className={cn("h-4 w-4", config.color)} />
                </div>
                <div>
                  <p className="font-medium text-sm">{config.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {isCompleted && (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Completed
                      </span>
                    )}
                    {isDraft && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Clock className="h-3 w-3" />
                        In Progress
                      </span>
                    )}
                    {isDue && !isDraft && (
                      <span className="flex items-center gap-1 text-primary">
                        <Sparkles className="h-3 w-3" />
                        Ready to start
                      </span>
                    )}
                    {!isDue && !isCompleted && !isDraft && "Not yet due"}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// Compact banner for the top of dashboard
export function ReviewBanner({ className }: { className?: string }) {
  const navigate = useNavigate()

  // Check if daily review is done
  const { data: dailyReview } = useQuery({
    queryKey: ['review-check', 'daily-banner'],
    queryFn: async () => {
      const period = REVIEW_CONFIGS.daily.getPeriod()
      return database.getReviewForPeriod('daily', period.start, period.end)
    },
    staleTime: 60000,
  })

  // Check if there's actual content to review
  const { data: hasReviewableContent } = useQuery({
    queryKey: ['reviewable-content-check'],
    queryFn: async () => {
      try {
        // Check for any tasks
        const tasks = await database.getTasks({ status: undefined })
        const activeTasks = tasks.filter(t => !t.deleted_at)
        
        // Check for any goals
        const goals = await database.getGoals()
        const activeGoals = goals.filter(g => !g.deleted_at)
        
        // Check for any habits
        const habits = await database.getHabits()
        const activeHabits = habits.filter(h => !h.deleted_at)
        
        // Check for any time blocks (activity indicator)
        const todayStart = startOfDay(new Date()).toISOString()
        const todayEnd = endOfDay(new Date()).toISOString()
        const timeBlocks = await database.getTimeBlocks({ startDate: todayStart, endDate: todayEnd })
        
        // Check for any notes
        const notes = await database.getNotes()
        const activeNotes = notes.filter(n => !n.deleted_at)
        
        // Return true if there's any meaningful data
        const hasContent = activeTasks.length > 0 || 
                          activeGoals.length > 0 || 
                          activeHabits.length > 0 || 
                          timeBlocks.length > 0 ||
                          activeNotes.length > 0
        
        return hasContent
      } catch (error) {
        console.error('Error checking reviewable content:', error)
        return false
      }
    },
    staleTime: 300000, // 5 minutes
  })

  const isDailyDue = !dailyReview || dailyReview.status !== 'completed'

  // Don't show banner if:
  // 1. Review is already completed
  // 2. There's no reviewable content (fresh install or no activity)
  if (!isDailyDue || !hasReviewableContent) {
    return null
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20 cursor-pointer hover:from-primary/15 hover:to-purple-500/15 transition-colors",
        className
      )}
      onClick={() => navigate('/reviews')}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/20">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-medium">
            {dailyReview?.status === 'draft' ? 'Continue your daily review' : 'Time for your daily review'}
          </p>
          <p className="text-sm text-muted-foreground">
            Reflect on today and plan for tomorrow
          </p>
        </div>
      </div>
      <Button size="sm" className="bg-primary/90 hover:bg-primary">
        {dailyReview?.status === 'draft' ? 'Continue' : 'Start Review'}
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  )
}

export default ReviewReminder
