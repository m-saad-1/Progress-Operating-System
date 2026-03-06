import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Archive as ArchiveIcon,
  Search,
  Trash2,
  Clock,
  Calendar,
  Target,
  CheckSquare,
  FileText,
  AlertTriangle,
  Flame,
  TrendingUp,
  FolderArchive,
  History,
  Undo2,
  ClipboardList
} from 'lucide-react'
import { parseISO, format, formatDistanceToNow } from 'date-fns'
import { useToaster } from '@/hooks/use-toaster'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import { database, Task, Habit, Goal } from '@/lib/database'
import { ContextTipsDialog } from '@/components/context-tips-dialog'

type ArchivedItemType = 'goal' | 'task' | 'habit' | 'note' | 'review'

interface ArchivedItem {
  id: string
  title: string
  description?: string
  deleted_at: string | null
  type: ArchivedItemType
  // Type-specific fields
  progress?: number
  priority?: string
  status?: string
  frequency?: string
  streak_current?: number
  streak_longest?: number
  consistency_score?: number
  category?: string
  content?: string
  goal_title?: string
  // Review-specific fields
  review_type?: 'daily' | 'weekly' | 'monthly'
  period_start?: string
  period_end?: string
}

const ARCHIVE_TIPS_SECTIONS = [
  {
    title: 'Archive Purpose',
    points: [
      'Archive is for cleanup without losing operational history immediately.',
      'Use restore when an item becomes relevant again, preserving continuity.',
      'Use permanent delete only when data should never be used again.',
    ],
  },
  {
    title: 'Safety and Recovery',
    points: [
      'Review selected items before bulk deletion to avoid accidental loss.',
      'Restoring tasks, habits, goals, notes, or reviews returns them to active workflows.',
      'Keep high-value context archived until you are certain it is no longer needed.',
    ],
  },
  {
    title: 'Best Practices',
    points: [
      'Search and filter before action to verify scope.',
      'Archive gradually as part of weekly cleanup to keep active views focused.',
      'Prefer archive over deletion when decisions or trends may be audited later.',
    ],
  },
] as const

