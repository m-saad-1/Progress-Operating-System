import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { 
  Plus, 
  Search, 
  FileText,
  Calendar,
  Target,
  Edit,
  X,
  BookOpen,
  Bookmark,
  Smile,
  Clock,
  Tag,
  Eye,
  Archive,
  Pin,
  PinOff,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useToaster } from '@/hooks/use-toaster'
import { useUndoRedo } from '@/hooks/use-undo-redo'
import { database } from '@/lib/database'
import { cn } from '@/lib/utils'
import { RichTextEditor } from '@/components/rich-text-editor'
import { ContextTipsDialog } from '@/components/context-tips-dialog'

interface Note {
  id: string
  title: string
  content: string
  type: 'free' | 'daily' | 'weekly' | 'goal' | 'task' | 'challenge' | 'career'
  mood: string | null
  goal_id: string | null
  task_id: string | null
  tags: string[]
  pinned: boolean
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
  pinned?: boolean
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
  challenge: number;
  career: number;
  withMood: number;
  withTags: number;
}

interface NoteFormErrors {
  title?: string;
  content?: string;
  type?: string;
}

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

const NOTES_TIPS_SECTIONS = [
  {
    title: 'Capture and Structure',
    points: [
      'Use clear titles so notes remain searchable and reusable later.',
      'Choose note types intentionally (free, daily, weekly, goal, task) to support reviews.',
      'Break long thoughts into short sections and bullet points for fast scanning.',
    ],
  },
  {
    title: 'Connect Notes to Action',
    points: [
      'Link notes to goals or tasks when insights should drive execution.',
      'Turn repeated observations into concrete tasks during planning blocks.',
      'Use consistent tags to group patterns across projects and weeks.',
    ],
  },
  {
    title: 'Reflection Habits',
    points: [
      'Capture quick daily notes and summarize key learnings weekly.',
      'Track mood trends to identify focus triggers and blockers.',
      'Archive old notes instead of deleting when historical context may still help.',
    ],
  },
] as const

const formatNoteType = (type: string) => {
  switch (type) {
    case 'free': return 'Free Note'
    case 'daily': return 'Daily Journal'
    case 'weekly': return 'Weekly Review'
    case 'goal': return 'Goal Note'
    case 'task': return 'Task Note'
    case 'challenge': return 'Challenge'
    case 'career': return 'Career'
    default: return type
  }
}

const formatMood = (mood: string | null) => {
  if (!mood) return null
  const moodOption = moodOptions.find(m => m.value === mood)
  return moodOption ? moodOption.label : mood
}

const hasHtmlContent = (content: string) => /<\/?[a-z][\s\S]*>/i.test(content)

