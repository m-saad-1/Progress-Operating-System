import { Suspense, lazy, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/theme-provider';
import { ErrorBoundary } from '@/components/error-boundary';

import { database } from '@/lib/database';
import { useStore } from '@/store';
import { useDailyReset } from '@/hooks/use-daily-reset';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { useAppLifecycle } from '@/hooks/use-app-lifecycle';

// Layout
import { MainLayout } from '@/components/layouts/main-layout';

// Pages (lazy-loaded for faster startup and lower memory footprint)
const Dashboard = lazy(() => import('@/pages/dashboard'));
const Goals = lazy(() => import('@/pages/goals'));
const Tasks = lazy(() => import('@/pages/tasks'));
const Habits = lazy(() => import('@/pages/habits'));
const Notes = lazy(() => import('@/pages/notes'));
const Analytics = lazy(() => import('@/pages/analytics'));
const Settings = lazy(() => import('@/pages/settings'));
const Backup = lazy(() => import('@/pages/backup'));
const HelpSupport = lazy(() => import('./pages/help-support'));
const Time = lazy(() => import('@/pages/time'));
const Archive = lazy(() => import('@/pages/archive'));
const Reviews = lazy(() => import('@/pages/reviews'));

// Configure QueryClient with offline resilience and refetch settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Refetch on window focus (handles reload scenarios)
      refetchOnWindowFocus: true,
      // Refetch when connection is restored
      refetchOnReconnect: true,
      // Retry failed queries when back online
      retry: (failureCount, error) => {
        // Don't retry on explicit errors (e.g., 404)
        if (error instanceof Error && error.message.includes('not found')) {
          return false
        }
        // Retry up to 3 times for network errors
        return failureCount < 3
      },
      // Stale time: 0 means always refetch on mount/focus (ensures fresh data after reload)
      staleTime: 0,
      // Cache time: Keep data in cache for 5 minutes for offline access
      gcTime: 5 * 60 * 1000,
      // Network mode: Always fetch when online, use cache when offline
      networkMode: 'online',
    },
    mutations: {
      // Retry failed mutations when connection is restored
      retry: (failureCount, error) => {
        // Don't retry on explicit errors
        if (error instanceof Error && error.message.includes('not found')) {
          return false
        }
        // Retry up to 2 times for network errors
        return failureCount < 2
      },
      // Network mode: Allow mutations to queue when offline
      networkMode: 'online',
    },
  },
});

// Inner component that uses hooks requiring QueryClient
function AppContent() {
  const { setInitialData } = useStore();
  
  // Initialize daily reset hook for automatic midnight reset of continuous tasks
  useDailyReset();
  
  // Initialize online/offline detection and auto-refetch on reconnect
  useOnlineStatus();
  
  // Initialize app lifecycle management (reload, focus, visibility)
  useAppLifecycle();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tasks, habits, goals] = await Promise.all([
          database.getTasks(),
          database.getHabits(),
          database.getGoals(),
        ]);
        setInitialData({ tasks, habits, goals });
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
      }
    };

    fetchData();
  }, [setInitialData]);

  return (
    <ThemeProvider defaultTheme="light" storageKey="progress-os-theme-v1">
      <TooltipProvider>
        <Router>
          <div className="min-h-screen w-full bg-background text-foreground antialiased">
            <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}>
              <Routes>
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
              </Routes>
            </Suspense>
            <Toaster />
          </div>
        </Router>
      </TooltipProvider>
    </ThemeProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;