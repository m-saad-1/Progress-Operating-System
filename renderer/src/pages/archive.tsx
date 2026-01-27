import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Archive as ArchiveIcon,
  Search,
  Trash2,
  RotateCcw,
  Clock,
  Calendar,
  Target,
  CheckSquare,
  FileText
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useElectron } from '@/hooks/use-electron'
import { useToaster } from '@/hooks/use-toaster'
import { cn } from '@/lib/utils'

type ArchivedItemType = 'goal' | 'task' | 'habit' | 'note';

interface ArchivedBaseItem {
  id: string;
  title: string;
  description?: string;
  archived_at: string; // ISO string date
  type: ArchivedItemType;
}

interface ArchivedGoal extends ArchivedBaseItem {
  category: string;
  progress: number;
  type: 'goal';
}

interface ArchivedTask extends ArchivedBaseItem {
  priority: string;
  status: string;
  progress: number;
  type: 'task';
}

interface ArchivedHabit extends ArchivedBaseItem {
  frequency: string;
  consistency_score: number;
  type: 'habit';
}

interface ArchivedNote extends ArchivedBaseItem {
  content: string;
  type: 'note';
}

type GenericArchivedItem = ArchivedGoal | ArchivedTask | ArchivedHabit | ArchivedNote;

interface ArchivedItemsData {
  goals: ArchivedGoal[];
  tasks: ArchivedTask[];
  habits: ArchivedHabit[];
  notes: ArchivedNote[];
  all: GenericArchivedItem[];
}

