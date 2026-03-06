# Offline-First Architecture

## Overview

This application is designed as a **100% offline-first desktop application**. All core functionality operates entirely using local storage (SQLite database) and requires **zero network connectivity** to function. The application never blocks user interactions or core operations based on network status.

## Core Principles

### 1. **All Core Operations Are Local-First**

Core functionality includes:
- ✅ Task management (create, update, complete, track progress)
- ✅ Habit tracking (mark completions, view streaks, analytics)
- ✅ Goals management (create, track progress, update)
- ✅ Notes (create, edit, search, organize)
- ✅ Analytics (all calculations, charts, trends)
- ✅ Time tracking (logs, analysis)
- ✅ Backups (local backups to disk)

**All these features work 100% offline using the local SQLite database.**

### 2. **Network Operations Are Optional Only**

Optional features that MAY use the network:
- Feedback submission (will queue if offline, sync when online)
- Cloud sync (if configured - completely optional)
- External integrations (completely optional)

**These features NEVER block core functionality or display network errors to interrupt workflow.**

### 3. **React Query Configuration**

The QueryClient is configured with:

```typescript
networkMode: 'always'  // Mutations and queries execute offline
retry: false           // Don't retry network-dependent operations
staleTime: 1 hour      // Keep data fresh in cache
gcTime: Infinity       // Never clear cache (enables offline access)
```

This ensures:
- Mutations (task updates, habit completions) execute immediately
- Queries use cached local data
- No network checks block operations
- Cache persists indefinitely for offline access

## Database Layer

### Main Process (SQLite)

Located in: `main/src/database/index.ts`

- Uses `better-sqlite3` for fast, synchronous database access
- Encrypts sensitive data at rest
- Stores all application data locally
- No external database connections

### Renderer Process (IPC)

Located in: `renderer/src/lib/database.ts`

- Communicates with main process via IPC
- All mutations bypass the network entirely
- Direct local database access
- No timeouts or network dependencies

### Data Persistence

All data is stored in:
```
~/.config/progress-os/progress.db  (or equivalent user data directory)
```

This includes:
- Tasks with daily progress history
- Habit completions and streaks
- Goals and projects
- Notes with full content
- Analytics snapshots
- User preferences
- Backups metadata

## Online Status Handling

### `use-online-status` Hook

This hook **only tracks network status for UI/informational purposes**. It:
- ❌ Does NOT block mutations
- ❌ Does NOT prevent task/habit/goal operations
- ❌ Does NOT refetch queries on reconnection
- ✅ Allows feedback to queue when offline
- ✅ Enables sync features to trigger when online

### Usage

```typescript
const isOnline = useOnlineStatus()

// Correct: Use only for optional features
if (isOnline && feedbackQueueLength > 0) {
  processFeedbackQueue()
}

// WRONG: Never use to disable core operations
if (!isOnline) {
  // Don't do this!
  disableTaskUpdates()
}
```

## Offline Queue

Located in: `renderer/src/hooks/use-offline-queue.ts`

**This is ONLY for optional features (feedback, sync).** It:
- Queues feedback submissions when offline
- Queues sync operations when offline
- Automatically retries when online
- Persists to localStorage for recovery

**Core operations (tasks, habits, goals, notes) NEVER use this queue.**

## Error Handling

### When Network Is Unavailable

1. **Core operations**: Continue normally, use local database
2. **Status indicator**: Show "Offline" in UI (informational only)
3. **Optional features**: Queue operations silently
4. **User experience**: Zero interruption to workflow

### When System Wakes From Sleep

- All cached data is immediately available
- No network check delays initialization
- Queries execute on local database
- Optional features attempt sync in background

## Verifying Offline-First Behavior

### Quick Test: Disconnect Internet

1. Close network connection
2. Try all core operations:
   - ✅ Create a task
   - ✅ Update task progress (marks complete at 100%)
   - ✅ Create a habit
   - ✅ Mark habit as complete
   - ✅ Write a note
   - ✅ Create/update a goal
   - ✅ View analytics and charts
   - ✅ Check productivity stats
3. All should work instantly with no errors
4. Reconnect internet - everything continues normally

### Key Files to Monitor

If you make changes to the following files, ensure offline-first behavior is preserved:

#### ❌ Never add network checks
- `renderer/src/pages/tasks.tsx` - mutation functions
- `renderer/src/pages/habits.tsx` - mutation functions
- `renderer/src/pages/goals.tsx` - mutation functions
- `renderer/src/pages/notes.tsx` - mutation functions
- `renderer/src/components/habit-tracker.tsx` - completion handler

#### ✅ Optional: Add network checks only for optional features
- `renderer/src/pages/help-support.tsx` - feedback submission
- `renderer/src/pages/settings.tsx` - sync configuration
- `renderer/src/components/sync-manager.tsx` - cloud sync

## Implementation Checklist

When adding new features, ensure:

- [ ] All data operations use local database
- [ ] Mutations never check `isOnline` status
- [ ] Queries use cache-first strategy
- [ ] Optional features queue when offline
- [ ] Error messages never mention network
- [ ] UI never disables core features offline
- [ ] Tests verify offline operation
- [ ] No external API calls in core logic

## FAQ

### Q: Can I use this app without internet?
**A:** Yes! 100% of core functionality works completely offline. Internet is never required.

### Q: What happens if internet disconnects mid-session?
**A:** The app continues working normally. All user interactions with tasks, habits, goals, and notes continue seamlessly using local data.

### Q: What about feedback/sync without internet?
**A:** Feedback and sync operations queue automatically and process when internet is restored. Users see no errors or disruption.

### Q: How is data backed up?
**A:** Backups are saved to local disk. Users can manually backup to external drives or configure backup locations.

### Q: Can I sync my data across devices?
**A:** Optional: Cloud sync can be configured (Supabase, Firebase, or custom). But core app works perfectly without it.

### Q: What if my internet is slow/unreliable?
**A:** No impact. The app doesn't depend on network speed. All operations use local data.

## Support

For offline-first related questions or issues, refer to:
- Database layer: `main/src/database/`
- Query configuration: `renderer/src/App.tsx` (QueryClient)
- Online detection: `renderer/src/hooks/use-online-status.ts`
- Offline queuing: `renderer/src/hooks/use-offline-queue.ts`