const extractStructuredText = (content: string) => {
  if (!content) return ''

  if (!hasHtmlContent(content)) {
    return content
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(content, 'text/html')
  const root = doc.body.cloneNode(true) as HTMLElement

  root.querySelectorAll('li').forEach((item) => {
    const bulletPrefix = doc.createTextNode('• ')
    item.insertBefore(bulletPrefix, item.firstChild)
  })

  return (root.innerText || root.textContent || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const getSearchableContent = (content: string) => {
  return extractStructuredText(content)
    .replace(/\s+/g, ' ')
    .trim()
}

const getPreviewContent = (content: string, maxChars = 220) => {
  const normalized = extractStructuredText(content)
  if (normalized.length <= maxChars) return normalized
  return `${normalized.substring(0, maxChars).trimEnd()}...`
}

type NoteCardProps = {
  note: NoteWithDetails,
  onEdit: (note: NoteWithDetails) => void,
  onArchive: (id: string) => void,
  onView: (note: NoteWithDetails) => void,
  onTogglePin: (id: string, pinned: boolean) => void
}

function NoteCardGridBase({ note, onEdit, onArchive, onView, onTogglePin }: NoteCardProps) {
  const truncatedContent = getPreviewContent(note.content)

  return (
    <div 
      className="group flex flex-col h-full rounded-lg px-5 py-4 transition-shadow duration-200 border-0 shadow hover:shadow-lg bg-white dark:bg-slate-950"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base truncate text-foreground">{note.title}</h3>
            {note.pinned && (
              <Pin className="h-4 w-4 text-primary flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatNoteType(note.type)} • {format(parseISO(note.updated_at), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={() => onTogglePin(note.id, note.pinned)}
            title={note.pinned ? 'Unpin note' : 'Pin note'}
          >
            {note.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={() => onEdit(note)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
              >
                <Archive className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-white dark:bg-card border border-border shadow-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>Archive Note</AlertDialogTitle>
                <AlertDialogDescription>
                  This note will be moved to the Archive. You can restore it later from the Archive section.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => onArchive(note.id)}
                  className="bg-orange-500 text-white hover:bg-orange-600"
                >
                  Archive
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      
      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <span className={cn(
          "inline-flex items-center px-2 py-1 rounded-md text-xs font-medium",
          note.type === 'free' && "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
          note.type === 'daily' && "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
          note.type === 'weekly' && "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
          note.type === 'goal' && "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
          note.type === 'task' && "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
          note.type === 'challenge' && "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
          note.type === 'career' && "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300"
        )}>
          {formatNoteType(note.type)}
        </span>
        {note.mood && (
          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
            <Smile className="mr-1 h-3 w-3" />
            {formatMood(note.mood)}
          </span>
        )}
        {note.goal_title && (
          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
            <Target className="mr-1 h-3 w-3" />
            {note.goal_title}
          </span>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 mb-3">
        <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-4 break-words">
          {truncatedContent}
        </p>
      </div>
      
      {/* Tags */}
      {note.tags && note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {note.tags.slice(0, 4).map((tag: string) => (
            <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
              {tag}
            </span>
          ))}
          {note.tags.length > 4 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
              +{note.tags.length - 4}
            </span>
          )}
        </div>
      )}
      
      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-secondary/20">
        <div className="flex items-center">
          <Clock className="mr-1 h-3 w-3" />
          {format(parseISO(note.updated_at), 'MMM d')}
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 px-2 text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
          onClick={() => onView(note)}
        >
          <Eye className="mr-1 h-3 w-3" />
          View
        </Button>
      </div>
    </div>
  )
}

const NoteCardGrid = memo(NoteCardGridBase, (prev, next) => prev.note === next.note)

function NoteCardListBase({ note, onEdit, onArchive, onView, onTogglePin }: NoteCardProps) {
  const truncatedContent = getPreviewContent(note.content, 140)

  return (
    <div 
      className="group flex items-center justify-between px-4 py-2.5 transition-shadow duration-200 border-0 rounded-md bg-white dark:bg-slate-950 shadow hover:shadow-lg"
      role="button"
      tabIndex={0}
    >
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onView(note)}>
        <div className="flex items-center gap-2">
          <div className="font-medium truncate text-foreground">{note.title}</div>
          {note.pinned && (
            <Pin className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          )}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
          <span className="truncate">{formatNoteType(note.type)}</span>
          <span>•</span>
          <span className="whitespace-nowrap">{format(parseISO(note.updated_at), 'MMM d')}</span>
          {note.mood && (
            <>
              <span>•</span>
              <span className="truncate">{formatMood(note.mood)}</span>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground/80 whitespace-pre-line line-clamp-2 mt-1 break-words">
          {truncatedContent}
        </p>
      </div>
      
      <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7" 
          onClick={() => onTogglePin(note.id, note.pinned)}
          title={note.pinned ? 'Unpin note' : 'Pin note'}
        >
          {note.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7" 
          onClick={() => onEdit(note)}
        >
          <Edit className="h-3.5 w-3.5" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-white dark:bg-card border border-border shadow-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Archive Note</AlertDialogTitle>
              <AlertDialogDescription>
                This note will be moved to the Archive. You can restore it later from the Archive section.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => onArchive(note.id)}
                className="bg-orange-500 text-white hover:bg-orange-600"
              >
                Archive
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

export default function Notes() {
  const { success, error: toastError } = useToaster()
  const queryClient = useQueryClient()
  const { executeCommand } = useUndoRedo()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<Note['type'] | 'all'>('all')
  const [selectedMood, setSelectedMood] = useState<string | 'all'>('all')
  const [selectedGoal, setSelectedGoal] = useState<string | 'all'>('all')
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title'>('updated')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')
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
    pinned: false,
  })
  const [newTag, setNewTag] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [viewingNote, setViewingNote] = useState<NoteWithDetails | null>(null)
  const [formErrors, setFormErrors] = useState<NoteFormErrors>({})
  const deferredSearchQuery = useDeferredValue(searchQuery)
  
  // Fetch notes using database service for consistent data handling
  const { data: notes, isLoading, error: notesError } = useQuery<NoteWithDetails[]>({
    queryKey: ['notes'],
    queryFn: async () => {
      try {
        const fetchedNotes = await database.getNotes()
        return fetchedNotes.map((note: any) => ({
          ...note,
          tags: Array.isArray(note.tags) ? note.tags : []
        }))
      } catch (error) {
        console.error('Failed to fetch notes:', error)
        throw error
      }
    },
    // Notes fetch should work immediately - database service handles electron readiness
    staleTime: 1000,
    refetchOnWindowFocus: true,
  })

  // Fetch goals for dropdown
  const { data: goals } = useQuery<GoalForNote[]>({
    queryKey: ['goals-for-notes'],
    queryFn: async () => {
      try {
        const allGoals = await database.getGoals()
        return allGoals.map(g => ({ id: g.id, title: g.title }))
      } catch (error) {
        console.error('Failed to fetch goals:', error)
        return []
      }
    },
  })

  // Fetch tasks for dropdown
  const { data: tasks } = useQuery<TaskForNote[]>({
    queryKey: ['tasks-for-notes'],
    queryFn: async () => {
      try {
        const allTasks = await database.getTasks({ status: undefined })
        return allTasks
          .filter(t => t.status !== 'completed')
          .map(t => ({ id: t.id, title: t.title }))
      } catch (error) {
        console.error('Failed to fetch tasks:', error)
        return []
      }
    },
  })

  // Filter/sort can be expensive with rich text content, so memoize and defer search updates.
  const filteredNotes = useMemo(() => {
    if (!notes) return []

    const normalizedQuery = deferredSearchQuery.trim().toLowerCase()

    return notes
      .filter((note: NoteWithDetails) => {
        const searchableContent = getSearchableContent(note.content).toLowerCase()
        const matchesSearch =
          normalizedQuery === '' ||
          note.title.toLowerCase().includes(normalizedQuery) ||
          searchableContent.includes(normalizedQuery) ||
          note.tags.some((tag: string) => tag.toLowerCase().includes(normalizedQuery))

        const matchesType = selectedType === 'all' || note.type === selectedType
        const matchesMood = selectedMood === 'all' || (selectedMood === 'none' && !note.mood) || note.mood === selectedMood
        const matchesGoal = selectedGoal === 'all' || (selectedGoal === 'none' && !note.goal_id) || note.goal_id === selectedGoal
        const matchesTab = activeTab === 'all' || note.type === activeTab

        return matchesSearch && matchesType && matchesMood && matchesGoal && matchesTab
      })
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1

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
  }, [notes, deferredSearchQuery, selectedType, selectedMood, selectedGoal, activeTab, sortBy])

  const stats: NoteStats = useMemo(() => {
    if (!notes || notes.length === 0) {
      return {
        total: 0,
        free: 0,
        daily: 0,
        weekly: 0,
        goal: 0,
        task: 0,
        challenge: 0,
        career: 0,
        withMood: 0,
        withTags: 0,
      }
    }

    const next: NoteStats = {
      total: notes.length,
      free: 0,
      daily: 0,
      weekly: 0,
      goal: 0,
      task: 0,
      challenge: 0,
      career: 0,
      withMood: 0,
      withTags: 0,
    }

    for (const note of notes) {
      if (note.type === 'free') next.free += 1
      if (note.type === 'daily') next.daily += 1
      if (note.type === 'weekly') next.weekly += 1
      if (note.type === 'goal') next.goal += 1
      if (note.type === 'task') next.task += 1
      if (note.type === 'challenge') next.challenge += 1
      if (note.type === 'career') next.career += 1
      if (note.mood) next.withMood += 1
      if (note.tags && note.tags.length > 0) next.withTags += 1
    }

    return next
  }, [notes])

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (noteData: NoteFormData) => {
      return await database.createNote({
        title: noteData.title,
        content: noteData.content,
        type: noteData.type,
        mood: noteData.mood || undefined,
        goal_id: noteData.goal_id || undefined,
        task_id: noteData.task_id || undefined,
        tags: noteData.tags,
      })
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
      return await database.updateNote(id, {
        title: updates.title,
        content: updates.content,
        type: updates.type,
        mood: updates.mood === undefined ? undefined : (updates.mood || null) as any,
        goal_id: updates.goal_id === undefined ? undefined : (updates.goal_id || null) as any,
        task_id: updates.task_id === undefined ? undefined : (updates.task_id || null) as any,
        tags: updates.tags,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      success('Note updated successfully')
      setIsCreating(false)
      setIsEditing(null)
      resetForm()
    },
    onError: (error) => {
      console.error('Failed to update note:', error)
      toastError('Failed to update note')
    },
  })

  // Archive note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      await database.archiveNote(id)
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      queryClient.invalidateQueries({ queryKey: ['archive'] })
      success('Note archived')
    },
    onError: (error) => {
      console.error('Failed to archive note:', error)
      toastError('Failed to archive note')
    },
  })

  // Toggle pin mutation
  const togglePinMutation = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const note = notes?.find(n => n.id === id)
      if (!note) throw new Error('Note not found')
      
      return await database.updateNote(id, {
        title: note.title,
        content: note.content,
        type: note.type,
        mood: note.mood || undefined,
        goal_id: note.goal_id || undefined,
        task_id: note.task_id || undefined,
        tags: note.tags,
        pinned: !pinned,
      })
    },
    onSuccess: (_, { pinned }) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      success(pinned ? 'Note unpinned' : 'Note pinned')
    },
    onError: (error) => {
      console.error('Failed to toggle pin:', error)
      toastError('Failed to update note')
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
      pinned: false,
    })
    setNewTag('')
    setFormErrors({})
  }

  const handleEdit = useCallback((note: NoteWithDetails) => {
    setIsEditing(note.id)
    setFormErrors({})
    setFormData({
      title: note.title,
      content: note.content,
      type: note.type,
      mood: note.mood || '',
      goal_id: note.goal_id || '',
      task_id: note.task_id || '',
      tags: note.tags || [],
      pinned: note.pinned || false,
    })
    setIsCreating(true)
  }, [])

  useEffect(() => {
    const openCreateNote = () => {
      setIsEditing(null)
      resetForm()
      setIsCreating(true)
    }

    window.addEventListener('app:new-note', openCreateNote as EventListener)
    return () => window.removeEventListener('app:new-note', openCreateNote as EventListener)
  }, [])

  const validateForm = () => {
    const errors: NoteFormErrors = {}

    if (!formData.title.trim()) {
      errors.title = 'Please enter a note title.'
    }

    if (!formData.type) {
      errors.type = 'Please select a note type.'
    }

    if (!getSearchableContent(formData.content).trim()) {
      errors.content = 'Please add note content before saving.'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) {
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

  const isFormContentEmpty = useMemo(() => {
    return !getSearchableContent(formData.content).trim()
  }, [formData.content])

  const addTag = useCallback(() => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()],
      })
      setNewTag('')
    }
  }, [formData, newTag])

  const removeTag = useCallback((tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove),
    })
  }, [formData])

  const handleArchiveNote = useCallback((id: string) => {
    deleteNoteMutation.mutate(id)
  }, [deleteNoteMutation])

  const handleTogglePin = useCallback((id: string, pinned: boolean) => {
    togglePinMutation.mutate({ id, pinned })
  }, [togglePinMutation])

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
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Notes</h1>
            <ContextTipsDialog
              title="Notes Tab Tips"
              description="Guidance for capturing ideas, reflecting effectively, and turning notes into action."
              sections={NOTES_TIPS_SECTIONS}
              triggerLabel="Open notes tips"
              onboardingKey="notes-tab-tips"
            />
          </div>
          <p className="text-muted-foreground">
            Capture thoughts, ideas, and reflections
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog
            open={isCreating}
            onOpenChange={(open) => {
              setIsCreating(open)
              if (!open) {
                setIsEditing(null)
                resetForm()
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                className="transition-all duration-300 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg hover:bg-green-700"
                onClick={() => {
                  setIsEditing(null)
                  resetForm()
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Note
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[95vh] bg-white dark:bg-zinc-900 border-0 shadow-xl flex flex-col gap-0 m-2 p-6">
              <DialogHeader className="flex-shrink-0 border-b border-gray-100 dark:border-zinc-700 pb-4">
                <DialogTitle className="text-2xl font-bold">{isEditing ? 'Edit Note' : 'Create New Note'}</DialogTitle>
                <DialogDescription className="text-base mt-1">
                  Capture your thoughts, ideas, or reflections.
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto pr-4 -mr-4 scroll-smooth">
                <div className="space-y-5 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Note Title</label>
                    <Input
                      placeholder="Note title..."
                      value={formData.title}
                      onChange={(e) => {
                        setFormData({ ...formData, title: e.target.value })
                        if (formErrors.title) {
                          setFormErrors((prev) => ({ ...prev, title: undefined }))
                        }
                      }}
                      className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 focus-visible:ring-green-500/50 focus-visible:border-green-500 focus:border-green-500"
                    />
                    {formErrors.title && (
                      <p className="text-xs text-red-500">{formErrors.title}</p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
                      <Select
                        value={formData.type}
                        onValueChange={(value: Note['type']) => {
                          setFormData({ ...formData, type: value })
                          if (formErrors.type) {
                            setFormErrors((prev) => ({ ...prev, type: undefined }))
                          }
                        }}
                      >
                        <SelectTrigger className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 focus:ring-green-500/50 focus:border-green-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free Note</SelectItem>
                          <SelectItem value="daily">Daily Journal</SelectItem>
                          <SelectItem value="weekly">Weekly Review</SelectItem>
                          <SelectItem value="goal">Goal Note</SelectItem>
                          <SelectItem value="task">Task Note</SelectItem>
                          <SelectItem value="challenge">Challenge</SelectItem>
                          <SelectItem value="career">Career</SelectItem>
                        </SelectContent>
                      </Select>
                      {formErrors.type && (
                        <p className="text-xs text-red-500">{formErrors.type}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mood (Optional)</label>
                      <Select
                        value={formData.mood || "none"}
                        onValueChange={(value) => 
                          setFormData({ ...formData, mood: value === "none" ? "" : value })
                        }
                      >
                        <SelectTrigger className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 focus:ring-green-500/50 focus:border-green-500">
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
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Related Goal (Optional)</label>
                      <Select
                        value={formData.goal_id || "none"}
                        onValueChange={(value) => 
                          setFormData({ ...formData, goal_id: value === "none" ? "" : value })
                        }
                      >
                        <SelectTrigger className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 focus:ring-green-500/50 focus:border-green-500">
                          <SelectValue placeholder="Select a goal..." />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="none">No Goal</SelectItem>
                          {goals?.map((goal: any) => (
                            <SelectItem key={goal.id} value={goal.id}>
                              <span className="line-clamp-2">{goal.title}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Related Task (Optional)</label>
                      <Select
                        value={formData.task_id || "none"}
                        onValueChange={(value) => 
                          setFormData({ ...formData, task_id: value === "none" ? "" : value })
                        }
                      >
                        <SelectTrigger className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 focus:ring-green-500/50 focus:border-green-500">
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
                  
                  {/* Content editor with fixed toolbar + internal content scroll */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Content</label>
                    <RichTextEditor
                      value={formData.content}
                      onChange={(content) => {
                        setFormData({ ...formData, content })
                        if (formErrors.content) {
                          setFormErrors((prev) => ({ ...prev, content: undefined }))
                        }
                      }}
                      placeholder="Write your note here..."
                      className="h-[360px] bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
                      autoSaveDelay={800}
                    />
                    {formErrors.content && (
                      <p className="text-xs text-red-500">{formErrors.content}</p>
                    )}
                  </div>
                  
                  {/* Extra spacing for writing comfort */}
                  <div className="h-16"></div>
                  
                  {/* Tags */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tags</label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a tag..."
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addTag()}
                        className="bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 focus-visible:ring-green-500/50 focus:border-green-500"
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
              </div>
              
              <DialogFooter className="flex-shrink-0 border-t border-gray-100 dark:border-zinc-700 pt-4 mt-4 gap-2">
                <Button 
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false)
                    setIsEditing(null)
                    resetForm()
                  }}
                  className="bg-transparent dark:bg-transparent border-green-500/30 text-green-600 dark:text-green-300 hover:bg-green-500/10 hover:border-green-500/50 transition-colors duration-200"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={
                    createNoteMutation.isPending ||
                    updateNoteMutation.isPending ||
                    !formData.title.trim() ||
                    !formData.type ||
                    isFormContentEmpty
                  }
                >
                  {isEditing ? 'Update Note' : 'Create Note'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* View Note Modal */}
          <Dialog open={!!viewingNote} onOpenChange={(open) => !open && setViewingNote(null)}>
            <DialogContent className="max-w-6xl max-h-[95vh] bg-white dark:bg-zinc-900 border-0 shadow-xl flex flex-col gap-0 m-2 p-6 overflow-hidden">
              <DialogHeader className="flex-shrink-0 border-b border-gray-100 dark:border-zinc-700 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="text-3xl font-bold">{viewingNote?.title}</DialogTitle>
                    <DialogDescription className="mt-3 flex items-center gap-2 text-base">
                      {viewingNote && (
                        <>
                          <Badge className={cn(
                            "border-0",
                            viewingNote.type === 'free' && "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
                            viewingNote.type === 'daily' && "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
                            viewingNote.type === 'weekly' && "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
                            viewingNote.type === 'goal' && "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
                            viewingNote.type === 'task' && "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
                            viewingNote.type === 'challenge' && "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
                            viewingNote.type === 'career' && "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300"
                          )}>
                            {formatNoteType(viewingNote.type)}
                          </Badge>
                          <span className="text-muted-foreground">•</span>
                          <span>{format(parseISO(viewingNote.created_at), 'PPP p')}</span>
                        </>
                      )}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                {viewingNote && (
                  <div className="space-y-6 py-4">
                    {/* Metadata Badges */}
                    <div className="flex flex-wrap gap-2">
                      {viewingNote.mood && (
                        <Badge className="px-3 py-1 bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-0">
                          <Smile className="mr-2 h-3.5 w-3.5" />
                          {formatMood(viewingNote.mood)}
                        </Badge>
                      )}
                      {viewingNote.goal_title && (
                        <Badge className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-0">
                          <Target className="mr-2 h-3.5 w-3.5" />
                          {viewingNote.goal_title}
                        </Badge>
                      )}
                      {viewingNote.task_title && (
                        <Badge className="px-3 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-0">
                          <Bookmark className="mr-2 h-3.5 w-3.5" />
                          {viewingNote.task_title}
                        </Badge>
                      )}
                    </div>

                    {/* Content */}
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <style>{`
                        .note-content mark {
                          background-color: #fef08a;
                          color: #854d0e;
                          padding: 0.125rem 0.25rem;
                          border-radius: 0.125rem;
                        }
                        .dark .note-content mark {
                          background-color: #713f12;
                          color: #fef08a;
                        }
                        .note-content strong,
                        .note-content b {
                          font-weight: 600;
                          color: inherit;
                        }
                        .dark .note-content strong,
                        .dark .note-content b {
                          color: rgb(241, 245, 249);
                        }
                        .note-content em,
                        .note-content i {
                          font-style: italic;
                          color: inherit;
                        }
                        .note-content u {
                          text-decoration: underline;
                          color: inherit;
                        }
                        .note-content code {
                          background-color: rgb(241, 245, 249);
                          color: rgb(51, 65, 85);
                          padding: 0.125rem 0.375rem;
                          border-radius: 0.25rem;
                          font-family: 'Monaco', 'Menlo', monospace;
                          font-size: 0.875em;
                        }
                        .dark .note-content code {
                          background-color: rgb(30, 41, 59);
                          color: rgb(226, 232, 240);
                        }
                      `}</style>
                      <div className="font-sans text-base leading-relaxed p-4 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-slate-200">
                        {hasHtmlContent(viewingNote.content) ? (
                          <div
                            className="note-content break-words [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:my-1"
                            dangerouslySetInnerHTML={{ __html: viewingNote.content }}
                          />
                        ) : (
                          <div className="whitespace-pre-wrap break-words">{viewingNote.content}</div>
                        )}
                      </div>
                    </div>

                    {/* Tags */}
                    {viewingNote.tags && viewingNote.tags.length > 0 && (
                      <div className="pt-4 border-t">
                        <div className="flex flex-wrap gap-2">
                          {viewingNote.tags.map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              <Tag className="mr-1 h-3 w-3" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <DialogFooter className="flex-shrink-0 border-t border-gray-100 dark:border-zinc-700 pt-4 mt-4 gap-2">
                <Button 
                  variant="outline"
                  onClick={() => setViewingNote(null)}
                  className="border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-500/10 hover:border-green-500/50"
                >
                  Close
                </Button>
                <Button onClick={() => {
                    if (viewingNote) {
                        handleEdit(viewingNote)
                        setViewingNote(null)
                    }
                }}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Note
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
                className="pl-10 bg-secondary/50 border border-green-500/50 focus-visible:ring-1 focus-visible:ring-primary/50"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Select value={selectedType} onValueChange={(value) => setSelectedType(value as any)}>
                <SelectTrigger className="w-[140px] bg-secondary/50 border border-green-500/50 focus:ring-1 focus:ring-primary/50">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="free">Free Notes</SelectItem>
                  <SelectItem value="daily">Daily Journals</SelectItem>
                  <SelectItem value="weekly">Weekly Reviews</SelectItem>
                  <SelectItem value="goal">Goal Notes</SelectItem>
                  <SelectItem value="task">Task Notes</SelectItem>
                  <SelectItem value="challenge">Challenges</SelectItem>
                  <SelectItem value="career">Career Notes</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={selectedMood} onValueChange={setSelectedMood}>
                <SelectTrigger className="w-[140px] bg-secondary/50 border border-green-500/50 focus:ring-1 focus:ring-primary/50">
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
                <SelectTrigger className="w-[140px] bg-secondary/50 border border-green-500/50 focus:ring-1 focus:ring-primary/50">
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
                <SelectTrigger className="w-[140px] bg-secondary/50 border border-green-500/50 focus:ring-1 focus:ring-primary/50">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated">Recently Updated</SelectItem>
                  <SelectItem value="created">Recently Created</SelectItem>
                  <SelectItem value="title">Title (A-Z)</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex items-center gap-1 bg-gray-100/50 dark:bg-gray-800/30 rounded-lg p-1">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "rounded-md",
                    viewMode === 'list' ? '' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  List
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "rounded-md",
                    viewMode === 'grid' ? '' : 'text-muted-foreground hover:text-foreground'
                  )}
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
        <TabsList className="w-full bg-secondary/30 dark:bg-secondary/20 p-1 h-12 border-transparent">
          <TabsTrigger value="all" className="flex-1">
            All Notes [{stats.total}]
          </TabsTrigger>
          <TabsTrigger value="free" className="flex-1">
            Free [{stats.free}]
          </TabsTrigger>
          <TabsTrigger value="daily" className="flex-1">
            Daily [{stats.daily}]
          </TabsTrigger>
          <TabsTrigger value="weekly" className="flex-1">
            Weekly [{stats.weekly}]
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-fr">
          {filteredNotes?.map((note: NoteWithDetails) => (
            <NoteCardGrid 
              key={note.id} 
              note={note} 
              onEdit={handleEdit}
              onArchive={handleArchiveNote}
              onView={setViewingNote}
              onTogglePin={handleTogglePin}
            />
          ))}
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {filteredNotes?.map((note: NoteWithDetails) => (
          <NoteCardList 
            key={note.id} 
            note={note} 
            onEdit={handleEdit}
            onArchive={handleArchiveNote}
            onView={setViewingNote}
            onTogglePin={handleTogglePin}
          />
        ))}
      </div>
    )
  }
}

const NoteCardList = memo(NoteCardListBase, (prev, next) => prev.note === next.note)