export default function Archive() {
  const queryClient = useQueryClient()
  const { success, error: toastError } = useToaster()
  const { restoreTask, restoreHabit, restoreGoal, allowHistoryDeletion } = useStore()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  // Fetch archived items using the new database method
  const { data: archivedData, isLoading } = useQuery({
    queryKey: ['archive'],
    queryFn: async () => {
      const data = await database.getArchivedItems()
      return {
        tasks: data.tasks.map(t => ({ ...t, type: 'task' as const })),
        habits: data.habits.map(h => ({ ...h, type: 'habit' as const })),
        goals: data.goals.map(g => ({ ...g, type: 'goal' as const })),
        notes: data.notes.map(n => ({ ...n, type: 'note' as const })),
        reviews: data.reviews.map(r => ({ 
          ...r, 
          type: 'review' as const,
          title: `${r.type.charAt(0).toUpperCase() + r.type.slice(1)} Review`,
          review_type: r.type,
          description: r.status === 'completed' ? 'Completed review' : 'Draft review',
        })),
      }
    },
  })

  // Compute all items and stats
  const allItems = useMemo(() => {
    if (!archivedData) return []
    return [
      ...archivedData.goals,
      ...archivedData.tasks,
      ...archivedData.habits,
      ...archivedData.notes,
      ...archivedData.reviews,
    ].sort((a, b) => 
      new Date(b.deleted_at!).getTime() - new Date(a.deleted_at!).getTime()
    )
  }, [archivedData])

  const stats = useMemo(() => ({
    total: allItems.length,
    goals: archivedData?.goals.length || 0,
    tasks: archivedData?.tasks.length || 0,
    habits: archivedData?.habits.length || 0,
    notes: archivedData?.notes.length || 0,
    reviews: archivedData?.reviews.length || 0,
  }), [allItems, archivedData])

  // Filter items based on search and selected type
  const filteredItems = useMemo(() => {
    let items: ArchivedItem[] = []
    
    if (selectedType === 'all') {
      items = allItems
    } else if (selectedType === 'goals') {
      items = archivedData?.goals || []
    } else if (selectedType === 'tasks') {
      items = archivedData?.tasks || []
    } else if (selectedType === 'habits') {
      items = archivedData?.habits || []
    } else if (selectedType === 'notes') {
      items = archivedData?.notes || []
    } else if (selectedType === 'reviews') {
      items = archivedData?.reviews || []
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      items = items.filter(item => 
        item.title.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
      )
    }

    return items
  }, [selectedType, searchQuery, allItems, archivedData])

  const getItemKey = (item: ArchivedItem) => `${item.type}:${item.id}`

  const selectedArchivedItems = useMemo(() => {
    if (selectedItems.size === 0) return []
    return allItems.filter((item) => selectedItems.has(getItemKey(item)))
  }, [allItems, selectedItems])

  const clearSelection = () => setSelectedItems(new Set())



  const toggleItemSelection = (item: ArchivedItem) => {
    const key = getItemKey(item)
    setSelectedItems((previous) => {
      const next = new Set(previous)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const permanentlyDeleteArchivedItem = async (type: ArchivedItemType, id: string) => {
    switch (type) {
      case 'task':
        await database.permanentlyDeleteTask(id, { deleteHistory: allowHistoryDeletion })
        break
      case 'habit':
        await database.permanentlyDeleteHabit(id)
        break
      case 'goal':
        await database.permanentlyDeleteGoal(id)
        break
      case 'note':
        await database.permanentlyDeleteNote(id)
        break
      case 'review':
        await database.permanentlyDeleteReview(id)
        break
    }
  }

  // Restore item mutation
  const restoreItemMutation = useMutation({
    mutationFn: async ({ type, id }: { type: ArchivedItemType; id: string }) => {
      switch (type) {
        case 'task':
          return { type, data: await database.restoreTask(id) }
        case 'habit':
          return { type, data: await database.restoreHabit(id) }
        case 'goal':
          return { type, data: await database.restoreGoal(id) }
        case 'note':
          return { type, data: await database.restoreNote(id) }
        case 'review':
          return { type, data: await database.restoreReview(id) }
      }
    },
    onSuccess: (result) => {
      if (result?.data) {
        // Update the store with restored item
        switch (result.type) {
          case 'task':
            restoreTask(result.data as Task)
            break
          case 'habit':
            restoreHabit(result.data as Habit)
            break
          case 'goal':
            restoreGoal(result.data as Goal)
            break
        }
      }
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['archive'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['habits'] })
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      queryClient.invalidateQueries({ queryKey: ['task-stats'] })
      queryClient.invalidateQueries({ queryKey: ['task-analytics-chart'] })
      success('Item restored successfully! Historical progress preserved.')
    },
    onError: (error) => {
      console.error('Failed to restore item:', error)
      toastError('Failed to restore item')
    },
  })

  // Permanently delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async ({ type, id }: { type: ArchivedItemType; id: string }) => {
      await permanentlyDeleteArchivedItem(type, id)
      return { type, id }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archive'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      queryClient.invalidateQueries({ queryKey: ['task-stats'] })
      queryClient.invalidateQueries({ queryKey: ['task-analytics-chart'] })
      success('Item permanently deleted')
    },
    onError: (error) => {
      console.error('Failed to delete item:', error)
      toastError('Failed to delete item')
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: async (items: ArchivedItem[]) => {
      await Promise.all(items.map((item) => permanentlyDeleteArchivedItem(item.type, item.id)))
      return items.length
    },
    onSuccess: (deletedCount) => {
      queryClient.invalidateQueries({ queryKey: ['archive'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      queryClient.invalidateQueries({ queryKey: ['task-stats'] })
      queryClient.invalidateQueries({ queryKey: ['task-analytics-chart'] })
      clearSelection()
      success(`${deletedCount} item${deletedCount === 1 ? '' : 's'} permanently deleted`)
    },
    onError: (error) => {
      console.error('Failed to batch delete items:', error)
      toastError('Failed to delete selected items')
    },
  })

  const batchRestoreMutation = useMutation({
    mutationFn: async (items: ArchivedItem[]) => {
      const results = await Promise.all(items.map(async (item) => {
        switch (item.type) {
          case 'task':
            return { type: item.type, data: await database.restoreTask(item.id) }
          case 'habit':
            return { type: item.type, data: await database.restoreHabit(item.id) }
          case 'goal':
            return { type: item.type, data: await database.restoreGoal(item.id) }
          case 'note':
            return { type: item.type, data: await database.restoreNote(item.id) }
          case 'review':
            return { type: item.type, data: await database.restoreReview(item.id) }
        }
      }))
      return { items, results }
    },
    onSuccess: ({ items, results }) => {
      // Update store with restored items
      results.forEach((result) => {
        if (result?.data) {
          switch (result.type) {
            case 'task':
              restoreTask(result.data as Task)
              break
            case 'habit':
              restoreHabit(result.data as Habit)
              break
            case 'goal':
              restoreGoal(result.data as Goal)
              break
          }
        }
      })
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['archive'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['habits'] })
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      queryClient.invalidateQueries({ queryKey: ['task-stats'] })
      queryClient.invalidateQueries({ queryKey: ['task-analytics-chart'] })
      clearSelection()
      success(`${items.length} item${items.length === 1 ? '' : 's'} restored successfully! Historical progress preserved.`)
    },
    onError: (error) => {
      console.error('Failed to batch restore items:', error)
      toastError('Failed to restore selected items')
    },
  })

  // Clear all archived items mutation
  const clearArchiveMutation = useMutation({
    mutationFn: async () => {
      await database.clearArchive()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archive'] })
      setConfirmClearAll(false)
      success('Archive cleared successfully')
    },
    onError: (error) => {
      console.error('Failed to clear archive:', error)
      toastError('Failed to clear archive')
    },
  })

  const getItemIcon = (type: ArchivedItemType) => {
    switch (type) {
      case 'goal': return <Target className="h-5 w-5" />
      case 'task': return <CheckSquare className="h-5 w-5" />
      case 'habit': return <Calendar className="h-5 w-5" />
      case 'note': return <FileText className="h-5 w-5" />
      case 'review': return <ClipboardList className="h-5 w-5" />
    }
  }

  const getItemColor = (type: ArchivedItemType) => {
    switch (type) {
      case 'goal': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
      case 'task': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
      case 'habit': return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
      case 'note': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
      case 'review': return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 dark:border-red-500/20'
      case 'high': return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30 dark:border-orange-500/20'
      case 'medium': return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 dark:border-yellow-500/20'
      case 'low': return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30 dark:border-green-500/20'
      default: return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getFrequencyColor = (frequency: string) => {
    switch (frequency) {
      case 'daily': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 dark:border-blue-500/20'
      case 'weekly': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 dark:border-purple-500/20'
      case 'monthly': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 dark:border-emerald-500/20'
      default: return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30 dark:border-green-500/20'
      case 'in-progress': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 dark:border-blue-500/20'
      case 'blocked': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 dark:border-amber-500/20'
      case 'pending': return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30 dark:border-slate-500/20'
      case 'draft': return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30 dark:border-orange-500/20'
      default: return 'bg-muted text-muted-foreground border-border'
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">Archive</h1>
              <ContextTipsDialog
                title="Archive Tab Tips"
                description="Guidance for safe restore/delete decisions and archive hygiene."
                sections={ARCHIVE_TIPS_SECTIONS}
                triggerLabel="Open archive tips"
                onboardingKey="archive-tab-tips"
              />
            </div>
            <p className="text-muted-foreground">
              Restore or permanently delete archived items. Progress history is preserved.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="px-3 py-1.5 text-sm">
            <ArchiveIcon className="mr-2 h-4 w-4" />
            {stats.total} items
          </Badge>
          
          <AlertDialog open={confirmClearAll} onOpenChange={setConfirmClearAll}>
            <AlertDialogTrigger asChild>
              <Button
                variant="default"
                disabled={stats.total === 0 || clearArchiveMutation.isPending}
                className="bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800 border-0 shadow-sm"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-white dark:bg-card border border-border shadow-lg">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Clear Entire Archive?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete <strong>{stats.total} items</strong> including:
                  <ul className="mt-2 ml-4 list-disc text-sm">
                    {stats.goals > 0 && <li>{stats.goals} goals</li>}
                    {stats.tasks > 0 && <li>{stats.tasks} tasks</li>}
                    {stats.habits > 0 && <li>{stats.habits} habits (and their completion history)</li>}
                    {stats.notes > 0 && <li>{stats.notes} notes</li>}
                    {stats.reviews > 0 && <li>{stats.reviews} reviews</li>}
                  </ul>
                  <p className="mt-3 text-destructive font-medium">This action cannot be undone.</p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => clearArchiveMutation.mutate()}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {clearArchiveMutation.isPending ? 'Clearing...' : 'Delete All'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
          {selectedArchivedItems.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="default"
                  disabled={selectedArchivedItems.length === 0 || batchDeleteMutation.isPending}
                  className="bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800 border-0"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected ({selectedArchivedItems.length})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-white dark:bg-card border border-border shadow-lg">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete selected archive items?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete <strong>{selectedArchivedItems.length}</strong> selected item(s). This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => batchDeleteMutation.mutate(selectedArchivedItems)}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    {batchDeleteMutation.isPending ? 'Deleting...' : 'Delete Selected'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Archived</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
              <ArchiveIcon className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Items safely stored
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-purple-500/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Goals</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Target className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-500">{stats.goals}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Archived goals
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-blue-500/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <CheckSquare className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-500">{stats.tasks}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Archived tasks
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-green-500/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Habits</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{stats.habits}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Archived habits
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-amber-500/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notes</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-500">{stats.notes}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Archived notes
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-indigo-500/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reviews</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <ClipboardList className="h-4 w-4 text-indigo-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-500">{stats.reviews}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Archived reviews
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <Card className="border-green-500/30 bg-gradient-to-r from-green-500/5 to-emerald-500/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
              <History className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold text-green-600 dark:text-green-400">Progress History Preserved</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Archived items retain all historical data. When restored, your progress percentages, 
                streak counts, and completion history remain intact. No retroactive recalculation needed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card className="border-border/10">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search archived items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary/30 border border-green-500/20 focus-visible:ring-1 focus-visible:ring-green-500/50 focus-visible:border-green-500/40 dark:bg-secondary/20 dark:border-green-500/15"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs and Content */}
      <Tabs value={selectedType} onValueChange={setSelectedType} className="space-y-6">
        <TabsList className="w-full bg-secondary/30 dark:bg-secondary/20 p-1 h-12 border-transparent">
          <TabsTrigger value="all" className="flex-1">
            <ArchiveIcon className="mr-2 h-4 w-4" />
            All ({stats.total})
          </TabsTrigger>
          <TabsTrigger value="goals" className="flex-1">
            <Target className="mr-2 h-4 w-4" />
            Goals ({stats.goals})
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex-1">
            <CheckSquare className="mr-2 h-4 w-4" />
            Tasks ({stats.tasks})
          </TabsTrigger>
          <TabsTrigger value="habits" className="flex-1">
            <Calendar className="mr-2 h-4 w-4" />
            Habits ({stats.habits})
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex-1">
            <FileText className="mr-2 h-4 w-4" />
            Notes ({stats.notes})
          </TabsTrigger>
          <TabsTrigger value="reviews" className="flex-1">
            <ClipboardList className="mr-2 h-4 w-4" />
            Reviews ({stats.reviews})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedType} className="mt-6 space-y-4">
          {/* Selection Action Bar */}
          {selectedArchivedItems.length > 0 && (
            <Card className="border-blue-500/30 bg-gradient-to-r from-blue-500/5 to-blue-500/10">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CheckSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span>{selectedArchivedItems.length} item{selectedArchivedItems.length === 1 ? '' : 's'} selected</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => batchRestoreMutation.mutate(selectedArchivedItems)}
                      disabled={batchRestoreMutation.isPending}
                      className="bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-300 hover:bg-green-500/20 hover:border-green-500/50"
                    >
                      <Undo2 className="mr-2 h-4 w-4" />
                      {batchRestoreMutation.isPending ? 'Restoring...' : 'Restore'}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={batchDeleteMutation.isPending}
                          className="bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-300 hover:bg-red-500/20 hover:border-red-500/50"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-white dark:bg-card border border-border shadow-lg">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Delete {selectedArchivedItems.length} selected item{selectedArchivedItems.length === 1 ? '' : 's'}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete <strong>{selectedArchivedItems.length}</strong> item{selectedArchivedItems.length === 1 ? '' : 's'}. This action cannot be undone.
                            {selectedArchivedItems.some((item) => item.type === 'habit') && (
                              <span className="block mt-2 text-destructive">
                                Habit completion history will be permanently deleted.
                              </span>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => batchDeleteMutation.mutate(selectedArchivedItems)}
                            className="bg-orange-500 hover:bg-orange-600"
                          >
                            {batchDeleteMutation.isPending ? 'Deleting...' : 'Delete Selected'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-xl bg-muted"></div>
                      <div className="flex-1 space-y-3">
                        <div className="h-5 bg-muted rounded w-1/3"></div>
                        <div className="h-4 bg-muted rounded w-2/3"></div>
                        <div className="h-3 bg-muted rounded w-1/4"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="pt-12 pb-12 text-center">
                <div className="h-16 w-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                  <FolderArchive className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  {searchQuery ? 'No matching items found' : 'Archive is empty'}
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {searchQuery 
                    ? 'Try a different search term or clear the filter'
                    : 'Items you archive will appear here. Archived items preserve their progress and can be restored anytime.'
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <ArchivedItemCard
                  key={`${item.type}-${item.id}`}
                  item={item}
                  onRestore={() => restoreItemMutation.mutate({ type: item.type, id: item.id })}
                  onDelete={() => deleteItemMutation.mutate({ type: item.type, id: item.id })}
                  isRestoring={restoreItemMutation.isPending}
                  isDeleting={deleteItemMutation.isPending}
                  getItemIcon={getItemIcon}
                  getItemColor={getItemColor}
                  getPriorityColor={getPriorityColor}
                  getFrequencyColor={getFrequencyColor}
                  getStatusColor={getStatusColor}
                  allowHistoryDeletion={allowHistoryDeletion}
                  isSelected={selectedItems.has(getItemKey(item))}
                  onSelectToggle={() => toggleItemSelection(item)}
                  showCheckboxes={selectedArchivedItems.length > 0}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Archived Item Card Component
function ArchivedItemCard({
  item,
  onRestore,
  onDelete,
  isRestoring,
  isDeleting,
  getItemIcon,
  getItemColor,
  getPriorityColor,
  getFrequencyColor,
  getStatusColor,
  allowHistoryDeletion,
  isSelected,
  onSelectToggle,
  showCheckboxes = false,
}: {
  item: ArchivedItem
  onRestore: () => void
  onDelete: () => void
  isRestoring: boolean
  isDeleting: boolean
  getItemIcon: (type: ArchivedItemType) => React.ReactNode
  getItemColor: (type: ArchivedItemType) => string
  getPriorityColor: (priority: string) => string
  getFrequencyColor: (frequency: string) => string
  getStatusColor: (status: string) => string
  allowHistoryDeletion: boolean
  isSelected: boolean
  onSelectToggle: () => void
  showCheckboxes?: boolean
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  return (
    <Card interactive className="group transition-all duration-200 border-border/50">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center border transition-colors",
            getItemColor(item.type)
          )}>
            {getItemIcon(item.type)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Title and badges */}
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-semibold truncate">{item.title}</h3>
                  <Badge className={cn('capitalize text-xs border pointer-events-none', getItemColor(item.type))}>
                    {item.type}
                  </Badge>
                  {item.priority && (
                    <Badge className={cn("text-xs border pointer-events-none", getPriorityColor(item.priority))}>
                      {item.priority}
                    </Badge>
                  )}
                  {item.status && (
                    <Badge className={cn('text-xs border capitalize pointer-events-none', getStatusColor(item.status))}>
                      {item.status}
                    </Badge>
                  )}
                  {item.review_type && (
                    <Badge className="text-xs border bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 dark:border-indigo-500/20 capitalize pointer-events-none">
                      {item.review_type}
                    </Badge>
                  )}
                </div>

                {/* Description */}
                {item.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {item.description}
                  </p>
                )}

                {/* Meta info */}
                <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {item.deleted_at && (
                    <span className="flex items-center">
                      <Clock className="mr-1.5 h-3.5 w-3.5" />
                      Archived {formatDistanceToNow(parseISO(item.deleted_at), { addSuffix: true })}
                    </span>
                  )}

                  {/* Type-specific info */}
                  {item.type === 'task' && item.progress !== undefined && (
                    <span className="flex items-center">
                      <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
                      Progress: {item.progress}%
                    </span>
                  )}

                  {item.type === 'goal' && item.progress !== undefined && (
                    <span className="flex items-center">
                      <Target className="mr-1.5 h-3.5 w-3.5" />
                      Progress: {item.progress}%
                    </span>
                  )}

                  {item.type === 'habit' && (
                    <>
                      {item.streak_current !== undefined && item.streak_current > 0 && (
                        <span className="flex items-center">
                          <Flame className="mr-1.5 h-3.5 w-3.5 text-orange-500" />
                          Streak: {item.streak_current} days
                        </span>
                      )}
                      {item.streak_longest !== undefined && item.streak_longest > 0 && (
                        <span className="flex items-center">
                          <Flame className="mr-1.5 h-3.5 w-3.5 text-amber-500" />
                          Best: {item.streak_longest} days
                        </span>
                      )}
                      {item.consistency_score !== undefined && (
                        <span className="flex items-center">
                          <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
                          Consistency: {Math.round(item.consistency_score)}%
                        </span>
                      )}
                    </>
                  )}

                  {item.goal_title && (
                    <span className="flex items-center">
                      <Target className="mr-1.5 h-3.5 w-3.5 text-purple-500" />
                      {item.goal_title}
                    </span>
                  )}

                  {item.category && (
                    <Badge className="text-xs capitalize border bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30 dark:border-violet-500/20 pointer-events-none">
                      {item.category}
                    </Badge>
                  )}

                  {item.frequency && (
                    <Badge className={cn('text-xs capitalize border pointer-events-none', getFrequencyColor(item.frequency))}>
                      {item.frequency}
                    </Badge>
                  )}

                  {item.type === 'review' && item.period_start && item.period_end && (
                    <span className="flex items-center">
                      <Calendar className="mr-1.5 h-3.5 w-3.5 text-indigo-500" />
                      {format(parseISO(item.period_start), 'MMM d, yyyy')} - {format(parseISO(item.period_end), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>

              </div>

              {/* Actions */}
              <div className={cn(
                "flex items-center gap-2 transition-opacity",
                "opacity-100"
              )}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRestore}
                  disabled={isRestoring}
                  className="bg-transparent dark:bg-transparent border-green-500/30 text-green-600 dark:text-green-300 hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-200 hover:border-green-500/50 transition-colors duration-200"
                >
                  <Undo2 className="mr-2 h-4 w-4" />
                  {isRestoring ? 'Restoring...' : 'Restore'}
                </Button>

                <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isDeleting}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-white dark:bg-card border border-border shadow-lg">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Permanently Delete?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {item.type === 'task' ? (
                          allowHistoryDeletion ? (
                            <>
                              This will permanently remove the task AND all its historical progress data.
                              <span className="block mt-2 font-medium">This action cannot be undone.</span>
                            </>
                          ) : (
                            <>
                              This will permanently remove the task from your workspace.
                              <span className="block mt-2">Historical progress data will NOT be deleted.</span>
                              <span className="block mt-3">
                                If you want to delete historical data, enable
                                <span className="font-medium"> "Allow history deletion" </span>
                                in Settings.
                              </span>
                            </>
                          )
                        ) : (
                          <>
                            This will permanently delete "<strong>{item.title}</strong>" and all its associated data.
                            {item.type === 'habit' && (
                              <span className="block mt-2 text-destructive">
                                This includes all completion history for this habit.
                              </span>
                            )}
                            <span className="block mt-2 font-medium">This action cannot be undone.</span>
                          </>
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={onDelete}
                        className="bg-orange-500 hover:bg-orange-600"
                      >
                        {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Checkbox
                  checked={isSelected}
                  onCheckedChange={onSelectToggle}
                  aria-label={`Select ${item.title}`}
                  className={cn(
                    "data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-opacity",
                    !showCheckboxes && !isSelected && "opacity-0 group-hover:opacity-100"
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
