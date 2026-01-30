import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { CommandPalette } from '@/components/command-palette'
import { cn } from '@/lib/utils'
import { useHotkeys } from 'react-hotkeys-hook'

export function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Keyboard shortcuts
  useHotkeys('ctrl+b', () => setSidebarCollapsed(!sidebarCollapsed))

  return (
    <div className="relative min-h-screen w-full bg-background text-foreground transition-colors duration-300">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar 
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Main Content Wrapper */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300 ease-in-out",
          sidebarCollapsed ? 'pl-16' : 'pl-64'
        )}>
          {/* Header */}
          <Header 
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          />

          {/* Main Content Area */}
          <main className="flex-1 overflow-auto bg-muted/40 text-foreground">
            <div className="container mx-auto p-6 min-h-full">
              <Outlet />
            </div>
          </main>

          {/* Footer */}
          <footer className="z-10 border-t bg-card px-6 py-3 text-xs text-muted-foreground flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="flex items-center">
                <div className="mr-2 h-2 w-2 rounded-full bg-status-active animate-pulse" />
                All systems operational
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <span>Progress OS v1.0.0</span>
              <span>•</span>
              <span>© {new Date().getFullYear()}</span>
            </div>
          </footer>
        </div>
      </div>

      {/* Overlays */}
      <CommandPalette />
    </div>
  )
}