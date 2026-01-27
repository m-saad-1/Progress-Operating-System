// This file provides utilities for working with the Electron API
import { useState, useEffect } from 'react'

// Types for Electron API
interface ElectronAPI {
  // Database operations
  executeQuery: (query: string, params?: any[]) => Promise<any>
  executeTransaction: (operations: Array<{query: string, params?: any[]}>) => Promise<any>
  
  // Backup operations
  createBackup: () => Promise<string>
  restoreBackup: (backupId: string) => Promise<boolean>
  listBackups: () => Promise<any[]>
  
  // File operations
  selectFile: (options: any) => Promise<string | null>
  saveFile: (options: any) => Promise<string | null>
  
  // System operations
  getAppPath: (name: string) => Promise<string>
  getPlatform: () => string
  
  // Sync operations
  syncStart: () => Promise<void>
  syncStop: () => Promise<void>
  getSyncStatus: () => Promise<any>
  
  // Undo/Redo
  undo: () => Promise<boolean>
  redo: () => Promise<boolean>
  getUndoStack: () => Promise<any>
  
  // Events
  onSyncUpdate: (callback: (event: any, status: any) => void) => void
  onBackupCreated: (callback: (event: any, backup: any) => void) => void
  onDatabaseError: (callback: (event: any, error: any) => void) => void
  