export default function Archive() {
  const electron = useElectron()
  const { success, error: toastError } = useToaster()
  const queryClient = useQueryClient()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')

  // Fetch archived items
  const { data: archivedItems, isLoading } = useQuery<ArchivedItemsData>({
    queryKey: ['archive'],
    queryFn: async () => {
      const [goals, tasks, habits, notes] = await Promise.all([
        // Archived goals
        electron.executeQuery<ArchivedGoal[]>(`
          SELECT 
            id, title, description, category, progress,
            deleted_at as archived_at,
            'goal' as type
          FROM goals 
          WHERE deleted_at IS NOT NULL
          ORDER BY deleted_at DESC
        `),

        // Archived tasks
        electron.executeQuery<ArchivedTask[]>(`
          SELECT 
            id, title, description, priority, status, progress,
            deleted_at as archived_at,
            'task' as type
          FROM tasks 
          WHERE deleted_at IS NOT NULL
          ORDER BY deleted_at DESC
        `),

        // Archived habits
        electron.executeQuery<ArchivedHabit[]>(`
          SELECT 
            id, title, description, frequency, consistency_score,
            deleted_at as archived_at,
            'habit' as type
          FROM habits 
          WHERE deleted_at IS NOT NULL
          ORDER BY deleted_at DESC
        `),

        // Archived notes
        electron.executeQuery<ArchivedNote[]>(`
          SELECT 
            id, title, content,
            deleted_at as archived_at,
            'note' as type
          FROM notes 
          WHERE deleted_at IS NOT NULL
          ORDER BY deleted_at DESC
        `)
      ])

      return {
        goals: goals || [],
        tasks: tasks || [],
        habits: habits || [],
        notes: notes || [],
        all: [...(goals || []), ...(tasks || []), ...(habits || []), ...(notes || [])]
      }
    },
    enabled: electron.isReady,
  })

  // Restore item mutation
  const restoreItemMutation = useMutation({
    mutationFn: async ({ type, id }: { type: ArchivedItemType; id: string }) => {
      let query = ''
      
      switch (type) {
        case 'goal':
          query = `UPDATE goals SET deleted_at = NULL, updated_at = ? WHERE id = ?`
          break
        case 'task':
          query = `UPDATE tasks SET deleted_at = NULL, updated_at = ? WHERE id = ?`
          break
        case 'habit':
          query = `UPDATE habits SET deleted_at = NULL, updated_at = ? WHERE id = ?`
          break
        case 'note':
          query = `UPDATE notes SET deleted_at = NULL, updated_at = ? WHERE id = ?`
          break
      }
      
      return await electron.executeQuery(query, [new Date().toISOString(), id])
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['archive'] })
      queryClient.invalidateQueries({ queryKey: [variables.type + 's'] })
      success(`${variables.type.charAt(0).toUpperCase() + variables.type.slice(1)} restored`)
    },
    onError: (error) => {
      console.error('Failed to restore item:', error)
      toastError('Failed to restore item')
    },
  })

  // Permanently delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async ({ type, id }: { type: ArchivedItemType; id: string }) => {
      let query = ''
      
      switch (type) {
        case 'goal':
          query = `DELETE FROM goals WHERE id = ?`
          break
        case 'task':
          query = `DELETE FROM tasks WHERE id = ?`
          break
        case 'habit':
          query = `DELETE FROM habits WHERE id = ?`
          break
        case 'note':
          query = `DELETE FROM notes WHERE id = ?`
          break
      }
      
      return await electron.executeQuery(query, [id])
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

  // Clear all archived items
  const clearArchiveMutation = useMutation({
    mutationFn: async () => {
      const operations = [
        { query: `DELETE FROM goals WHERE deleted_at IS NOT NULL`, params: [] },
        { query: `DELETE FROM tasks WHERE deleted_at IS NOT NULL`, params: [] },
        { query: `DELETE FROM habits WHERE deleted_at IS NOT NULL`, params: [] },
        { query: `DELETE FROM notes WHERE deleted_at IS NOT NULL`, params: [] },
      ]
      
      return await electron.executeTransaction(operations)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archive'] })
      success('Archive cleared')
    },
    onError: (error) => {
      console.error('Failed to clear archive:', error)
      toastError('Failed to clear archive')
    },
  })

  const handleRestore = (type: ArchivedItemType, id: string) => {
    restoreItemMutation.mutate({ type, id })
  }

  const handleDelete = (type: ArchivedItemType, id: string) => {
    if (window.confirm('Are you sure you want to permanently delete this item? This action cannot be undone.')) {
      deleteItemMutation.mutate({ type, id })
    }
  }

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to permanently delete ALL archived items? This action cannot be undone.')) {
      clearArchiveMutation.mutate()
    }
  }

  const getItemIcon = (type: ArchivedItemType) => {
    switch (type) {
      case 'goal': return <Target className="h-5 w-5" />
      case 'task': return <CheckSquare className="h-5 w-5" />
      case 'habit': return <Calendar className="h-5 w-5" />
      case 'note': return <FileText className="h-5 w-5" />
      default: return <ArchiveIcon className="h-5 w-5" />
    }
  }

  const getItemColor = (type: ArchivedItemType) => {
    switch (type) {
      case 'goal': return 'bg-category-career/10 text-category-career'
      case 'task': return 'bg-primary/10 text-primary'
      case 'habit': return 'bg-category-health/10 text-category-health'
      case 'note': return 'bg-category-learning/10 text-category-learning'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const filteredItems = archivedItems?.[selectedType as keyof ArchivedItemsData]?.filter((item: GenericArchivedItem) => {
    return searchQuery === '' || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  }) || []

  const stats = {
    total: archivedItems?.all.length || 0,
    goals: archivedItems?.goals.length || 0,
    tasks: archivedItems?.tasks.length || 0,
    habits: archivedItems?.habits.length || 0,
    notes: archivedItems?.notes.length || 0,
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Archive</h1>
          <p className="text-muted-foreground">
            Restore or permanently delete archived items
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {stats.total} items
          </Badge>
          <Button
            variant="destructive"
            onClick={handleClearAll}
            disabled={stats.total === 0 || clearArchiveMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Archived</CardTitle>
            <ArchiveIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              Items in archive
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Goals</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.goals}</div>
            <p className="text-xs text-muted-foreground">
              Archived goals
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tasks}</div>
            <p className="text-xs text-muted-foreground">
              Archived tasks
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Habits & Notes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.habits + stats.notes}</div>
            <p className="text-xs text-muted-foreground">
              {stats.habits} habits, {stats.notes} notes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search archived items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Archived Items */}
      <Tabs value={selectedType} onValueChange={(value) => setSelectedType(value)}>
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">
            All Items ({stats.total})
          </TabsTrigger>
          <TabsTrigger value="goals" className="flex-1">
            Goals ({stats.goals})
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex-1">
            Tasks ({stats.tasks})
          </TabsTrigger>
          <TabsTrigger value="habits" className="flex-1">
            Habits ({stats.habits})
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex-1">
            Notes ({stats.notes})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <ArchivedItemsList 
            isLoading={isLoading}
            items={filteredItems}
            searchQuery={searchQuery}
            getItemColor={getItemColor}
            getItemIcon={getItemIcon}
            onRestore={handleRestore}
            onDelete={handleDelete}
            restoreMutation={restoreItemMutation}
            deleteMutation={deleteItemMutation}
          />
        </TabsContent>
        
        <TabsContent value="goals" className="mt-6">
          <ArchivedItemsList 
            isLoading={isLoading}
            items={filteredItems}
            searchQuery={searchQuery}
            getItemColor={getItemColor}
            getItemIcon={getItemIcon}
            onRestore={handleRestore}
            onDelete={handleDelete}
            restoreMutation={restoreItemMutation}
            deleteMutation={deleteItemMutation}
          />
        </TabsContent>
        
        <TabsContent value="tasks" className="mt-6">
          <ArchivedItemsList 
            isLoading={isLoading}
            items={filteredItems}
            searchQuery={searchQuery}
            getItemColor={getItemColor}
            getItemIcon={getItemIcon}
            onRestore={handleRestore}
            onDelete={handleDelete}
            restoreMutation={restoreItemMutation}
            deleteMutation={deleteItemMutation}
          />
        </TabsContent>
        
        <TabsContent value="habits" className="mt-6">
          <ArchivedItemsList 
            isLoading={isLoading}
            items={filteredItems}
            searchQuery={searchQuery}
            getItemColor={getItemColor}
            getItemIcon={getItemIcon}
            onRestore={handleRestore}
            onDelete={handleDelete}
            restoreMutation={restoreItemMutation}
            deleteMutation={deleteItemMutation}
          />
        </TabsContent>
        
        <TabsContent value="notes" className="mt-6">
          <ArchivedItemsList 
            isLoading={isLoading}
            items={filteredItems}
            searchQuery={searchQuery}
            getItemColor={getItemColor}
            getItemIcon={getItemIcon}
            onRestore={handleRestore}
            onDelete={handleDelete}
            restoreMutation={restoreItemMutation}
            deleteMutation={deleteItemMutation}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

  

  function ArchivedItemsList({ 

    isLoading, 

    items,

    searchQuery,

    getItemColor,

    getItemIcon,

    onRestore,

    onDelete,

    restoreMutation,

    deleteMutation

  }: { 

    isLoading: boolean; 

    items: GenericArchivedItem[];

    searchQuery: string;

    getItemColor: (type: ArchivedItemType) => string;

    getItemIcon: (type: ArchivedItemType) => JSX.Element;

    onRestore: (type: ArchivedItemType, id: string) => void;

    onDelete: (type: ArchivedItemType, id: string) => void;

    restoreMutation: any;

    deleteMutation: any;

  }) {

    if (isLoading) {

      return (

        <div className="space-y-4">

          {[1, 2, 3].map(i => (

            <Card key={i} className="animate-pulse">

              <CardContent className="pt-6">

                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>

                <div className="h-3 bg-muted rounded w-1/2"></div>

              </CardContent>

            </Card>

          ))}

        </div>

      )

    }

  

    if (items.length === 0) {

      return (

        <Card>

          <CardContent className="pt-6 text-center">

            <ArchiveIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />

            <h3 className="text-lg font-semibold mb-2">

              {searchQuery ? 'No matching items found' : 'Archive is empty'}

            </h3>

            <p className="text-muted-foreground">

              {searchQuery 

                ? 'Try a different search term'

                : 'Items you delete will appear here'

              }

            </p>

          </CardContent>

        </Card>

      )

    }

  

    return (

      <div className="space-y-4">

        {items.map((item: GenericArchivedItem) => (

          <Card key={`${item.type}-${item.id}`} className="card-hover">

            <CardContent className="pt-6">

              <div className="flex items-start justify-between">

                <div className="flex items-start gap-3">

                  <div className={cn(

                    "h-10 w-10 rounded-full flex items-center justify-center mt-1",

                    getItemColor(item.type)

                  )}>

                    {getItemIcon(item.type)}

                  </div>

                  

                  <div className="flex-1 min-w-0">

                    <div className="flex items-center gap-2 mb-1">

                      <h3 className="font-medium truncate">{item.title}</h3>

                      <Badge variant="outline" className="capitalize">

                        {item.type}

                      </Badge>

                    </div>

                    

                    {item.description && (

                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">

                        {item.description}

                      </p>

                    )}

                    

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">

                      <span className="flex items-center">

                        <Clock className="mr-1 h-3 w-3" />

                        Archived {format(parseISO(item.archived_at), 'MMM d, yyyy')}

                      </span>

                      

                      {'progress' in item && item.progress !== undefined && (

                        <>

                          <span>•</span>

                          <span>Progress: {item.progress}%</span>

                        </>

                      )}

                      

                      {'priority' in item && item.priority && (

                        <>

                          <span>•</span>

                          <Badge variant={item.priority as any} size="sm">

                            {item.priority}

                          </Badge>

                        </>

                      )}

                    </div>

                  </div>

                </div>

                

                <div className="flex items-center gap-2">

                  <Button

                    variant="outline"

                    size="sm"

                    onClick={() => onRestore(item.type, item.id)}

                    disabled={restoreMutation.isPending}

                  >

                    <RotateCcw className="mr-2 h-4 w-4" />

                    Restore

                  </Button>

                  

                  <Button

                    variant="ghost"

                    size="icon"

                    onClick={() => onDelete(item.type, item.id)}

                    disabled={deleteMutation.isPending}

                    className="text-destructive hover:text-destructive"

                  >

                    <Trash2 className="h-4 w-4" />

                  </Button>

                </div>

              </div>

            </CardContent>

          </Card>

        ))}

      </div>

    )

  }
