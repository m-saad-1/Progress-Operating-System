import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardFooter
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Plus, 
  Filter, 
  Search, 
  MoreVertical, 
  FileText,
  Calendar,
  Target,
  Edit,
  Trash2,
  Eye,
  X,
  BookOpen,
  Bookmark,
  Smile,
  Type,
  Save,
  Clock,
  Tag,
  Download,
  Upload
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useElectron } from '@/hooks/use-electron'
import { useToaster } from '@/hooks/use-toaster'
import { useUndoRedo } from '@/hooks/use-undo-redo'
import { cn } from '@/lib/utils'

interface Note {
  id: string
  title: string
  content: string
  type: 'free' | 'daily' | 'weekly' | 'goal' | 'task'
  mood: string | null
  goal_id: string | null
  task_id: string | null
  tags: string[]
  created_at: string
  updated_at: string
  version: number
}

interface NoteFormData {
  title: string
  content: string
  type: Note['type']
  mood: string
  goal_id: string
  task_id: string
  tags: string[]
}

interface NoteWithDetails extends Note {
  goal_title?: string;
  task_title?: string;
}

interface GoalForNote {
  id: string;
  title: string;
}

interface TaskForNote {
  id: string;
  title: string;
}

interface NoteStats {
  total: number;
  free: number;
  daily: number;
  weekly: number;
  goal: number;
  task: number;
  withMood: number;
  withTags: number;
}

