import { NavLink, useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import {
  LayoutDashboard,
  Target,
  CheckSquare,
  Calendar,
  FileText,
  BarChart3,
  Settings,
  Archive,
  Clock,
  Sparkles,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useStore } from '@/store'
import { useTodayAnalyticsProductivity } from '@/hooks/use-today-analytics-productivity'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Target, label: 'Goals', path: '/goals' },
  { icon: CheckSquare, label: 'Tasks', path: '/tasks' },
  { icon: Calendar, label: 'Habits', path: '/habits' },
  { icon: FileText, label: 'Notes', path: '/notes' },
  { icon: BookOpen, label: 'Reviews', path: '/reviews' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { icon: Clock, label: 'Time', path: '/time' },
  { icon: Archive, label: 'Archive', path: '/archive' },
  { icon: Settings, label: 'Settings', path: '/settings' }
]

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const navigate = useNavigate()
  const store = useStore()
  const todayProductivity = useTodayAnalyticsProductivity()
  
  // Get user initials for avatar
  const userInitials = useMemo(() => {
    if (!store.userProfile.name) return 'U'
    return store.userProfile.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }, [store.userProfile.name])

  // Get display name (first name or 'User')
  const displayName = useMemo(() => {
    if (!store.userProfile.name) return 'User'
    return store.userProfile.name.split(' ')[0]
  }, [store.userProfile.name])

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 bg-card transition-[width] duration-300 ease-out will-change-[width]',
        collapsed ? 'w-14' : 'w-48',
        collapsed
          ? 'border-r border-border/30 shadow-none dark:border-border/20 dark:shadow-none'
          : 'border-r border-border/30 shadow-sm dark:border-border/20 dark:shadow-black/20'
      )}
    >
      {/* Header */}
      <div className="relative mx-2 mt-2 flex h-14 items-center overflow-hidden rounded-xl bg-primary/5 px-2 dark:bg-primary/10">
        <div
          role="button"
          tabIndex={0}
          onClick={onToggle}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onToggle()
            }
          }}
          className={cn(
            'flex min-w-0 w-full items-center cursor-pointer transition-[padding] duration-300 ease-out select-none outline-none focus:outline-none',
            collapsed ? 'justify-center gap-0 px-0' : 'justify-start gap-3 pl-2 pr-2'
          )}
        >
          {/* Logo - Always visible, centered when collapsed */}
          <div className={cn(
            'w-8 shrink-0 transform-gpu transition-transform duration-300 flex items-center justify-center',
            collapsed ? '' : ''
          )}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
          </div>

          {/* Animated Text */}
          <span
            className={cn(
              'truncate whitespace-nowrap font-bold transition-[max-width,opacity,transform] duration-300 ease-out will-change-[max-width,opacity,transform]',
              collapsed ? 'max-w-0 -translate-x-2 opacity-0' : 'max-w-[120px] translate-x-0 opacity-100'
            )}
          >
            Progress OS
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav
        className={cn(
          'transition-all duration-300 pb-28',
          collapsed
            ? 'mt-4 px-2 space-y-1'
            : 'mt-3 px-2 space-y-1'
        )}
      >
        {navItems.map(({ icon: Icon, label, path }) => {
          const link = (
            <NavLink
              to={path}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center rounded-lg transition-[background-color,color,transform] duration-200 ease-out transform-gpu',

                  // background only — NO text color here
                  isActive
                    ? collapsed
                      ? 'bg-transparent shadow-none'
                      : 'bg-green-500/15 shadow-sm shadow-green-500/10'
                    : collapsed
                      ? 'hover:bg-transparent'
                      : 'hover:bg-green-500/10',

                  !collapsed && 'h-10 w-full px-3 gap-3 justify-start text-sm font-medium',

                  collapsed && 'mx-auto h-10 w-10 justify-center px-0 bg-transparent border-none shadow-none'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className={cn(
                        'absolute left-0 top-1/2 -translate-y-1/2 w-[3px] bg-green-500 rounded-r-full',
                        collapsed ? 'h-5 -left-2' : 'h-6 -left-2'
                      )}
                    />
                  )}

                  <Icon
                    className={cn(
                      'flex-shrink-0 transition-colors duration-200',
                      'h-5 w-5',
                      isActive
                        ? 'text-green-500'
                        : 'text-foreground group-hover:text-green-500'
                    )}
                  />

                  <span
                    className={cn(
                      'overflow-hidden whitespace-nowrap text-sm transition-[max-width,opacity,transform] duration-300 ease-out will-change-[max-width,opacity,transform]',
                      collapsed ? 'max-w-0 -translate-x-1 opacity-0' : 'max-w-[120px] translate-x-0 opacity-100'
                    )}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          )

          return collapsed ? (
            <Tooltip key={path} delayDuration={0}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right" className="bg-card">
                {label}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div key={path}>{link}</div>
          )
        })}
      </nav>

      {/* Footer - User Profile & Progress */}
      <div className="absolute bottom-0 w-full p-2">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => navigate('/settings')}
              className={cn(
                'w-full flex items-center rounded-xl bg-green-500/10 p-2 transition-[background-color,padding] duration-300 ease-out hover:bg-green-500/15 dark:bg-green-500/15 dark:hover:bg-green-500/20',
                collapsed ? 'justify-center' : 'gap-3'
              )}
            >
              <Avatar className="h-9 w-9 border-2 border-primary/30">
                <AvatarImage src={store.userProfile.avatar} />
                <AvatarFallback className="bg-primary/15 text-primary text-sm font-bold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>

              <div
                className={cn(
                  'flex-1 overflow-hidden text-left transition-[max-width,opacity,transform] duration-300 ease-out will-change-[max-width,opacity,transform]',
                  collapsed ? 'max-w-0 -translate-x-1 opacity-0' : 'max-w-[130px] translate-x-0 opacity-100'
                )}
              >
                <p className="text-sm font-medium truncate">{displayName}</p>
                <div className="flex items-center gap-2">
                  <Progress 
                    value={todayProductivity.overall} 
                    className="h-1.5 flex-1 bg-muted"
                  />
                  <span className={cn(
                    "text-xs font-medium",
                    todayProductivity.overall >= 80 ? "text-green-500" :
                    todayProductivity.overall >= 50 ? "text-yellow-500" :
                    "text-muted-foreground"
                  )}>
                    {todayProductivity.overall}%
                  </span>
                </div>
              </div>
            </button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right" className="bg-card">
              <div className="space-y-1">
                <p className="font-medium">{displayName}</p>
                <p className="text-xs text-muted-foreground">Productivity: {todayProductivity.overall}%</p>
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </aside>
  )
}
