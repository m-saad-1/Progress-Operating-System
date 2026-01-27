import { useState, useEffect, useCallback } from 'react'
import { useElectron } from './use-electron'
import { useToaster } from './use-toaster'

export interface Command {
  id: string
  type: string
  description: string
  timestamp: Date
  data: any
}

export interface UndoRedoState {
  canUndo: boolean
  canRedo: boolean
  undoStack: Command[]
  redoStack: Command[]
  lastCommand?: Command
}

export const useUndoRedo = () => {
  const electron = useElectron()
  const { success, error, info } = useToaster()
  const [state, setState] = useState<UndoRedoState>({
    canUndo: false,
    canRedo: false,
    undoStack: [],
    redoStack: [],
  })

  const loadUndoRedoState = useCallback(async () => {
    try {
      const result = await electron.getUndoStack() as any
      if (result) {
        setState({
          canUndo: result.canUndo || false,
          canRedo: result.canRedo || false,
          undoStack: (result.undoStack || []).map((cmd: any) => ({
            ...cmd,
            timestamp: new Date(cmd.timestamp)
          })),
          redoStack: (result.redoStack || []).map((cmd: any) => ({
            ...cmd,
            timestamp: new Date(cmd.timestamp)
          })),
          lastCommand: result.lastCommand ? { ...result.lastCommand, timestamp: new Date(result.lastCommand.timestamp) } : undefined,
        })
      }
    } catch (err) {
      console.error('Failed to load undo/redo state:', err)
    }
  }, [electron])

  // Load initial state from electron
  useEffect(() => {
    if (electron.isReady) {
      loadUndoRedoState()
    }
  }, [electron.isReady, loadUndoRedoState])

  const executeCommand = useCallback(async (
    type: string,
    description: string,
    data: any
  ): Promise<boolean> => {
    if (!electron.isReady) {
      error('System not ready')
      return false
    }

    try {
      // In a real implementation, this would call electron.executeCommand
      // For now, we'll simulate it
      const command: Command = {
        id: Date.now().toString(),
        type,
        description,
        timestamp: new Date(),
        data,
      }

      // Update local state
      setState(prev => ({
        ...prev,
        canUndo: true,
        undoStack: [...prev.undoStack, command],
        redoStack: [], // Clear redo stack on new command
        lastCommand: command,
      }))

      success(`${description} completed`)
      return true
    } catch (err) {
      console.error('Failed to execute command:', err)
      error('Failed to execute command')
      return false
    }
  }, [electron, success, error])

  const undo = useCallback(async (): Promise<boolean> => {
    if (!electron.isReady || !state.canUndo) {
      return false
    }

    try {
      const success = await electron.undo()
      if (success) {
        // Update local state
        setState(prev => {
          const lastCommand = prev.undoStack[prev.undoStack.length - 1]
          return {
            ...prev,
            canUndo: prev.undoStack.length > 1,
            canRedo: true,
            undoStack: prev.undoStack.slice(0, -1),
            redoStack: [...prev.redoStack, lastCommand!],
            lastCommand: prev.undoStack.length > 1 ? prev.undoStack[prev.undoStack.length - 2] : undefined,
          }
        })

        info('Undo completed')
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to undo:', err)
      error('Failed to undo')
      return false
    }
  }, [electron, state.canUndo, info, error])

  const redo = useCallback(async (): Promise<boolean> => {
    if (!electron.isReady || !state.canRedo) {
      return false
    }

    try {
      const success = await electron.redo()
      if (success) {
        // Update local state
        setState(prev => {
          const lastRedo = prev.redoStack[prev.redoStack.length - 1]
          return {
            ...prev,
            canUndo: true,
            canRedo: prev.redoStack.length > 1,
            undoStack: [...prev.undoStack, lastRedo!],
            redoStack: prev.redoStack.slice(0, -1),
            lastCommand: lastRedo,
          }
        })

        info('Redo completed')
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to redo:', err)
      error('Failed to redo')
      return false
    }
  }, [electron, state.canRedo, info, error])

  const clearHistory = useCallback(async (): Promise<boolean> => {
    if (!electron.isReady) {
      return false
    }

    try {
      // In a real implementation, this would call electron.clearUndoHistory
      setState({
        canUndo: false,
        canRedo: false,
        undoStack: [],
        redoStack: [],
      })

      info('History cleared')
      return true
    } catch (err) {
      console.error('Failed to clear history:', err)
      error('Failed to clear history')
      return false
    }
  }, [electron, info, error])

  const getLastCommand = useCallback((): Command | undefined => {
    return state.lastCommand
  }, [state.lastCommand])

  const getCommandHistory = useCallback((): Command[] => {
    return [...state.undoStack].reverse()
  }, [state.undoStack])

  const batchCommands = useCallback(async (
    commands: Array<{ type: string; description: string; data: any }>,
    batchDescription: string
  ): Promise<boolean> => {
    if (!electron.isReady) {
      return false
    }

    try {
      // Create batch command
      const batchCommand: Command = {
        id: Date.now().toString(),
        type: 'batch',
        description: batchDescription,
        timestamp: new Date(),
        data: { commands },
      }

      // Update local state
      setState(prev => ({
        ...prev,
        canUndo: true,
        undoStack: [...prev.undoStack, batchCommand],
        redoStack: [],
        lastCommand: batchCommand,
      }))

      success(`${batchDescription} completed`)
      return true
    } catch (err) {
      console.error('Failed to execute batch commands:', err)
      error('Failed to execute batch commands')
      return false
    }
  }, [electron, success, error])

  // Listen for undo/redo events from other components
  useEffect(() => {
    const handleGlobalUndo = async () => {
      await undo()
    }

    const handleGlobalRedo = async () => {
      await redo()
    }

    document.addEventListener('global-undo', handleGlobalUndo)
    document.addEventListener('global-redo', handleGlobalRedo)

    return () => {
      document.removeEventListener('global-undo', handleGlobalUndo)
      document.removeEventListener('global-redo', handleGlobalRedo)
    }
  }, [undo, redo])

  return {
    // State
    canUndo: state.canUndo,
    canRedo: state.canRedo,
    undoStack: state.undoStack,
    redoStack: state.redoStack,
    lastCommand: state.lastCommand,
    
    // Actions
    executeCommand,
    undo,
    redo,
    clearHistory,
    
    // Getters
    getLastCommand,
    getCommandHistory,
    
    // Batch operations
    batchCommands,
    
    // Utility
    hasChanges: state.undoStack.length > 0,
    totalChanges: state.undoStack.length,
  }
}