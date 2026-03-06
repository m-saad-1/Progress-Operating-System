# Offline-First Development Guide

This guide explains how to implement new features while maintaining the offline-first architecture.

## Core Principle

**All data operations must use the local SQLite database. Network operations are never required for core functionality.**

## Adding New Data Features

### Step 1: Define Database Schema

Add your table definition in `main/src/database/schema.ts`:

```typescript
export interface MyEntity {
  id: string
  title: string
  description: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  version: number
}
```

### Step 2: Create Database Methods

Add query methods in `main/src/database/index.ts`:

```typescript
// Get all entities
getAllEntities(): MyEntity[] {
  return this.db.prepare(`
    SELECT * FROM my_entities 
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
  `).all()
}

// Create entity
createEntity(data: any): string {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  
  this.db.prepare(`
    INSERT INTO my_entities (id, title, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, data.title, data.description, now, now)
  
  return id
}

// Update entity
updateEntity(id: string, updates: any): void {
  const now = new Date().toISOString()
  
  this.db.prepare(`
    UPDATE my_entities 
    SET title = ?, description = ?, updated_at = ?
    WHERE id = ?
  `).run(updates.title, updates.description, now, id)
}
```

### Step 3: Expose via IPC Handlers

Add IPC handlers in `main/src/ipc.ts`:

```typescript
ipcMain.handle('my-entity:getAll', async (event) => {
  try {
    const db = getDatabase()
    const entities = db.getAllEntities()
    return { success: true, data: entities }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('my-entity:create', async (event, data) => {
  try {
    const db = getDatabase()
    const id = db.createEntity(data)
    return { success: true, data: id }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
```

### Step 4: Expose Database Methods in Renderer

Add helper methods in `renderer/src/lib/database.ts`:

```typescript
export const database = {
  // Other methods...
  
  getAllEntities: async () => {
    return window.electron.ipcRenderer.invoke('my-entity:getAll')
      .then(result => {
        if (!result.success) throw new Error(result.error)
        return result.data
      })
  },
  
  createEntity: async (data: any) => {
    return window.electron.ipcRenderer.invoke('my-entity:create', data)
      .then(result => {
        if (!result.success) throw new Error(result.error)
        return result.data
      })
  },
  
  updateEntity: async (id: string, updates: any) => {
    return window.electron.ipcRenderer.invoke('my-entity:update', { id, updates })
      .then(result => {
        if (!result.success) throw new Error(result.error)
      })
  },
}
```

## Creating React Components

### ✅ Correct Pattern: Offline-First Mutations

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { database } from '@/lib/database'

export function MyEntityComponent() {
  const queryClient = useQueryClient()
  
  // Query loads data from local database
  const { data: entities } = useQuery({
    queryKey: ['my-entities'],
    queryFn: () => database.getAllEntities(),
    // Note: Uses local cache on reconnect, doesn't require network
  })
  
  // Mutation executes immediately offline
  const createMutation = useMutation({
    mutationFn: async (data) => {
      // This uses local database - no network required
      const id = await database.createEntity(data)
      const created = await database.getEntityById(id)
      return created
    },
    onSuccess: (newEntity) => {
      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['my-entities'] })
    },
    // Note: NO error handling for network - not needed for local operations
  })
  
  return (
    <button onClick={() => createMutation.mutate({ title: 'New' })}>
      Create {/* This works offline - no network needed */}
    </button>
  )
}
```

### ❌ Wrong Pattern: Checking Online Status

```typescript
// DON'T DO THIS
const isOnline = useOnlineStatus()

return (
  <button disabled={!isOnline}> {/* Never disable core features */}
    Create Entity
  </button>
)
```

### ❌ Wrong Pattern: Network API Calls

```typescript
// DON'T DO THIS
const createMutation = useMutation({
  mutationFn: async (data) => {
    // This requires internet - violates offline-first principle
    const response = await fetch('https://api.example.com/entities', {
      method: 'POST',
      body: JSON.stringify(data)
    })
    return response.json()
  },
})
```

## Handling Optional Features

### Pattern: External Sync/Feedback

For features that genuinely need network (feedback, sync), use the offline queue:

```typescript
import { useOfflineQueue } from '@/hooks/use-offline-queue'
import { useOnlineStatus } from '@/hooks/use-online-status'

export function FeedbackForm() {
  const isOnline = useOnlineStatus()
  const { addOperation } = useOfflineQueue()
  
  const submitFeedback = async (feedback: string) => {
    // Queue the operation - it will sync when online
    const operationId = addOperation('feedback-submit', {
      message: feedback,
      timestamp: new Date().toISOString(),
    })
    
    // Show appropriate message
    if (isOnline) {
      toast.success('Sending feedback...')
    } else {
      toast.info('Feedback will sync when you are online')
    }
  }
  
  return <button onClick={() => submitFeedback('...')}>Send</button>
}
```

## Error Handling

### ✅ Correct: Local Database Errors

```typescript
const createMutation = useMutation({
  mutationFn: async (data) => {
    // This might fail due to validation, disk full, etc.
    // But NOT because of network
    try {
      const id = await database.createTask(data)
      return id
    } catch (error) {
      // Handle local errors only (validation, disk space, etc.)
      if (error.message.includes('validation')) {
        throw new Error('Invalid task data')
      }
      throw error
    }
  },
  onError: (error) => {
    // Show local error - never network-related
    toast.error(error.message)
  },
})
```

### ❌ Wrong: Network Error Handling

```typescript
// DON'T DO THIS
const createMutation = useMutation({
  mutationFn: async (data) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(data)
      })
      return response.json()
    } catch (error) {
      // This is network error - violates offline-first!
      if (error.message.includes('network')) {
        throw new Error('Network error')
      }
    }
  },
})
```

## Configuration & Settings

### Offline Settings

Settings that should work offline:
- Theme preference
- View preferences
- User settings
- Keyboard shortcuts
- Display options

✅ These all persist locally!

### Optional Network Settings

Settings for optional features:
- Cloud sync provider
- API endpoints
- Feedback email/token

❌ These are optional - never required for core features!

## Query Configuration

All queries should use this pattern:

```typescript
// Good: Uses local cache, never blocks offline
useQuery({
  queryKey: ['my-entities'],
  queryFn: () => database.getEntities(),
  // These defaults are set globally in App.tsx:
  // networkMode: 'always'
  // staleTime: 1 hour
  // gcTime: Infinity
  // retry: false
})

// Bad: Times out or fails offline
useQuery({
  queryKey: ['my-entities'],
  queryFn: () => fetch('/api/entities').then(r => r.json()),
  // This will fail without network!
})
```

## Testing

### Testing Offline Behavior

```typescript
describe('MyEntity - Offline', () => {
  it('should create entity offline', async () => {
    // Disable network
    // window.navigator.onLine = false
    
    const task = await database.createEntity({
      title: 'Test'
    })
    
    expect(task).toBeDefined()
    expect(task.id).toBeDefined()
    // Should work without network!
  })
  
  it('should query entities offline', async () => {
    const entities = await database.getEntities()
    expect(entities).toBeArray()
    // Should return cached data!
  })
})
```

## Checklist for New Features

- [ ] All data operations use local database
- [ ] No API calls in core mutations
- [ ] Mutations never check `isOnline` status
- [ ] Queries use local cache
- [ ] Error messages don't mention network
- [ ] Feature works completely offline
- [ ] Optional network features use offline queue
- [ ] No timeouts for local operations
- [ ] Tests verify offline operation
- [ ] Documentation explains offline support

## File Structure Reference

```
main/src/database/
  ├── index.ts          ← Add database methods
  ├── schema.ts         ← Add entity types
  └── migrations/       ← Add schema migrations

main/src/
  └── ipc.ts            ← Add IPC handlers

renderer/src/lib/
  └── database.ts       ← Expose methods via window.electron

renderer/src/pages/
  └── my-feature.tsx    ← Use mutations + queries
```

## Troubleshooting

### Issue: Feature stops working offline
**Check:**
1. Are mutations using local database?
2. Is any code checking `isOnline`?
3. Are queries calling external APIs?
4. Is there a timeout for local operations?

### Issue: Network errors showing up
**Check:**
1. Remove any network-dependent code
2. Ensure all data uses local database
3. Check that mutations don't have retry with network checks

### Issue: It works online but not offline
**Check:**
1. Is the component checking online status?
2. Are queries trying to refetch from network?
3. Is there a fallback to cached data?
4. Does the database method exist and work locally?

## Summary

**Key Rules:**
1. ✅ Everything uses local SQLite database
2. ✅ Never block operations based on network
3. ✅ Optional features queue when offline
4. ✅ All error messages are local/app-related
5. ✅ App works perfectly without any internet

**Result:** A truly offline-first desktop application that works 100% locally and never depends on network connectivity.
