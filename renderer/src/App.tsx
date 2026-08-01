import { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/theme-provider';
import { ErrorBoundary } from '@/components/error-boundary';
import { database } from '@/lib/database';
import { useDailyReset } from '@/hooks/use-daily-reset';
import { useAppLifecycle } from '@/hooks/use-app-lifecycle';
import type { Task, Habit, Goal } from '@/types';

import { useStore } from '@/store';

// Layout
import { MainLayout } from '@/components/layouts/main-layout';

// Lazy loaded routes for faster initial load and code splitting
import React from 'react';
const Dashboard = React.lazy(() => import('@/pages/dashboard'));
const Goals = React.lazy(() => import('@/pages/goals'));
const Tasks = React.lazy(() => import('@/pages/tasks'));
const Habits = React.lazy(() => import('@/pages/habits'));
const Notes = React.lazy(() => import('@/pages/notes'));
const Analytics = React.lazy(() => import('@/pages/analytics'));
const Settings = React.lazy(() => import('@/pages/settings'));
const Backup = React.lazy(() => import('@/pages/backup'));
const HelpSupport = React.lazy(() => import('./pages/help-support'));
const Time = React.lazy(() => import('@/pages/time'));
const Archive = React.lazy(() => import('@/pages/archive'));
const Reviews = React.lazy(() => import('@/pages/reviews'));

// Configure QueryClient with offline-first resilience
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnReconnect: false,
      retry: false,
      staleTime: 1000 * 60 * 60,
      gcTime: Infinity,
      networkMode: 'always',
    },
    mutations: {
      retry: false,
      networkMode: 'always',
    },
  },
});

// Loading overlay
function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen w-screen bg-background">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
        <p className="text-foreground text-sm">Initializing Progress OS...</p>
      </div>
    </div>
  );
}

// Main app content - only rendered after initialization
function AppContent() {
  const { setInitialData } = useStore();

  // Keep store in sync and ensure day transitions are processed.
  useAppLifecycle();
  useDailyReset();

  useEffect(() => {
    let isMounted = true;

    const initializeApp = async () => {
      try {
        console.log('[APP] Initializing app content');
        const runtimeApi = (window as any).__TAURI_INTERNALS__;
        
        if (!runtimeApi) {
          throw new Error('Critical Error: Tauri Native API is not available. The application cannot run without the backend environment.');
        }

        const [tasks, habits, goals] = await Promise.all([
          database.getTasks(),
          database.getHabits(),
          database.getGoals(),
        ]);

        if (isMounted) {
          setInitialData({
            tasks: tasks as unknown as Task[],
            habits: habits as unknown as Habit[],
            goals: goals as unknown as Goal[],
          });
          console.log('[APP] Initial data hydrated:', {
            tasks: tasks.length,
            habits: habits.length,
            goals: goals.length,
          });
        }

        console.log('[APP] Desktop API available, app content ready');
      } catch (error) {
        console.error('[APP] Error in app initialization:', error);
      }
    };

    initializeApp().catch(console.error);

    return () => {
      isMounted = false;
    };
  }, [setInitialData]);

  return (
    <ThemeProvider defaultTheme="light" storageKey="progress-os-theme-v1">
      <TooltipProvider>
        <Router>
          <div className="min-h-screen w-full bg-background text-foreground antialiased">
            <React.Suspense fallback={<LoadingScreen />}><Routes>
              <Route element={<MainLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/goals" element={<Goals />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/habits" element={<Habits />} />
                <Route path="/notes" element={<Notes />} />
                <Route path="/reviews" element={<Reviews />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/backup" element={<Backup />} />
                <Route path="/help-support" element={<HelpSupport />} />
                <Route path="/time" element={<Time />} />
                <Route path="/archive" element={<Archive />} />
              </Route>
            </Routes></React.Suspense>
            <Toaster />
          </div>
        </Router>
      </TooltipProvider>
    </ThemeProvider>
  );
}

// Root component with initialization control
function AppInitializer() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    console.log('[APP] Initializer: checking for Electron API');
    
    // Wait for Electron API to be available (with timeout)
    const maxWait = 5000; // 5 second timeout
    const startTime = Date.now();
    
    const checkApi = setInterval(() => {
      const elapsed = Date.now() - startTime;
      
      const runtimeApi = (window as any).__TAURI_INTERNALS__;
      if (runtimeApi) {
        console.log('[APP] Initializer: Desktop API available, ready to render');
        clearInterval(checkApi);
        setIsReady(true);
      } else if (elapsed > maxWait) {
        console.warn('[APP] Initializer: Desktop API not available after timeout, proceeding anyway');
        clearInterval(checkApi);
        setIsReady(true);
      }
    }, 100);

    return () => clearInterval(checkApi);
  }, []);

  if (!isReady) {
    return <LoadingScreen />;
  }

  return <AppContent />;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppInitializer />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

