import { NavLink } from 'react-router-dom'
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
  ChevronLeft,
  ChevronRight,
  Sparkles,
  User
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

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
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { icon: Clock, label: 'Time', path: '/time' },
  { icon: Archive, label: 'Archive', path: '/archive' },
  { icon: Settings, label: 'Settings', path: '/settings' }
]

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const dailyProgress = 0

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 bg-card transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-64',
        'border-r border-border/30 shadow-lg shadow-black/10' // 🌟 subtle professional shadow
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center border-b border-border/30 overflow-hidden">
        <div
          className={cn(
            'flex items-center gap-3 transition-all duration-300 ease-in-out',
            collapsed ? 'w-16 justify-center px-0' : 'w-full px-4'
          )}
        >
          {/* Logo */}
          <div
            className={cn(
              'flex-shrink-0 flex items-center justify-center rounded-lg bg-green-500 transition-all duration-300',
              collapsed ? 'h-0 w-0 opacity-0 scale-0' : 'h-8 w-8 opacity-100 scale-100'
            )}
          >
            <Sparkles className="h-4 w-4 text-white" />
          </div>

          {/* Animated Text */}
          <span
            className={cn(
              'font-bold whitespace-nowrap transition-all duration-300 ease-in-out',
              collapsed ? 'opacity-0 w-0 -translate-x-4' : 'opacity-100 w-auto'
            )}
          >
            Progress OS
          </span>
        </div>

        {/* Toggle button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className={cn(
            'absolute transition-all duration-300 hover:bg-green-500/10 hover:text-green-500',
            collapsed ? 'right-2' : 'right-3'
          )}
        >
          <ChevronLeft
            className={cn(
              'h-4 w-4 transition-transform duration-300',
              collapsed && 'rotate-180'
            )}
          />
        </Button>
      </div>

      {/* Navigation */}
      <nav
        className={cn(
          'transition-all duration-300',
          collapsed
            ? 'mt-8 flex flex-col items-center gap-6 px-2'
            : 'mt-3 px-2 space-y-1'
        )}
      >
        {navItems.map(({ icon: Icon, label, path }) => {
          const link = (
            <NavLink
              to={path}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center rounded-lg transition-all duration-200',

                  // background only — NO text color here
                  isActive
                    ? 'bg-green-500/15 shadow-sm shadow-green-500/10'
                    : 'hover:bg-green-500/10',

                  !collapsed &&
                    'h-10 px-3 gap-3 justify-start text-sm font-medium',

                  collapsed && 'h-10 w-10 justify-center'
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
                      collapsed ? 'h-6 w-6' : 'h-5 w-5',
                      isActive
                        ? 'text-green-500'
                        : 'text-foreground group-hover:text-green-500'
                    )}
                  />

                  <span
                    className={cn(
                      'transition-all duration-300 whitespace-nowrap',
                      collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
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
              <TooltipContent side="right" className="bg-card border-green-500/20">
                {label}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div key={path}>{link}</div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 w-full border-t border-border/30 p-3">
        <div
          className={cn(
            'flex items-center transition-all duration-300',
            collapsed ? 'justify-center' : 'gap-3'
          )}
        >
          <div className="h-9 w-9 rounded-full bg-green-500/20 flex items-center justify-center">
            <User className="h-5 w-5 text-green-500" />
          </div>

          <div
            className={cn(
              'overflow-hidden transition-all duration-300',
              collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            )}
          >
            <p className="text-sm font-medium">User</p>
            <p className="text-xs text-muted-foreground">
              Daily progress: {dailyProgress}%
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
