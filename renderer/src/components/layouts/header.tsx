import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Bell, HelpCircle, Sun, Moon, Menu, X, Filter, CheckSquare, Target, FileText, Repeat, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useStore } from '@/store'
import { useElectron } from '@/hooks/use-electron'
import { cn } from '@/lib/utils'
import { calculateDailyProgress } from '@/lib/progress'

interface HeaderProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}

interface SearchResult {
  id: string
  type: 'task' | 'habit' | 'goal' | 'note'
  title: string
  status?: string
  tags?: string[]
  priority?: string
}

interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  type: string
  mood?: string
  created_at: string
  updated_at: string
}

export function Header({ sidebarCollapsed, onToggleSidebar }: HeaderProps) {
  const navigate = useNavigate()
  const electron = useElectron()
  const { theme, toggleTheme, notifications, userProfile, tasks, habits, goals, syncEnabled, syncStatus } = useStore()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const unreadNotifications = notifications.filter(n => !n.read).length
  
  // Fetch notes for search
  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: ['notes-for-search'],
    queryFn: async () => {
      try {
        const notesData = await electron.executeQuery<Note[]>(`
          SELECT id, title, content, tags, type, mood, created_at, updated_at
          FROM notes
          WHERE deleted_at IS NULL
          ORDER BY updated_at DESC
        `)
        return (Array.isArray(notesData) ? notesData : []).map((note: any) => {
          let tags: string[] = []
          try {
            tags = typeof note.tags === 'string' ? JSON.parse(note.tags || '[]') : note.tags
          } catch {
            tags = []
          }
          return { ...note, tags: Array.isArray(tags) ? tags : [] }
        })
      } catch (error) {
        console.error('Failed to fetch notes for search:', error)
        return []
      }
    },
    enabled: electron.isReady,
    staleTime: 30000, // Cache for 30 seconds
  })

  // Calculate daily progress
  const dailyProgress = useMemo(() => {
    return calculateDailyProgress(tasks, habits)
  }, [tasks, habits])

  // Get user initials for avatar
  const userInitials = useMemo(() => {
    if (!userProfile.name) return 'U'
    return userProfile.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }, [userProfile.name])

  // Search results
  const searchResults = useMemo((): SearchResult[] => {
    if (!searchQuery.trim()) return []
    
    const query = searchQuery.toLowerCase().trim()
    const results: SearchResult[] = []
    
    // Search tasks
    tasks.forEach(task => {
      const titleMatch = task.title?.toLowerCase().includes(query)
      const tagMatch = task.tags?.some((tag: string) => tag.toLowerCase().includes(query))
      const statusMatch = task.status?.toLowerCase().includes(query)
      
      if (titleMatch || tagMatch || statusMatch) {
        results.push({
          id: task.id,
          type: 'task',
          title: task.title,
          status: task.status,
          tags: task.tags,
          priority: task.priority,
        })
      }
    })
    
    // Search habits
    habits.forEach(habit => {
      const titleMatch = habit.title?.toLowerCase().includes(query)
      const descMatch = habit.description?.toLowerCase().includes(query)
      const freqMatch = habit.frequency?.toLowerCase().includes(query)
      
      if (titleMatch || descMatch || freqMatch) {
        results.push({
          id: habit.id,
          type: 'habit',
          title: habit.title,
          status: habit.frequency,
        })
      }
    })
    
    // Search goals
    goals.forEach(goal => {
      const titleMatch = goal.title?.toLowerCase().includes(query)
      const descMatch = goal.description?.toLowerCase().includes(query)
      const tagMatch = goal.tags?.some((tag: string) => tag.toLowerCase().includes(query))
      const categoryMatch = goal.category?.toLowerCase().includes(query)
      
      if (titleMatch || descMatch || tagMatch || categoryMatch) {
        results.push({
          id: goal.id,
          type: 'goal',
          title: goal.title,
          status: goal.status,
          tags: goal.tags,
          priority: goal.priority,
        })
      }
    })
    
    // Search notes
    notes.forEach(note => {
      const titleMatch = note.title?.toLowerCase().includes(query)
      const contentMatch = note.content?.toLowerCase().includes(query)
      const tagMatch = note.tags?.some((tag: string) => tag.toLowerCase().includes(query))
      const typeMatch = note.type?.toLowerCase().includes(query)
      
      if (titleMatch || contentMatch || tagMatch || typeMatch) {
        results.push({
          id: note.id,
          type: 'note',
          title: note.title,
          status: note.type,
          tags: note.tags,
        })
      }
    })
    
    // Limit results and remove duplicates
    const uniqueResults = results.filter((result, index, self) => 
      index === self.findIndex(r => r.id === result.id && r.type === result.type)
    )
    
    return uniqueResults.slice(0, 10)
  }, [searchQuery, tasks, habits, goals, notes])

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchResults])

  // Handle navigation to result
  const handleSelectResult = useCallback((result: SearchResult) => {
    // Navigate to the appropriate page with the item ID in state
    switch (result.type) {
      case 'task':
        navigate('/tasks', { state: { highlightId: result.id } })
        break
      case 'habit':
        navigate('/habits', { state: { highlightId: result.id } })
        break
      case 'goal':
        navigate('/goals', { state: { highlightId: result.id } })
        break
      case 'note':
        navigate('/notes', { state: { highlightId: result.id } })
        break
    }
    
    // Clear search
    setSearchQuery('')
    setSearchOpen(false)
    searchInputRef.current?.blur()
  }, [navigate])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!searchResults.length) return
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % searchResults.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length)
        break
      case 'Enter':
        e.preventDefault()
        if (searchResults[selectedIndex]) {
          handleSelectResult(searchResults[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setSearchQuery('')
        setSearchOpen(false)
        searchInputRef.current?.blur()
        break
    }
  }, [searchResults, selectedIndex, handleSelectResult])

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && searchResults.length > 0) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, searchResults.length])

  // Get icon for result type
  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'task':
        return <CheckSquare className="h-4 w-4 text-blue-500" />
      case 'habit':
        return <Repeat className="h-4 w-4 text-purple-500" />
      case 'goal':
        return <Target className="h-4 w-4 text-green-500" />
      case 'note':
        return <FileText className="h-4 w-4 text-orange-500" />
    }
  }

  // Get type label
  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'task': return 'Task'
      case 'habit': return 'Habit'
      case 'goal': return 'Goal'
      case 'note': return 'Note'
    }
  }

  // Get status badge variant
  const getStatusVariant = (status?: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (!status) return 'secondary'
    const s = status.toLowerCase()
    if (s === 'completed' || s === 'done') return 'default'
    if (s === 'active' || s === 'in-progress') return 'secondary'
    if (s === 'overdue' || s === 'paused') return 'destructive'
    return 'outline'
  }

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 dark:bg-zinc-900/95 dark:supports-[backdrop-filter]:bg-zinc-900/90 shadow-md shadow-black/8 dark:shadow-black/20">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Left Section */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="h-9 w-9"
          >
            {sidebarCollapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
          </Button>

          {/* Breadcrumb */}
          <div className="hidden md:flex items-center space-x-2 text-sm">
            <span className="text-muted-foreground">Progress OS</span>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">Dashboard</span>
          </div>
        </div>

        {/* Center Section - Search */}
        <div className={cn(
          "absolute left-1/2 transform -translate-x-1/2 transition-all duration-300",
          searchOpen ? "w-[420px] opacity-100" : "w-64 opacity-90"
        )}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
            <Input
              ref={searchInputRef}
              placeholder="Search tasks, goals, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 pr-12 bg-secondary/50 border border-green-500/20 focus-visible:ring-1 focus-visible:ring-green-500/50 focus-visible:border-green-500/40 dark:bg-zinc-800/50 dark:border-green-500/15"
              onFocus={() => setSearchOpen(true)}
              onBlur={() => {
                // Delay closing to allow click on results
                setTimeout(() => {
                  if (!resultsRef.current?.contains(document.activeElement)) {
                    setSearchOpen(false)
                  }
                }, 150)
              }}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-green-500/20 bg-secondary/50 px-1.5 font-mono text-[10px] font-medium opacity-100 sm:inline-flex dark:bg-zinc-800/50 dark:border-green-500/15">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
            
            {/* Search Results Dropdown */}
            {searchOpen && searchQuery.trim() && (
              <div 
                ref={resultsRef}
                className="absolute top-full left-0 right-0 mt-2 bg-popover/95 backdrop-blur-md rounded-lg shadow-xl shadow-black/20 border border-green-500/10 dark:bg-zinc-900/95 dark:border-green-500/10 overflow-hidden z-50"
              >
                {searchResults.length > 0 ? (
                  <div className="max-h-[360px] overflow-y-auto py-1">
                    {searchResults.map((result, index) => (
                      <div
                        key={`${result.type}-${result.id}`}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors duration-150",
                          index === selectedIndex 
                            ? "bg-accent/60 dark:bg-accent/40" 
                            : "hover:bg-accent/40 dark:hover:bg-accent/20"
                        )}
                        onClick={() => handleSelectResult(result)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        {/* Type Icon */}
                        <div className="flex-shrink-0">
                          {getTypeIcon(result.type)}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{result.title}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">
                              {getTypeLabel(result.type)}
                            </Badge>
                          </div>
                          
                          {/* Status and Tags */}
                          <div className="flex items-center gap-2 mt-0.5">
                            {result.status && (
                              <Badge variant={getStatusVariant(result.status)} className="text-[10px] px-1.5 py-0 h-4">
                                {result.status}
                              </Badge>
                            )}
                            {result.tags && result.tags.length > 0 && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Tag className="h-3 w-3" />
                                <span className="truncate max-w-[120px]">
                                  {result.tags.slice(0, 2).join(', ')}
                                  {result.tags.length > 2 && ` +${result.tags.length - 2}`}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Keyboard hint */}
                        {index === selectedIndex && (
                          <div className="flex-shrink-0 text-xs text-muted-foreground">
                            <kbd className="px-1.5 py-0.5 rounded bg-secondary/50 dark:bg-zinc-800/50">↵</kbd>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center">
                    <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No results found</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Try searching for tasks, habits, goals, or notes
                    </p>
                  </div>
                )}
                
                {/* Footer hint */}
                {searchResults.length > 0 && (
                  <div className="px-3 py-2 border-t border-border/30 dark:border-zinc-700/50 bg-secondary/30 dark:bg-zinc-800/50">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 rounded bg-secondary/50 dark:bg-zinc-800">↑↓</kbd>
                        <span>Navigate</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 rounded bg-secondary/50 dark:bg-zinc-800">↵</kbd>
                        <span>Select</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 rounded bg-secondary/50 dark:bg-zinc-800">Esc</kbd>
                        <span>Close</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-2">
          {/* Theme Toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  className="h-9 w-9"
                >
                  {theme === 'dark' ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle theme</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Filter Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 relative">
                  <Filter className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Filters</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 relative">
                <Bell className="h-5 w-5" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-white">
                    {unreadNotifications}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.slice(0, 5).map((notification) => (
                <DropdownMenuItem key={notification.id} className="py-3">
                  <div className="flex items-start space-x-3">
                    <div className={cn(
                      "mt-1 h-2 w-2 rounded-full",
                      notification.type === 'success' && "bg-status-completed",
                      notification.type === 'warning' && "bg-status-paused",
                      notification.type === 'info' && "bg-primary",
                      notification.type === 'error' && "bg-destructive",
                    )} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="text-xs text-muted-foreground">{notification.message}</p>
                      <span className="text-xs text-muted-foreground">
                        {notification.time}
                      </span>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
              {notifications.length > 5 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-center text-sm font-medium text-primary">
                    View all notifications
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Help */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <HelpCircle className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Help & Support</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 w-9 rounded-full p-0 overflow-hidden">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={userProfile.avatar} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-green-400 text-white text-sm font-bold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="px-2 py-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={userProfile.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-green-400 text-white font-bold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{userProfile.name || 'User'}</p>
                    <p className="text-xs text-muted-foreground">{userProfile.email || 'Set up your profile'}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Today's Progress</span>
                  <span className={cn(
                    "font-medium",
                    dailyProgress >= 80 ? "text-green-500" :
                    dailyProgress >= 50 ? "text-yellow-500" :
                    "text-muted-foreground"
                  )}>
                    {dailyProgress}%
                  </span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                Preferences
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/backup')}>
                Backup & Restore
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-muted-foreground cursor-not-allowed">
                Sign out (Local Mode)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Status Bar */}
      <div className="px-6 py-1.5 bg-secondary/70 dark:bg-zinc-800/95">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={cn(
                "h-2 w-2 rounded-full animate-pulse",
                syncStatus === 'syncing' ? "bg-yellow-500" :
                syncStatus === 'error' ? "bg-red-500" :
                "bg-green-500"
              )} />
              <span className="text-muted-foreground">
                {syncStatus === 'syncing' ? 'Syncing...' :
                 syncStatus === 'error' ? 'Sync Error' :
                 'System: Online'}
              </span>
            </div>
            <span className="text-muted-foreground">•</span>
            <Badge variant="secondary" className="font-normal">
              {syncEnabled ? 'Cloud Sync' : 'Local Mode'}
            </Badge>
            <span className="text-muted-foreground">•</span>
            <span className={cn(
              "font-medium",
              dailyProgress >= 80 ? "text-green-500" :
              dailyProgress >= 50 ? "text-yellow-500" :
              "text-muted-foreground"
            )}>
              Progress: {dailyProgress}%
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}