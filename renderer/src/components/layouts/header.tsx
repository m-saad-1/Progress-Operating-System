import React, { useState } from 'react'
import { Search, Bell, HelpCircle, Sun, Moon, Menu, X, Filter } from 'lucide-react'
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
import { useStore } from '@/store'
import { cn } from '@/lib/utils'

interface HeaderProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}

export function Header({ sidebarCollapsed, onToggleSidebar }: HeaderProps) {
  const { theme, toggleTheme, notifications } = useStore()
  const [searchOpen, setSearchOpen] = useState(false)

  const unreadNotifications = notifications.filter(n => !n.read).length

  return (
    <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
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
          searchOpen ? "w-96 opacity-100" : "w-64 opacity-90"
        )}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tasks, goals, notes..."
              className="pl-10 pr-4"
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setSearchOpen(false)}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:inline-flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
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
              <Button variant="ghost" className="h-9 w-9 rounded-full p-0">
                <div className="h-full w-full rounded-full bg-gradient-to-br from-primary to-purple-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>Backup & Restore</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Status Bar */}
      <div className="border-t px-6 py-1.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-status-completed animate-pulse" />
              <span className="text-muted-foreground">System: Online</span>
            </div>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">Last sync: 2 min ago</span>
            <span className="text-muted-foreground">•</span>
            <Badge variant="secondary" className="font-normal">
              Local Mode
            </Badge>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-muted-foreground">Storage: 85% used</span>
            <div className="h-1.5 w-20 rounded-full bg-secondary overflow-hidden">
              <div className="h-full w-4/5 bg-gradient-to-r from-primary to-primary/60 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}