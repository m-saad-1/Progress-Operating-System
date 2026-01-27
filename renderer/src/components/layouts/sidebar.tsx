import React from 'react'
import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Target, 
  CheckSquare, 
  Calendar,
  TrendingUp,
  FileText,
  BarChart3,
  Settings,
  Archive,
  Clock,
  Users,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Home,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useStore } from '@/store'

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
  { icon: Settings, label: 'Settings', path: '/settings' },
]

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { dailyProgress, weeklyConsistency } = useStore()

  return (
    <aside className={cn(
      "fixed left-0 top-0 z-40 h-screen border-r bg-card shadow-lg transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Sidebar Header */}
      <div className={cn(
        "flex items-center border-b p-4",
        collapsed ? "justify-center" : "justify-between"
      )}>
        {!collapsed && (
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Progress OS</h1>
              <p className="text-xs text-muted-foreground">v1.0.0</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Progress Summary */}
      {!collapsed && (
        <div className="border-b p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium">Today's Progress</span>
            <span className="text-sm font-bold text-primary">{dailyProgress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
              style={{ width: `${dailyProgress}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Weekly Consistency</span>
            <span className="font-medium">{weeklyConsistency}%</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => (
          <TooltipProvider key={item.path}>
            <Tooltip>
              <TooltipTrigger asChild>
                <NavLink
                  to={item.path}
                  className={({ isActive }) => cn(
                    "flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    collapsed ? "justify-center" : "justify-start gap-3"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right">
                  <p>{item.label}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        ))}
      </nav>

      {/* Quick Actions */}
      {!collapsed && (
        <div className="border-t p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Quick Actions
          </h3>
          <div className="space-y-2">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-3 px-3 text-muted-foreground">
              <Home className="h-4 w-4" />
              Quick Review
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-3 px-3 text-muted-foreground">
              <HelpCircle className="h-4 w-4" />
              Help & Support
            </Button>
          </div>
        </div>
      )}

      {/* User Profile */}
      <div className={cn(
        "border-t p-4",
        collapsed ? "flex justify-center" : ""
      )}>
        {!collapsed ? (
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-purple-500" />
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">John Doe</p>
              <p className="truncate text-xs text-muted-foreground">Productivity Level: Expert</p>
            </div>
          </div>
        ) : (
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-purple-500" />
        )}
      </div>
    </aside>
  )
}