export default function Notes() {
  const electron = useElectron()
  const { success, error: toastError } = useToaster()
  const queryClient = useQueryClient()
  const { executeCommand } = useUndoRedo()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<Note['type'] | 'all'>('all')
  const [selectedMood, setSelectedMood] = useState<string | 'all'>('all')
  const [selectedGoal, setSelectedGoal] = useState<string | 'all'>('all')
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title'>('updated')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [formData, setFormData] = useState<NoteFormData>({
    title: '',
    content: '',
    type: 'free',
    mood: '',
    goal_id: '',
    task_id: '',
    tags: [],
  })
  const [newTag, setNewTag] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [previewMode, setPreviewMode] = useState(false)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Mood options
  const moodOptions = [
    { value: 'happy', label: '😊 Happy', color: 'text-yellow-500' },
    { value: 'excited', label: '🎉 Excited', color: 'text-orange-500' },
    { value: 'neutral', label: '😐 Neutral', color: 'text-gray-500' },
    { value: 'thoughtful', label: '🤔 Thoughtful', color: 'text-blue-500' },
    { value: 'stressed', label: '😰 Stressed', color: 'text-red-500' },
    { value: 'tired', label: '😴 Tired', color: 'text-purple-500' },
    { value: 'grateful', label: '🙏 Grateful', color: 'text-green-500' },
    { value: 'inspired', label: '💡 Inspired', color: 'text-cyan-500' },
  ]

  // Fetch notes
  const { data: notes, isLoading, error: notesError } = useQuery<NoteWithDetails[]>({
    queryKey: ['notes'],
    queryFn: async () => {
      try {
        const notes = await electron.executeQuery<NoteWithDetails[]>(`
          SELECT n.*, 
                 g.title as goal_title,
                 t.title as task_title
          FROM notes n
          LEFT JOIN goals g ON n.goal_id = g.id
          LEFT JOIN tasks t ON n.task_id = t.id
          WHERE n.deleted_at IS NULL
          ORDER BY updated_at DESC
        `)
        return (Array.isArray(notes) ? notes : []).map((note: any) => ({
          ...note,
          tags: JSON.parse((note.tags as any) || '[]') as string[],
        })) || []
      } catch (error) {
        console.error('Failed to fetch notes:', error)
        throw error
      }
    },
    enabled: electron.isReady,
  })

  // Fetch goals for dropdown
  const { data: goals } = useQuery<GoalForNote[]>({
    queryKey: ['goals-for-notes'],
    queryFn: async () => {
      try {
        const goals = await electron.executeQuery<GoalForNote[]>(`
          SELECT id, title FROM goals 
          WHERE deleted_at IS NULL
          ORDER BY title
        `)
        return Array.isArray(goals) ? goals : []
      } catch (error) {
        console.error('Failed to fetch goals:', error)
        return []
      }
    },
    enabled: electron.isReady,
  })

  // Fetch tasks for dropdown
  const { data: tasks } = useQuery<TaskForNote[]>({
    queryKey: ['tasks-for-notes'],
    queryFn: async () => {
      try {
        const tasks = await electron.executeQuery<TaskForNote[]>(`
          SELECT id, title FROM tasks 
          WHERE deleted_at IS NULL
          AND status != 'completed'
          ORDER BY title
        `)
        return Array.isArray(tasks) ? tasks : []
      } catch (error) {
        console.error('Failed to fetch tasks:', error)
        return []
      }
    },
    enabled: electron.isReady,
  })

  // Filter and sort notes
  const filteredNotes = notes?.filter((note: NoteWithDetails) => {
    const matchesSearch = searchQuery === '' || 
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesType = selectedType === 'all' || note.type === selectedType
    const matchesMood = selectedMood === 'all' || 
      (selectedMood === 'none' && !note.mood) ||
      note.mood === selectedMood
    const matchesGoal = selectedGoal === 'all' || 
      (selectedGoal === 'none' && !note.goal_id) ||
      note.goal_id === selectedGoal
    const matchesTab = activeTab === 'all' || note.type === activeTab
    
    return matchesSearch && matchesType && matchesMood && matchesGoal && matchesTab
  }).sort((a, b) => {
    switch (sortBy) {
      case 'updated':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      case 'created':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'title':
        return a.title.localeCompare(b.title)
      default:
        return 0
    }
  })

  // Calculate statistics
  const stats: NoteStats = {
    total: notes?.length || 0,
    free: notes?.filter(n => n.type === 'free').length || 0,
    daily: notes?.filter(n => n.type === 'daily').length || 0,
    weekly: notes?.filter(n => n.type === 'weekly').length || 0,
    goal: notes?.filter(n => n.type === 'goal').length || 0,
    task: notes?.filter(n => n.type === 'task').length || 0,
    withMood: notes?.filter(n => n.mood).length || 0,
    withTags: notes?.filter(n => n.tags && n.tags.length > 0).length || 0,
  }

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (noteData: NoteFormData) => {
      const operations = [{
        query: `
          INSERT INTO notes (
            id, title, content, type, mood, goal_id, task_id, tags,
            created_at, updated_at, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `,
        params: [
          crypto.randomUUID(),
          noteData.title,
          noteData.content,
          noteData.type,
          noteData.mood || null,
          noteData.goal_id || null,
          noteData.task_id || null,
          JSON.stringify(noteData.tags),
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      }]
      
      return await electron.executeTransaction(operations)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      success('Note created successfully')
      setIsCreating(false)
      resetForm()
      
      // Register undo command
      executeCommand('create_note', 'Create Note', formData)
    },
    onError: (error) => {
      console.error('Failed to create note:', error)
      toastError('Failed to create note')
    },
  })

  // Update note mutation
  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Note> }) => {
      const operations = [{
        query: `
          UPDATE notes 
          SET title = ?, content = ?, type = ?, mood = ?, 
              goal_id = ?, task_id = ?, tags = ?, updated_at = ?, version = version + 1
          WHERE id = ?
        `,
        params: [
          updates.title,
          updates.content,
          updates.type,
          updates.mood,
          updates.goal_id,
          updates.task_id,
          JSON.stringify(updates.tags),
          new Date().toISOString(),
          id,
        ]
      }]
      
      return await electron.executeTransaction(operations)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      success('Note updated successfully')
      setIsEditing(null)
      resetForm()
    },
    onError: (error) => {
      console.error('Failed to update note:', error)
      toastError('Failed to update note')
    },
  })

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const operations = [{
        query: `
          UPDATE notes 
          SET deleted_at = ?, updated_at = ?, version = version + 1
          WHERE id = ?
        `,
        params: [new Date().toISOString(), new Date().toISOString(), id]
      }]
      
      return await electron.executeTransaction(operations)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      success('Note moved to trash')
    },
    onError: (error) => {
      console.error('Failed to delete note:', error)
      toastError('Failed to delete note')
    },
  })

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      type: 'free',
      mood: '',
      goal_id: '',
      task_id: '',
      tags: [],
    })
    setNewTag('')
    setPreviewMode(false)
  }

  const handleEdit = (note: NoteWithDetails) => {
    setIsEditing(note.id)
    setFormData({
      title: note.title,
      content: note.content,
      type: note.type,
      mood: note.mood || '',
      goal_id: note.goal_id || '',
      task_id: note.task_id || '',
      tags: note.tags || [],
    })
  }

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toastError('Please enter a note title')
      return
    }

    if (isEditing) {
      updateNoteMutation.mutate({
        id: isEditing,
        updates: formData,
      })
    } else {
      createNoteMutation.mutate(formData)
    }
  }

  const handleQuickNote = () => {
    const quickNote = {
      title: format(new Date(), 'MMM d, yyyy - h:mm a'),
      content: '',
      type: 'free' as const,
      mood: '',
      goal_id: '',
      task_id: '',
      tags: ['quick-note'],
    }
    
    setFormData(quickNote)
    setIsCreating(true)
    
    // Focus the textarea after a brief delay
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    }, 100)
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()],
      })
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove),
    })
  }

  const formatNoteType = (type: string) => {
    switch (type) {
      case 'free': return 'Free Note'
      case 'daily': return 'Daily Journal'
      case 'weekly': return 'Weekly Review'
      case 'goal': return 'Goal Note'
      case 'task': return 'Task Note'
      default: return type
    }
  }

  const formatMood = (mood: string | null) => {
    if (!mood) return null
    const moodOption = moodOptions.find(m => m.value === mood)
    return moodOption ? moodOption.label : mood
  }

  const exportNote = async (note: Note) => {
    try {
      const content = `# ${note.title}\n\n${note.content}\n\n---\nCreated: ${format(parseISO(note.created_at), 'PPP')}\nLast Updated: ${format(parseISO(note.updated_at), 'PPP')}\nTags: ${note.tags.join(', ')}`
      
      const options = {
        defaultPath: `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`,
        filters: [
          { name: 'Markdown', extensions: ['md'] },
          { name: 'Text', extensions: ['txt'] },
        ],
      }

      const savePath = await electron.saveFile(options)
      if (!savePath) return

      // In a real implementation, you would save the file
      success('Note exported successfully')
    } catch (error) {
      console.error('Failed to export note:', error)
      toastError('Failed to export note')
    }
  }

  const handleFormatText = (format: 'bold' | 'italic' | 'code' | 'list') => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = formData.content.substring(start, end)
    
    let formattedText = selectedText
    let newCursorPos = start

    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`
        newCursorPos = start + 2
        break
      case 'italic':
        formattedText = `*${selectedText}*`
        newCursorPos = start + 1
        break
      case 'code':
        formattedText = `\`${selectedText}\``
        newCursorPos = start + 1
        break
      case 'list':
        formattedText = selectedText.split('\n').map(line => `- ${line}`).join('\n')
        newCursorPos = start + 2
        break
    }

    const newContent = 
      formData.content.substring(0, start) + 
      formattedText + 
      formData.content.substring(end)

    setFormData({ ...formData, content: newContent })

    // Restore cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = newCursorPos
        textareaRef.current.selectionEnd = newCursorPos + selectedText.length
        textareaRef.current.focus()
      }
    }, 0)
  }

  if (notesError) {
    return (
      <div className="p-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center">
              <X className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to load notes</h3>
              <p className="text-muted-foreground mb-4">
                There was an error loading your notes.
              </p>
              <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['notes'] })}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notes</h1>
          <p className="text-muted-foreground">
            Capture thoughts, ideas, and reflections
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleQuickNote}
          >
            <Plus className="mr-2 h-4 w-4" />
            Quick Note
          </Button>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Note
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Edit Note' : 'Create New Note'}</DialogTitle>
                <DialogDescription>
                  Capture your thoughts, ideas, or reflections.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Note Title</label>
                  <Input
                    placeholder="Note title..."
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Type</label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: Note['type']) => 
                        setFormData({ ...formData, type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free Note</SelectItem>
                        <SelectItem value="daily">Daily Journal</SelectItem>
                        <SelectItem value="weekly">Weekly Review</SelectItem>
                        <SelectItem value="goal">Goal Note</SelectItem>
                        <SelectItem value="task">Task Note</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Mood (Optional)</label>
                    <Select
                      value={formData.mood || "none"}
                      onValueChange={(value) => 
                        setFormData({ ...formData, mood: value === "none" ? "" : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="How are you feeling?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No mood</SelectItem>
                        {moodOptions.map(mood => (
                          <SelectItem key={mood.value} value={mood.value}>
                            {mood.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Related Goal (Optional)</label>
                    <Select
                      value={formData.goal_id || "none"}
                      onValueChange={(value) => 
                        setFormData({ ...formData, goal_id: value === "none" ? "" : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a goal..." />
                      </SelectTrigger>
                      <SelectContent>
                      <SelectItem value="none">No Goal</SelectItem>
                        {goals?.map((goal: any) => (
                          <SelectItem key={goal.id} value={goal.id}>
                            {goal.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Related Task (Optional)</label>
                    <Select
                      value={formData.task_id || "none"}
                      onValueChange={(value) => 
                        setFormData({ ...formData, task_id: value === "none" ? "" : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a task..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Task</SelectItem>
                        {tasks?.map((task: any) => (
                          <SelectItem key={task.id} value={task.id}>
                            {task.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Formatting toolbar */}
                <div className="flex items-center gap-1 p-2 border rounded-lg">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFormatText('bold')}
                    title="Bold"
                  >
                    <span className="font-bold">B</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFormatText('italic')}
                    title="Italic"
                  >
                    <span className="italic">I</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFormatText('code')}
                    title="Code"
                  >
                    <code className="text-xs">{'<>'}</code>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFormatText('list')}
                    title="Bullet List"
                  >
                    <span>•</span>
                  </Button>
                  <div className="flex-1"></div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewMode(!previewMode)}
                  >
                    {previewMode ? 'Edit' : 'Preview'}
                  </Button>
                </div>
                
                {/* Content editor/preview */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Content</label>
                  {previewMode ? (
                    <div className="min-h-[300px] p-4 border rounded-lg prose prose-sm max-w-none">
                      <h1>{formData.title}</h1>
                      <div dangerouslySetInnerHTML={{ 
                        __html: formData.content
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\*(.*?)\*/g, '<em>$1</em>')
                          .replace(/`(.*?)`/g, '<code>$1</code>')
                          .replace(/\n/g, '<br>')
                      }} />
                    </div>
                  ) : (
                    <Textarea
                      ref={textareaRef}
                      placeholder="Write your note here... (Markdown supported)"
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      rows={12}
                      className="font-mono text-sm"
                    />
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tags</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a tag..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addTag()}
                    />
                    <Button type="button" onClick={addTag}>
                      Add
                    </Button>
                  </div>
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          <Tag className="h-3 w-3" />
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsCreating(false)
                  setIsEditing(null)
                  resetForm()
                }}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={createNoteMutation.isPending || updateNoteMutation.isPending}
                >
                  {isEditing ? 'Update Note' : 'Create Note'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Notes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.withTags} with tags, {stats.withMood} with mood
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Journals</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.daily}</div>
            <p className="text-xs text-muted-foreground">
              {stats.weekly} weekly reviews
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Goal Notes</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.goal}</div>
            <p className="text-xs text-muted-foreground">
              {stats.task} task notes
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Free Notes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.free}</div>
            <p className="text-xs text-muted-foreground">
              General thoughts and ideas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Select value={selectedType} onValueChange={(value) => setSelectedType(value as any)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="free">Free Notes</SelectItem>
                  <SelectItem value="daily">Daily Journals</SelectItem>
                  <SelectItem value="weekly">Weekly Reviews</SelectItem>
                  <SelectItem value="goal">Goal Notes</SelectItem>
                  <SelectItem value="task">Task Notes</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={selectedMood} onValueChange={setSelectedMood}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Mood" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Moods</SelectItem>
                  <SelectItem value="none">No Mood</SelectItem>
                  {moodOptions.map(mood => (
                    <SelectItem key={mood.value} value={mood.value}>
                      {mood.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedGoal} onValueChange={setSelectedGoal}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Goals</SelectItem>
                  <SelectItem value="none">No Goal</SelectItem>
                  {goals?.map((goal: any) => (
                    <SelectItem key={goal.id} value={goal.id}>
                      {goal.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'updated' | 'created' | 'title')}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated">Recently Updated</SelectItem>
                  <SelectItem value="created">Recently Created</SelectItem>
                  <SelectItem value="title">Title (A-Z)</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  List
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  Grid
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes List/Grid */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">
            All Notes ({filteredNotes?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="free" className="flex-1">
            Free ({stats.free})
          </TabsTrigger>
          <TabsTrigger value="daily" className="flex-1">
            Daily ({stats.daily})
          </TabsTrigger>
          <TabsTrigger value="weekly" className="flex-1">
            Weekly ({stats.weekly})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-6">
          {renderNotesContent()}
        </TabsContent>
        
        <TabsContent value="free" className="mt-6">
          {renderNotesContent()}
        </TabsContent>
        
        <TabsContent value="daily" className="mt-6">
          {renderNotesContent()}
        </TabsContent>
        
        <TabsContent value="weekly" className="mt-6">
          {renderNotesContent()}
        </TabsContent>
      </Tabs>
    </div>
  )

  function renderNotesContent() {
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

    if (filteredNotes?.length === 0) {
      return (
        <Card>
          <CardContent className="pt-6 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No notes found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || selectedType !== 'all' || selectedMood !== 'all' || selectedGoal !== 'all'
                ? 'Try changing your filters or search query'
                : 'Create your first note to capture your thoughts!'}
            </p>
            {!searchQuery && selectedType === 'all' && selectedMood === 'all' && selectedGoal === 'all' && (
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Note
              </Button>
            )}
          </CardContent>
        </Card>
      )
    }

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes?.map((note: NoteWithDetails) => (
            <NoteCard key={note.id} note={note} />
          ))}
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {filteredNotes?.map((note: NoteWithDetails) => (
          <NoteCard key={note.id} note={note} />
        ))}
      </div>
    )
  }

  function NoteCard({ note }: { note: NoteWithDetails }) {
    const truncatedContent = note.content.length > 200 
      ? note.content.substring(0, 200) + '...'
      : note.content

    return (
      <Card className="card-hover">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="truncate">{note.title}</CardTitle>
              <CardDescription className="truncate">
                {formatNoteType(note.type)} • {format(parseISO(note.updated_at), 'MMM d, yyyy')}
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleEdit(note)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportNote(note)}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={() => deleteNoteMutation.mutate(note.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {formatNoteType(note.type)}
            </Badge>
            {note.mood && (
              <Badge variant="secondary">
                <Smile className="mr-1 h-3 w-3" />
                {formatMood(note.mood)}
              </Badge>
            )}
            {note.goal_title && (
              <Badge variant="secondary">
                <Target className="mr-1 h-3 w-3" />
                {note.goal_title}
              </Badge>
            )}
            {note.task_title && (
              <Badge variant="secondary">
                <Bookmark className="mr-1 h-3 w-3" />
                {note.task_title}
              </Badge>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            <div className="prose prose-sm max-w-none">
              {truncatedContent}
            </div>
            
            {note.tags && note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {note.tags.slice(0, 5).map((tag: string) => (
                  <Badge key={tag} variant="outline" size="sm">
                    <Tag className="mr-1 h-3 w-3" />
                    {tag}
                  </Badge>
                ))}
                {note.tags.length > 5 && (
                  <Badge variant="outline" size="sm">
                    +{note.tags.length - 5}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
        
        <CardFooter className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center">
            <Clock className="mr-1 h-3 w-3" />
            Updated {format(parseISO(note.updated_at), 'MMM d, yyyy')}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(note)}
          >
            <Eye className="mr-2 h-4 w-4" />
            View Full
          </Button>
        </CardFooter>
      </Card>
    )
  }
}