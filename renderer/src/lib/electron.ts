// This file provides utilities for working with the Electron API
import { useState, useEffect } from 'react'

// Types for Electron API
interface ElectronAPI {
  // Database operations
  executeQuery: (query: string, params?: any[]) => Promise<any>
  executeTransaction: (operations: Array<{query: string, params?: any[]}>) => Promise<any>
  
  // Generic IPC invoke
  invoke: (channel: string, ...args: any[]) => Promise<any>
  
  // Backup operations
  createBackup: () => Promise<any>
  restoreBackup: (backupId: string) => Promise<any>
  listBackups: () => Promise<any>
  deleteBackup: (backupId: string) => Promise<any>
  verifyBackup: (backupId: string) => Promise<any>
  getBackupStats: () => Promise<any>
  exportBackup: (backupId: string) => Promise<any>
  importBackup: () => Promise<any>
  
  // File operations
  selectFile: (options: any) => Promise<string | null>
  saveFile: (options: any) => Promise<string | null>
  
  // System operations
  getAppPath: (name: string) => Promise<string>
  getPlatform: () => string
  resetAllData: () => Promise<any>
  
  // Sync operations
  syncStart: () => Promise<void>
  syncStop: () => Promise<void>
  getSyncStatus: () => Promise<any>
  setSyncConfig: (config: any) => Promise<any>
  
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
    executeQuery: async <T = any>(query: string, params?: any[]): Promise<T[]> => {
      return safeElectronCall(async () => {
        const response = await window.electronAPI.executeQuery(query, params)
        // Handle wrapped response from IPC { success: boolean, data: any }
        if (response && typeof response === 'object' && 'success' in response) {
          if (!response.success) {
            throw new Error(response.error || 'Query failed')
          }
          const data = response.data
          return Array.isArray(data) ? data : []
        }
        // Handle direct response
        return Array.isArray(response) ? response : []
      }, [])
    },
    executeTransaction: async (operations: Array<{query: string, params?: any[]}>) => {
      return safeElectronCall(async () => {
        const response = await window.electronAPI.executeTransaction(operations)
        // Handle wrapped response from IPC { success: boolean, data: any }
        if (response && typeof response === 'object' && 'success' in response) {
          if (!response.success) {
            throw new Error(response.error || 'Transaction failed')
          }
          return response.data
        }
        return response
      })
    },
    createBackup: async () => {
      return safeElectronCall(async () => {
        const res = await window.electronAPI.createBackup()
        if (res && !res.success) throw new Error(res.error || 'Backup failed')
        return res?.data || res
      })
    },
    restoreBackup: async (backupId: string) => {
      return safeElectronCall(async () => {
        const res = await window.electronAPI.restoreBackup(backupId)
        if (res && !res.success) throw new Error(res.error || 'Restore failed')
        return true
      }, false)
    },
    listBackups: async () => {
      return safeElectronCall(async () => {
        const res = await window.electronAPI.listBackups()
        if (res && !res.success) throw new Error(res.error || 'List failed')
        return res?.data || []
      }, [])
    },
    deleteBackup: async (backupId: string) => {
      return safeElectronCall(async () => {
        const res = await window.electronAPI.deleteBackup(backupId)
        if (res && !res.success) throw new Error(res.error || 'Delete failed')
        return true
      }, false)
    },
    verifyBackup: async (backupId: string) => {
      return safeElectronCall(async () => {
        const res = await window.electronAPI.verifyBackup(backupId)
        if (res && !res.success) throw new Error(res.error || 'Verify failed')
        return res?.data || { valid: false }
      }, { valid: false })
    },
    getBackupStats: async () => {
      return safeElectronCall(async () => {
        const res = await window.electronAPI.getBackupStats()
        if (res && !res.success) throw new Error(res.error || 'Stats failed')
        return res?.data || null
      }, null)
    },
    exportBackup: async (backupId: string) => {
      return safeElectronCall(async () => {
        const res = await window.electronAPI.exportBackup(backupId)
        return res
      }, { success: false })
    },
    importBackup: async () => {
      return safeElectronCall(async () => {
        const res = await window.electronAPI.importBackup()
        return res
      }, { success: false })
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
    resetAllData: async () => {
      return safeElectronCall(async () => {
        const res = await window.electronAPI.resetAllData()
        if (res && typeof res === 'object' && 'success' in res && !res.success) {
          throw new Error(res.error || 'Reset failed')
        }
        return res
      }, { success: false })
    },
    syncStart: async () => {
      return safeElectronCall(async () => {
        const res: any = await window.electronAPI.syncStart()
        if (res && typeof res === 'object' && 'success' in res && !res.success) {
          throw new Error(res.error || 'Sync start failed')
        }
        return res
      })
    },
    syncStop: async () => {
      return safeElectronCall(async () => {
        const res: any = await window.electronAPI.syncStop()
        if (res && typeof res === 'object' && 'success' in res && !res.success) {
          throw new Error(res.error || 'Sync stop failed')
        }
        return res
      })
    },
    getSyncStatus: async () => {
      return safeElectronCall(async () => {
        const res = await window.electronAPI.getSyncStatus()
        if (res && typeof res === 'object' && 'success' in res) {
          if (!res.success) {
            throw new Error(res.error || 'Sync status failed')
          }
          return res.status ?? res.data ?? { status: 'idle' }
        }
        return res
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
            AND (
              notes IS NULL
              OR (
                notes NOT LIKE 'shortBreak session%'
                AND notes NOT LIKE 'longBreak session%'
              )
            )
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
      
      return window.electronAPI.executeQuery(`
        SELECT h.*, 
               (SELECT completed FROM habit_completions 
                WHERE habit_id = h.id AND date = ?) as today_completed
        FROM habits h
        WHERE h.deleted_at IS NULL
        AND h.frequency IN ('daily', 'weekly', 'monthly')
      `, [todayDate])
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
      const now = new Date().toISOString()

      if (completed) {
        await window.electronAPI.executeQuery(`
          INSERT OR REPLACE INTO habit_completions (id, habit_id, date, completed, notes, updated_at)
          VALUES (?, ?, ?, ?, NULL, ?)
        `, [crypto.randomUUID(), habitId, today, 1, now])
      } else {
        await window.electronAPI.executeQuery(`
          DELETE FROM habit_completions 
          WHERE habit_id = ? AND date = ?
        `, [habitId, today])
      }

      const completionRows = await window.electronAPI.executeQuery(`
        SELECT date FROM habit_completions 
        WHERE habit_id = ? AND completed = 1
        ORDER BY date DESC
      `, [habitId])

      const completedDates = new Set(
        (Array.isArray(completionRows) ? completionRows : []).map((row: any) => row.date?.slice(0, 10))
      )

      const toDateKey = (d: Date) => d.toISOString().split('T')[0]
      let currentStreak = 0
      let cursor = new Date()

      if (completedDates.has(toDateKey(cursor))) {
        currentStreak += 1
        cursor.setDate(cursor.getDate() - 1)
      } else {
        cursor.setDate(cursor.getDate() - 1)
        if (completedDates.has(toDateKey(cursor))) {
          currentStreak += 1
          cursor.setDate(cursor.getDate() - 1)
        }
      }

      if (currentStreak > 0) {
        while (completedDates.has(toDateKey(cursor))) {
          currentStreak += 1
          cursor.setDate(cursor.getDate() - 1)
        }
      }

      const consistencyResult = await window.electronAPI.executeQuery(`
        SELECT COUNT(*) as count 
        FROM habit_completions 
        WHERE habit_id = ? 
        AND completed = 1 
        AND date >= date('now', '-30 days')
      `, [habitId])

      const consistencyCount = consistencyResult?.[0]?.count || 0
      const consistencyScore = Math.min(100, Math.round((consistencyCount / 30) * 100))

      await window.electronAPI.executeQuery(`
        UPDATE habits 
        SET streak_current = ?,
            streak_longest = MAX(?, streak_longest),
            consistency_score = ?,
            updated_at = ?,
            version = version + 1
        WHERE id = ?
      `, [currentStreak, currentStreak, consistencyScore, now, habitId])
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