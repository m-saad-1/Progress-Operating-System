import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/theme-provider';
import { CommandPalette } from '@/components/command-palette';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';
import { ErrorBoundary } from '@/components/error-boundary';

// Layout
import { MainLayout } from '@/components/layouts/main-layout';

// Pages
import Dashboard from '@/pages/dashboard';
import Goals from '@/pages/goals';
import Tasks from '@/pages/tasks';
import Habits from '@/pages/habits';
import Notes from '@/pages/notes';
import Analytics from '@/pages/analytics';
import Settings from '@/pages/settings';
import Backup from '@/pages/backup';
import Time from '@/pages/time';
import Archive from '@/pages/archive';

// Store
import { useStore } from '@/store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light" storageKey="progress-os-theme-v1">
          <TooltipProvider>
            <Router>
             <div className="h-screen w-full bg-background text-foreground antialiased flex flex-col">
   {/* Remove overflow-hidden here if MainLayout handles it */}
                <KeyboardShortcuts />
                <CommandPalette />
                
                <Routes>
                  <Route element={<MainLayout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/goals" element={<Goals />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/habits" element={<Habits />} />
                    <Route path="/notes" element={<Notes />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/backup" element={<Backup />} />
                    <Route path="/time" element={<Time />} />
                    <Route path="/archive" element={<Archive />} />
                  </Route>
                </Routes>
                
                <Toaster />
              </div>
            </Router>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;