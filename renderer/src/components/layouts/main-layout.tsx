import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { CommandPalette } from '@/components/command-palette'
import { cn } from '@/lib/utils'
import { FloatingTimerCard } from '@/components/floating-timer-card'
import { useSharedTimer } from '@/hooks/use-shared-timer'
import { useAppRuntime } from '@/hooks/use-app-runtime'

export function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const location = useLocation()
  const mainScrollRef = useRef<HTMLElement | null>(null)
  const { timerMode, timerRunning, elapsedMs } = useSharedTimer()

  useAppRuntime()

  const onTimeTab = location.pathname === '/time'
  const shouldShowFloatingTimer = !onTimeTab && timerMode !== null && (timerRunning || elapsedMs > 0)

  useEffect(() => {
    const onToggle = () => setSidebarCollapsed((prev) => !prev)
    window.addEventListener('app:toggle-sidebar', onToggle as EventListener)
    return () => window.removeEventListener('app:toggle-sidebar', onToggle as EventListener)
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      mainScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    })

    return () => cancelAnimationFrame(frame)
  }, [location.pathname, location.search, location.key])

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
          "flex-1 flex flex-col min-w-0 overflow-hidden transition-[padding-left] duration-300 ease-out will-change-[padding-left]",
          sidebarCollapsed ? 'pl-14' : 'pl-48'
        )}>
          {/* Header */}
          <Header 
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          />

          {/* Main Content Area */}
          <main ref={mainScrollRef} className="flex-1 overflow-auto bg-muted/30 text-foreground dark:bg-background">
            <div className="container mx-auto p-6 min-h-full">
              <Outlet />
            </div>
          </main>

          {/* Footer */}
          <footer className="z-10 bg-green-100/80 supports-[backdrop-filter]:bg-green-100/80 dark:bg-zinc-800/95 px-6 py-3 text-xs text-muted-foreground flex items-center justify-between shadow-[0_-2px_10px_rgba(0,0,0,0.15)] dark:shadow-[0_-2px_15px_rgba(0,0,0,0.40)]">
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
      {shouldShowFloatingTimer && <FloatingTimerCard />}
    </div>
  )
}