  // Remove listeners
  removeSyncUpdate: (callback: (event: any, status: any) => void) => void
  removeBackupCreated: (callback: (event: any, backup: any) => void) => void
  removeDatabaseError: (callback: (event: any, error: any) => void) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

// Check if running in Electron
export const isElectron = () => {
  return typeof window !== 'undefined' && !!window.electronAPI
}

// Hook to check if Electron API is available
export const useElectronReady = () => {
  const [isReady, setIsReady] = useState(false)
  
  useEffect(() => {
    const checkElectron = () => {
      const electronAvailable = isElectron()
      setIsReady(electronAvailable)
      
      if (!electronAvailable) {
        console.warn('Electron API not available. Running in development mode.')
      }
    }
    
    checkElectron()
    
    // Check again after a short delay in case API loads later
    const timeout = setTimeout(checkElectron, 1000)
    
    return () => clearTimeout(timeout)
  }, [])
  
  return isReady
}

// Safe wrapper for Electron API calls
export const safeElectronCall = async <T>(
  fn: () => Promise<T>,
  fallback?: T
): Promise<T> => {
  try {
    if (!isElectron()) {
      throw new Error('Electron API not available')
    }
    return await fn()
  } catch (error) {
    console.error('Electron API call failed:', error)
    
    if (fallback !== undefined) {
      return fallback
    }
    
    throw error
  }
}

// Hook to use Electron API
export const useElectron = () => {
  const isReady = useElectronReady()
  
  return {
    isReady,
    executeQuery: async (query: string, params?: any[]) => {
      return safeElectronCall(async () => {
        return window.electronAPI.executeQuery(query, params)
      }, [])
    },
    executeTransaction: async (operations: Array<{query: string, params?: any[]}>) => {
      return safeElectronCall(async () => {
        return window.electronAPI.executeTransaction(operations)
      })
    },
    createBackup: async () => {
      return safeElectronCall(async () => {
        return window.electronAPI.createBackup()
      }, '')
    },
    restoreBackup: async (backupId: string) => {
      return safeElectronCall(async () => {
        return window.electronAPI.restoreBackup(backupId)
      }, false)
    },
    listBackups: async () => {
      return safeElectronCall(async () => {
        return window.electronAPI.listBackups()
      }, [])
    },
    selectFile: async (options: any) => {
      return safeElectronCall(async () => {
        return window.electronAPI.selectFile(options)
      }, null)
    },
    saveFile: async (options: any) => {
      return safeElectronCall(async () => {
        return window.electronAPI.saveFile(options)
      }, null)
    },
    getAppPath: async (name: string) => {
      return safeElectronCall(async () => {
        return window.electronAPI.getAppPath(name)
      }, '')
    },
    getPlatform: () => {
      if (!isElectron()) return 'web'
      try {
        return window.electronAPI.getPlatform()
      } catch {
        return 'unknown'
      }
    },
    syncStart: async () => {
      return safeElectronCall(async () => {
        return window.electronAPI.syncStart()
      })
    },
    syncStop: async () => {
      return safeElectronCall(async () => {
        return window.electronAPI.syncStop()
      })
    },
    getSyncStatus: async () => {
      return safeElectronCall(async () => {
        return window.electronAPI.getSyncStatus()
      }, { status: 'idle' })
    },
    undo: async () => {
      return safeElectronCall(async () => {
        return window.electronAPI.undo()
      }, false)
    },
    redo: async () => {
      return safeElectronCall(async () => {
        return window.electronAPI.redo()
      }, false)
    },
    getUndoStack: async () => {
      return safeElectronCall(async () => {
        return window.electronAPI.getUndoStack()
      }, { canUndo: false, canRedo: false, undoStack: [], redoStack: [] })
    },
    onSyncUpdate: (callback: (status: any) => void) => {
      if (!isElectron()) return () => {}
      const handler = (event: any, status: any) => callback(status)
      window.electronAPI.onSyncUpdate(handler)
      return () => window.electronAPI.removeSyncUpdate(handler)
    },
    onBackupCreated: (callback: (backup: any) => void) => {
      if (!isElectron()) return () => {}
      const handler = (event: any, backup: any) => callback(backup)
      window.electronAPI.onBackupCreated(handler)
      return () => window.electronAPI.removeBackupCreated(handler)
    },
    onDatabaseError: (callback: (error: any) => void) => {
      if (!isElectron()) return () => {}
      const handler = (event: any, error: any) => callback(error)
      window.electronAPI.onDatabaseError(handler)
      return () => window.electronAPI.removeDatabaseError(handler)
    },
  }
}

// Common database operations
export const db = {
  // Goals
  getGoals: async (filters?: any) => {
    return safeElectronCall(async () => {
      let query = 'SELECT * FROM goals WHERE deleted_at IS NULL'
      const params: any[] = []
      
      if (filters) {
        const conditions = []
        if (filters.status) {
          conditions.push('status = ?')
          params.push(filters.status)
        }
        if (filters.category) {
          conditions.push('category = ?')
          params.push(filters.category)
        }
        if (filters.priority) {
          conditions.push('priority = ?')
          params.push(filters.priority)
        }
        
        if (conditions.length > 0) {
          query += ' AND ' + conditions.join(' AND ')
        }
      }
      
      query += ' ORDER BY updated_at DESC'
      
      return window.electronAPI.executeQuery(query, params)
    }, [])
  },
  
  getGoalById: async (id: string) => {
    return safeElectronCall(async () => {
      const result = await window.electronAPI.executeQuery(
        'SELECT * FROM goals WHERE id = ? AND deleted_at IS NULL',
        [id]
      )
      return result[0] || null
    }, null)
  },
  
  // Tasks
  getTasks: async (filters?: any) => {
    return safeElectronCall(async () => {
      let query = `
        SELECT t.*, g.title as goal_title
        FROM tasks t
        LEFT JOIN goals g ON t.goal_id = g.id
        WHERE t.deleted_at IS NULL
      `
      const params: any[] = []
      
      if (filters) {
        const conditions = []
        if (filters.status) {
          conditions.push('t.status = ?')
          params.push(filters.status)
        }
        if (filters.priority) {
          conditions.push('t.priority = ?')
          params.push(filters.priority)
        }
        if (filters.dueDate) {
          conditions.push('t.due_date = ?')
          params.push(filters.dueDate)
        }
        if (filters.goalId) {
          conditions.push('t.goal_id = ?')
          params.push(filters.goalId)
        }
        
        if (conditions.length > 0) {
          query += ' AND ' + conditions.join(' AND ')
        }
      }
      
      query += ' ORDER BY t.priority DESC, t.due_date ASC'
      
      return window.electronAPI.executeQuery(query, params)
    }, [])
  },
  
  getTaskById: async (id: string) => {
    return safeElectronCall(async () => {
      const result = await window.electronAPI.executeQuery(
        `SELECT t.*, g.title as goal_title 
         FROM tasks t 
         LEFT JOIN goals g ON t.goal_id = g.id 
         WHERE t.id = ? AND t.deleted_at IS NULL`,
        [id]
      )
      return result[0] || null
    }, null)
  },
  
  // Habits
  getHabits: async (filters?: any) => {
    return safeElectronCall(async () => {
      let query = `
        SELECT h.*, g.title as goal_title
        FROM habits h
        LEFT JOIN goals g ON h.goal_id = g.id
        WHERE h.deleted_at IS NULL
      `
      const params: any[] = []
      
      if (filters) {
        const conditions = []
        if (filters.frequency) {
          conditions.push('h.frequency = ?')
          params.push(filters.frequency)
        }
        if (filters.goalId) {
          conditions.push('h.goal_id = ?')
          params.push(filters.goalId)
        }
        
        if (conditions.length > 0) {
          query += ' AND ' + conditions.join(' AND ')
        }
      }
      
      query += ' ORDER BY h.streak_current DESC, h.consistency_score DESC'
      
      return window.electronAPI.executeQuery(query, params)
    }, [])
  },
  
  getHabitById: async (id: string) => {
    return safeElectronCall(async () => {
      const result = await window.electronAPI.executeQuery(
        `SELECT h.*, g.title as goal_title 
         FROM habits h 
         LEFT JOIN goals g ON h.goal_id = g.id 
         WHERE h.id = ? AND h.deleted_at IS NULL`,
        [id]
      )
      return result[0] || null
    }, null)
  },
  
  // Notes
  getNotes: async (filters?: any) => {
    return safeElectronCall(async () => {
      let query = `
        SELECT n.*, g.title as goal_title, t.title as task_title
        FROM notes n
        LEFT JOIN goals g ON n.goal_id = g.id
        LEFT JOIN tasks t ON n.task_id = t.id
        WHERE n.deleted_at IS NULL
      `
      const params: any[] = []
      
      if (filters) {
        const conditions = []
        if (filters.type) {
          conditions.push('n.type = ?')
          params.push(filters.type)
        }
        if (filters.goalId) {
          conditions.push('n.goal_id = ?')
          params.push(filters.goalId)
        }
        if (filters.taskId) {
          conditions.push('n.task_id = ?')
          params.push(filters.taskId)
        }
        
        if (conditions.length > 0) {
          query += ' AND ' + conditions.join(' AND ')
        }
      }
      
      query += ' ORDER BY n.updated_at DESC'
      
      return window.electronAPI.executeQuery(query, params)
    }, [])
  },
  
  getNoteById: async (id: string) => {
    return safeElectronCall(async () => {
      const result = await window.electronAPI.executeQuery(
        `SELECT n.*, g.title as goal_title, t.title as task_title 
         FROM notes n 
         LEFT JOIN goals g ON n.goal_id = g.id 
         LEFT JOIN tasks t ON n.task_id = t.id 
         WHERE n.id = ? AND n.deleted_at IS NULL`,
        [id]
      )
      return result[0] || null
    }, null)
  },
  
  // Time Blocks
  getTimeBlocks: async (filters?: any) => {
    return safeElectronCall(async () => {
      let query = `
        SELECT tb.*, t.title as task_title, h.title as habit_title
        FROM time_blocks tb
        LEFT JOIN tasks t ON tb.task_id = t.id
        LEFT JOIN habits h ON tb.habit_id = h.id
        WHERE tb.deleted_at IS NULL
      `
      const params: any[] = []
      
      if (filters) {
        const conditions = []
        if (filters.startDate) {
          conditions.push('tb.start_time >= ?')
          params.push(filters.startDate)
        }
        if (filters.endDate) {
          conditions.push('tb.start_time <= ?')
          params.push(filters.endDate)
        }
        if (filters.taskId) {
          conditions.push('tb.task_id = ?')
          params.push(filters.taskId)
        }
        if (filters.habitId) {
          conditions.push('tb.habit_id = ?')
          params.push(filters.habitId)
        }
        
        if (conditions.length > 0) {
          query += ' AND ' + conditions.join(' AND ')
        }
      }
      
      query += ' ORDER BY tb.start_time DESC'
      
      return window.electronAPI.executeQuery(query, params)
    }, [])
  },
  
  // Dashboard Statistics
  getDashboardStats: async () => {
    return safeElectronCall(async () => {
      const today = new Date()
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString()
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString()
      const todayDate = new Date().toISOString().split('T')[0]
      
      const queries = [
        // Today's tasks
        {
          query: `
            SELECT COUNT(*) as today_tasks
            FROM tasks 
            WHERE due_date BETWEEN ? AND ?
            AND status != 'completed'
            AND deleted_at IS NULL
          `,
          params: [startOfDay, endOfDay]
        },
        // Active goals
        {
          query: `
            SELECT COUNT(*) as active_goals,
                   AVG(progress) as avg_progress
            FROM goals 
            WHERE status = 'active'
            AND deleted_at IS NULL
          `,
          params: []
        },
        // Habit completions today
        {
          query: `
            SELECT COUNT(*) as completed_habits
            FROM habit_completions hc
            JOIN habits h ON hc.habit_id = h.id
            WHERE hc.date = ?
            AND hc.completed = 1
            AND h.deleted_at IS NULL
          `,
          params: [todayDate]
        },
        // Time tracked today
        {
          query: `
            SELECT SUM(duration) as focus_time_today
            FROM time_blocks 
            WHERE start_time BETWEEN ? AND ?
            AND deleted_at IS NULL
          `,
          params: [startOfDay, endOfDay]
        }
      ]
      
      const results = await Promise.all(
        queries.map(q => window.electronAPI.executeQuery(q.query, q.params))
      )
      
      return {
        today_tasks: results[0][0]?.today_tasks || 0,
        active_goals: results[1][0]?.active_goals || 0,
        avg_progress: results[1][0]?.avg_progress || 0,
        completed_habits: results[2][0]?.completed_habits || 0,
        focus_time_today: results[3][0]?.focus_time_today || 0,
      }
    }, {
      today_tasks: 0,
      active_goals: 0,
      avg_progress: 0,
      completed_habits: 0,
      focus_time_today: 0,
    })
  },
  
  // Get today's tasks
  getTodaysTasks: async () => {
    return safeElectronCall(async () => {
      const today = new Date()
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString()
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString()
      
      return window.electronAPI.executeQuery(`
        SELECT t.*, g.title as goal_title
        FROM tasks t
        LEFT JOIN goals g ON t.goal_id = g.id
        WHERE t.due_date BETWEEN ? AND ?
        AND t.status != 'completed'
        AND t.deleted_at IS NULL
        ORDER BY t.priority DESC, t.due_date ASC
      `, [startOfDay, endOfDay])
    }, [])
  },
  
  // Get today's habits
  getTodaysHabits: async () => {
    return safeElectronCall(async () => {
      const today = new Date()
      const todayDate = today.toISOString().split('T')[0]
      const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
      
      return window.electronAPI.executeQuery(`
        SELECT h.*, 
               (SELECT completed FROM habit_completions 
                WHERE habit_id = h.id AND date = ?) as today_completed
        FROM habits h
        WHERE h.deleted_at IS NULL
        AND (
          h.frequency = 'daily' OR
          (h.frequency = 'weekly' AND ? IN (SELECT value FROM json_each(h.schedule))) OR
          (h.frequency = 'monthly' AND ? = CAST(SUBSTR(h.schedule, 2, LENGTH(h.schedule)-2) AS INTEGER))
        )
      `, [todayDate, dayOfWeek, today.getDate()])
    }, [])
  },
  
  // Create operations
  createGoal: async (goalData: any) => {
    return safeElectronCall(async () => {
      const goalId = crypto.randomUUID()
      const now = new Date().toISOString()
      
      const operations = [{
        query: `
          INSERT INTO goals (
            id, title, description, category, priority, status, 
            start_date, target_date, motivation, review_frequency, 
            progress_method, progress, tags, created_at, updated_at, version
          ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, 0, ?, ?, ?, 1)
        `,
        params: [
          goalId,
          goalData.title,
          goalData.description || '',
          goalData.category || 'personal',
          goalData.priority || 'medium',
          now,
          goalData.target_date || null,
          goalData.motivation || '',
          goalData.review_frequency || 'weekly',
          goalData.progress_method || 'manual',
          JSON.stringify(goalData.tags || []),
          now,
          now,
        ]
      }]
      
      await window.electronAPI.executeTransaction(operations)
      return goalId
    })
  },
  
  createTask: async (taskData: any) => {
    return safeElectronCall(async () => {
      const taskId = crypto.randomUUID()
      const now = new Date().toISOString()
      
      const operations = [{
        query: `
          INSERT INTO tasks (
            id, title, description, due_date, priority, status, progress,
            estimated_time, actual_time, goal_id, tags, created_at, updated_at, version
          ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, NULL, ?, ?, ?, ?, 1)
        `,
        params: [
          taskId,
          taskData.title,
          taskData.description || '',
          taskData.due_date || null,
          taskData.priority || 'medium',
          taskData.status || 'pending',
          taskData.estimated_time || null,
          taskData.goal_id || null,
          JSON.stringify(taskData.tags || []),
          now,
          now,
        ]
      }]
      
      await window.electronAPI.executeTransaction(operations)
      return taskId
    })
  },
  
  createHabit: async (habitData: any) => {
    return safeElectronCall(async () => {
      const habitId = crypto.randomUUID()
      const now = new Date().toISOString()
      
      const operations = [{
        query: `
          INSERT INTO habits (
            id, title, description, frequency, schedule, goal_id,
            streak_current, streak_longest, consistency_score,
            created_at, updated_at, version
          ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, 1)
        `,
        params: [
          habitId,
          habitData.title,
          habitData.description || '',
          habitData.frequency || 'daily',
          JSON.stringify(habitData.schedule || []),
          habitData.goal_id || null,
          now,
          now,
        ]
      }]
      
      await window.electronAPI.executeTransaction(operations)
      return habitId
    })
  },
  
  createNote: async (noteData: any) => {
    return safeElectronCall(async () => {
      const noteId = crypto.randomUUID()
      const now = new Date().toISOString()
      
      const operations = [{
        query: `
          INSERT INTO notes (
            id, title, content, type, mood, goal_id, task_id, tags,
            created_at, updated_at, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `,
        params: [
          noteId,
          noteData.title,
          noteData.content || '',
          noteData.type || 'free',
          noteData.mood || null,
          noteData.goal_id || null,
          noteData.task_id || null,
          JSON.stringify(noteData.tags || []),
          now,
          now,
        ]
      }]
      
      await window.electronAPI.executeTransaction(operations)
      return noteId
    })
  },
  
  createTimeBlock: async (timeBlockData: any) => {
    return safeElectronCall(async () => {
      const timeBlockId = crypto.randomUUID()
      const now = new Date().toISOString()
      
      const operations = [{
        query: `
          INSERT INTO time_blocks (
            id, task_id, habit_id, start_time, end_time, duration, notes,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        params: [
          timeBlockId,
          timeBlockData.task_id || null,
          timeBlockData.habit_id || null,
          timeBlockData.start_time,
          timeBlockData.end_time,
          timeBlockData.duration,
          timeBlockData.notes || null,
          now,
          now,
        ]
      }]
      
      await window.electronAPI.executeTransaction(operations)
      return timeBlockId
    })
  },
  
  // Update operations
  updateGoal: async (id: string, updates: any) => {
    return safeElectronCall(async () => {
      const operations = [{
        query: `
          UPDATE goals 
          SET title = ?, description = ?, category = ?, priority = ?, status = ?,
              target_date = ?, motivation = ?, review_frequency = ?, 
              progress_method = ?, progress = ?, tags = ?, updated_at = ?, version = version + 1
          WHERE id = ?
        `,
        params: [
          updates.title,
          updates.description,
          updates.category,
          updates.priority,
          updates.status,
          updates.target_date,
          updates.motivation,
          updates.review_frequency,
          updates.progress_method,
          updates.progress || 0,
          JSON.stringify(updates.tags || []),
          new Date().toISOString(),
          id,
        ]
      }]
      
      return window.electronAPI.executeTransaction(operations)
    })
  },
  
  updateTask: async (id: string, updates: any) => {
    return safeElectronCall(async () => {
      const operations = [{
        query: `
          UPDATE tasks 
          SET title = ?, description = ?, due_date = ?, priority = ?, status = ?,
              progress = ?, estimated_time = ?, actual_time = ?, goal_id = ?, 
              tags = ?, updated_at = ?, version = version + 1
          WHERE id = ?
        `,
        params: [
          updates.title,
          updates.description,
          updates.due_date,
          updates.priority,
          updates.status,
          updates.progress || 0,
          updates.estimated_time,
          updates.actual_time,
          updates.goal_id,
          JSON.stringify(updates.tags || []),
          new Date().toISOString(),
          id,
        ]
      }]
      
      return window.electronAPI.executeTransaction(operations)
    })
  },
  
  updateHabit: async (id: string, updates: any) => {
    return safeElectronCall(async () => {
      const operations = [{
        query: `
          UPDATE habits 
          SET title = ?, description = ?, frequency = ?, schedule = ?, goal_id = ?,
              streak_current = ?, streak_longest = ?, consistency_score = ?,
              updated_at = ?, version = version + 1
          WHERE id = ?
        `,
        params: [
          updates.title,
          updates.description,
          updates.frequency,
          JSON.stringify(updates.schedule || []),
          updates.goal_id,
          updates.streak_current || 0,
          updates.streak_longest || 0,
          updates.consistency_score || 0,
          new Date().toISOString(),
          id,
        ]
      }]
      
      return window.electronAPI.executeTransaction(operations)
    })
  },
  
  updateNote: async (id: string, updates: any) => {
    return safeElectronCall(async () => {
      const operations = [{
        query: `
          UPDATE notes 
          SET title = ?, content = ?, type = ?, mood = ?, 
              goal_id = ?, task_id = ?, tags = ?, updated_at = ?, version = version + 1
          WHERE id = ?
        `,
        params: [
          updates.title,
          updates.content,
          updates.type,
          updates.mood,
          updates.goal_id,
          updates.task_id,
          JSON.stringify(updates.tags || []),
          new Date().toISOString(),
          id,
        ]
      }]
      
      return window.electronAPI.executeTransaction(operations)
    })
  },
  
  // Delete operations (soft delete)
  deleteGoal: async (id: string) => {
    return safeElectronCall(async () => {
      const operations = [{
        query: `
          UPDATE goals 
          SET deleted_at = ?, updated_at = ?, version = version + 1
          WHERE id = ?
        `,
        params: [new Date().toISOString(), new Date().toISOString(), id]
      }]
      
      return window.electronAPI.executeTransaction(operations)
    })
  },
  
  deleteTask: async (id: string) => {
    return safeElectronCall(async () => {
      const operations = [{
        query: `
          UPDATE tasks 
          SET deleted_at = ?, updated_at = ?, version = version + 1
          WHERE id = ?
        `,
        params: [new Date().toISOString(), new Date().toISOString(), id]
      }]
      
      return window.electronAPI.executeTransaction(operations)
    })
  },
  
  deleteHabit: async (id: string) => {
    return safeElectronCall(async () => {
      const operations = [{
        query: `
          UPDATE habits 
          SET deleted_at = ?, updated_at = ?, version = version + 1
          WHERE id = ?
        `,
        params: [new Date().toISOString(), new Date().toISOString(), id]
      }]
      
      return window.electronAPI.executeTransaction(operations)
    })
  },
  
  deleteNote: async (id: string) => {
    return safeElectronCall(async () => {
      const operations = [{
        query: `
          UPDATE notes 
          SET deleted_at = ?, updated_at = ?, version = version + 1
          WHERE id = ?
        `,
        params: [new Date().toISOString(), new Date().toISOString(), id]
      }]
      
      return window.electronAPI.executeTransaction(operations)
    })
  },
  
  // Mark habit as completed for today
  markHabitCompleted: async (habitId: string, completed: boolean) => {
    return safeElectronCall(async () => {
      const today = new Date().toISOString().split('T')[0]
      
      const operations = []
      
      if (completed) {
        // Insert or update completion
        operations.push({
          query: `
            INSERT OR REPLACE INTO habit_completions (id, habit_id, date, completed, notes)
            VALUES (?, ?, ?, ?, NULL)
          `,
          params: [crypto.randomUUID(), habitId, today, 1]
        })
        
        // Update streak
        operations.push({
          query: `
            UPDATE habits 
            SET streak_current = streak_current + 1,
                streak_longest = MAX(streak_current + 1, streak_longest),
                consistency_score = (
                  SELECT 
                    (COUNT(CASE WHEN completed = 1 THEN 1 END) * 100.0 / COUNT(*))
                  FROM habit_completions 
                  WHERE habit_id = ?
                  AND date >= date('now', '-30 days')
                ),
                updated_at = ?,
                version = version + 1
            WHERE id = ?
          `,
          params: [habitId, new Date().toISOString(), habitId]
        })
      } else {
        // Remove completion
        operations.push({
          query: `
            DELETE FROM habit_completions 
            WHERE habit_id = ? AND date = ?
          `,
          params: [habitId, today]
        })
        
        // Reset streak
        operations.push({
          query: `
            UPDATE habits 
            SET streak_current = 0,
                updated_at = ?,
                version = version + 1
            WHERE id = ?
          `,
          params: [new Date().toISOString(), habitId]
        })
      }
      
      return window.electronAPI.executeTransaction(operations)
    })
  },
  
  // Complete task
  completeTask: async (taskId: string, progress = 100) => {
    return safeElectronCall(async () => {
      const operations = [{
        query: `
          UPDATE tasks 
          SET status = 'completed', 
              progress = ?,
              completed_at = ?,
              updated_at = ?,
              version = version + 1
          WHERE id = ?
        `,
        params: [progress, new Date().toISOString(), new Date().toISOString(), taskId]
      }]
      
      return window.electronAPI.executeTransaction(operations)
    })
  },
  
  // Search functionality
  search: async (query: string, types: string[] = ['goals', 'tasks', 'habits', 'notes']) => {
    return safeElectronCall(async () => {
      const searchTerm = `%${query}%`
      const results: any[] = []
      
      if (types.includes('goals')) {
        const goals = await window.electronAPI.executeQuery(
          `SELECT 'goal' as type, id, title, description, created_at 
           FROM goals 
           WHERE (title LIKE ? OR description LIKE ?) 
           AND deleted_at IS NULL
           LIMIT 10`,
          [searchTerm, searchTerm]
        )
        results.push(...goals)
      }
      
      if (types.includes('tasks')) {
        const tasks = await window.electronAPI.executeQuery(
          `SELECT 'task' as type, id, title, description, created_at 
           FROM tasks 
           WHERE (title LIKE ? OR description LIKE ?) 
           AND deleted_at IS NULL
           LIMIT 10`,
          [searchTerm, searchTerm]
        )
        results.push(...tasks)
      }
      
      if (types.includes('habits')) {
        const habits = await window.electronAPI.executeQuery(
          `SELECT 'habit' as type, id, title, description, created_at 
           FROM habits 
           WHERE (title LIKE ? OR description LIKE ?) 
           AND deleted_at IS NULL
           LIMIT 10`,
          [searchTerm, searchTerm]
        )
        results.push(...habits)
      }
      
      if (types.includes('notes')) {
        const notes = await window.electronAPI.executeQuery(
          `SELECT 'note' as type, id, title, content as description, created_at 
           FROM notes 
           WHERE (title LIKE ? OR content LIKE ?) 
           AND deleted_at IS NULL
           LIMIT 10`,
          [searchTerm, searchTerm]
        )
        results.push(...notes)
      }
      
      return results
    }, [])
  },
}

// File system utilities
export const fs = {
  selectFile: async (options: any = {}) => {
    return safeElectronCall(async () => {
      return window.electronAPI.selectFile({
        filters: [{ name: 'All Files', extensions: ['*'] }],
        ...options,
      })
    }, null)
  },
  
  saveFile: async (options: any = {}) => {
    return safeElectronCall(async () => {
      return window.electronAPI.saveFile({
        filters: [{ name: 'All Files', extensions: ['*'] }],
        ...options,
      })
    }, null)
  },
  
  getAppPath: async (name: string) => {
    return safeElectronCall(async () => {
      return window.electronAPI.getAppPath(name)
    }, '')
  },
  
  getPlatform: () => {
    if (!isElectron()) {
      return 'web'
    }
    
    try {
      return window.electronAPI.getPlatform()
    } catch {
      return 'unknown'
    }
  },
}

// Backup utilities
export const backup = {
  create: async () => {
    return safeElectronCall(async () => {
      return window.electronAPI.createBackup()
    }, '')
  },
  
  restore: async (backupId: string) => {
    return safeElectronCall(async () => {
      return window.electronAPI.restoreBackup(backupId)
    }, false)
  },
  
  list: async () => {
    return safeElectronCall(async () => {
      return window.electronAPI.listBackups()
    }, [])
  },
}

// Sync utilities
export const sync = {
  start: async () => {
    return safeElectronCall(async () => {
      await window.electronAPI.syncStart()
    })
  },
  
  stop: async () => {
    return safeElectronCall(async () => {
      await window.electronAPI.syncStop()
    })
  },
  
  getStatus: async () => {
    return safeElectronCall(async () => {
      return window.electronAPI.getSyncStatus()
    }, { status: 'idle' })
  },
}

// Undo/Redo utilities
export const undoRedo = {
  undo: async () => {
    return safeElectronCall(async () => {
      return window.electronAPI.undo()
    }, false)
  },
  
  redo: async () => {
    return safeElectronCall(async () => {
      return window.electronAPI.redo()
    }, false)
  },
  
  getStack: async () => {
    return safeElectronCall(async () => {
      return window.electronAPI.getUndoStack()
    }, { canUndo: false, canRedo: false, undoStack: [], redoStack: [] })
  },
}

// Event listeners
export const events = {
  onSyncUpdate: (callback: (status: any) => void) => {
    if (!isElectron()) return () => {}
    
    const handler = (event: any, status: any) => callback(status)
    window.electronAPI.onSyncUpdate(handler)
    
    return () => {
      window.electronAPI.removeSyncUpdate(handler)
    }
  },
  
  onBackupCreated: (callback: (backup: any) => void) => {
    if (!isElectron()) return () => {}
    
    const handler = (event: any, backup: any) => callback(backup)
    window.electronAPI.onBackupCreated(handler)
    
    return () => {
      window.electronAPI.removeBackupCreated(handler)
    }
  },
  
  onDatabaseError: (callback: (error: any) => void) => {
    if (!isElectron()) return () => {}
    
    const handler = (event: any, error: any) => callback(error)
    window.electronAPI.onDatabaseError(handler)
    
    return () => {
      window.electronAPI.removeDatabaseError(handler)
    }
  },
}

// Hook for using Electron with React Query
export const useElectronQuery = () => {
  const electron = useElectron()
  
  return {
    electron,
    // Query hooks for common operations
    useGoals: () => {
      const [data, setData] = useState<any[]>([])
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState<Error | null>(null)
      
      useEffect(() => {
        const fetchGoals = async () => {
          if (!electron.isReady) return
          
          try {
            setLoading(true)
            const goals = await db.getGoals()
            setData(goals)
          } catch (err) {
            setError(err as Error)
          } finally {
            setLoading(false)
          }
        }
        
        fetchGoals()
      }, [electron.isReady])
      
      return { data, loading, error, refetch: () => {} }
    },
    
    useTodaysTasks: () => {
      const [data, setData] = useState<any[]>([])
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState<Error | null>(null)
      
      useEffect(() => {
        const fetchTasks = async () => {
          if (!electron.isReady) return
          
          try {
            setLoading(true)
            const tasks = await db.getTodaysTasks()
            setData(tasks)
          } catch (err) {
            setError(err as Error)
          } finally {
            setLoading(false)
          }
        }
        
        fetchTasks()
      }, [electron.isReady])
      
      return { data, loading, error, refetch: () => {} }
    },
    
    useDashboardStats: () => {
      const [data, setData] = useState<any>(null)
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState<Error | null>(null)
      
      useEffect(() => {
        const fetchStats = async () => {
          if (!electron.isReady) return
          
          try {
            setLoading(true)
            const stats = await db.getDashboardStats()
            setData(stats)
          } catch (err) {
            setError(err as Error)
          } finally {
            setLoading(false)
          }
        }
        
        fetchStats()
      }, [electron.isReady])
      
      return { data, loading, error, refetch: () => {} }
    },
  }
}