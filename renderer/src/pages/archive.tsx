import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
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
  Undo2
} from 'lucide-react'
import { parseISO, formatDistanceToNow } from 'date-fns'
import { useToaster } from '@/hooks/use-toaster'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import { database, Task, Habit, Goal } from '@/lib/database'

type ArchivedItemType = 'goal' | 'task' | 'habit' | 'note'

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
}

export default function Archive() {
  const queryClient = useQueryClient()
  const { success, error: toastError } = useToaster()
  const { restoreTask, restoreHabit, restoreGoal } = useStore()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [confirmClearAll, setConfirmClearAll] = useState(false)

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
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
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
      switch (type) {
        case 'task':
          await database.permanentlyDeleteTask(id)
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
      }
      return { type, id }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archive'] })
      success('Item permanently deleted')
    },
    onError: (error) => {
      console.error('Failed to delete item:', error)
      toastError('Failed to delete item')
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
    }
  }

  const getItemColor = (type: ArchivedItemType) => {
    switch (type) {
      case 'goal': return 'bg-purple-500/10 text-purple-500 border-purple-500/20'
      case 'task': return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      case 'habit': return 'bg-green-500/10 text-green-500 border-green-500/20'
      case 'note': return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500/10 text-red-500 border-red-500/30'
      case 'high': return 'bg-orange-500/10 text-orange-500 border-orange-500/30'
      case 'medium': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
      case 'low': return 'bg-green-500/10 text-green-500 border-green-500/30'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
            <FolderArchive className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Archive</h1>
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
                variant="destructive"
                disabled={stats.total === 0 || clearArchiveMutation.isPending}
                className="shadow-md"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
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
                  </ul>
                  <p className="mt-3 text-destructive font-medium">This action cannot be undone.</p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => clearArchiveMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {clearArchiveMutation.isPending ? 'Clearing...' : 'Delete All'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
        </TabsList>

        <TabsContent value={selectedType} className="mt-6">
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
}: {
  item: ArchivedItem
  onRestore: () => void
  onDelete: () => void
  isRestoring: boolean
  isDeleting: boolean
  getItemIcon: (type: ArchivedItemType) => React.ReactNode
  getItemColor: (type: ArchivedItemType) => string
  getPriorityColor: (priority: string) => string
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
                  <Badge variant="outline" className="capitalize text-xs">
                    {item.type}
                  </Badge>
                  {item.priority && (
                    <Badge className={cn("text-xs border", getPriorityColor(item.priority))}>
                      {item.priority}
                    </Badge>
                  )}
                  {item.status && item.status === 'completed' && (
                    <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-500">
                      Completed
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
                    <Badge variant="outline" className="text-xs capitalize">
                      {item.category}
                    </Badge>
                  )}

                  {item.frequency && (
                    <Badge variant="outline" className="text-xs capitalize">
                      {item.frequency}
                    </Badge>
                  )}
                </div>

                {/* Progress bar for tasks and goals */}
                {(item.type === 'task' || item.type === 'goal') && item.progress !== undefined && item.progress > 0 && (
                  <div className="mt-3">
                    <Progress value={item.progress} className="h-1.5" />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRestore}
                  disabled={isRestoring}
                  className="border-green-500/30 text-green-600 hover:bg-green-500/10 hover:text-green-600 hover:border-green-500/50"
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
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Permanently Delete?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete "<strong>{item.title}</strong>" and all its associated data.
                        {item.type === 'habit' && (
                          <span className="block mt-2 text-destructive">
                            This includes all completion history for this habit.
                          </span>
                        )}
                        <span className="block mt-2 font-medium">This action cannot be undone.</span>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={onDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
