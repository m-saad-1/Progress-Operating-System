import { useState, useCallback, useEffect } from 'react'

export type ToasterType = 'default' | 'success' | 'warning' | 'error' | 'info'

export interface Toaster {
  id: string
  title: string
  description?: string
  type: ToasterType
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

export interface ToastOptions {
  title: string
  description?: string
  type?: ToasterType
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

export const useToaster = () => {
  const [toasters, setToasters] = useState<Toaster[]>([])
  const [toastListeners, setToastListeners] = useState<Array<(toast: Toaster) => void>>([])

  const toast = useCallback((options: ToastOptions) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: Toaster = {
      id,
      title: options.title,
      description: options.description,
      type: options.type || 'default',
      duration: options.duration || 5000,
      action: options.action,
    }

    setToasters((prev) => [...prev, newToast])
    
    // Notify listeners
    toastListeners.forEach(listener => listener(newToast))
    
    // Auto-dismiss if duration is set
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        dismissToast(id)
      }, newToast.duration)
    }

    return id
  }, [toastListeners])

  const success = useCallback((title: string, description?: string) => {
    return toast({ title, description, type: 'success', duration: 3000 })
  }, [toast])

  const error = useCallback((title: string, description?: string) => {
    return toast({ title, description, type: 'error', duration: 7000 })
  }, [toast])

  const warning = useCallback((title: string, description?: string) => {
    return toast({ title, description, type: 'warning', duration: 5000 })
  }, [toast])

  const info = useCallback((title: string, description?: string) => {
    return toast({ title, description, type: 'info', duration: 4000 })
  }, [toast])

  const dismissToast = useCallback((id: string) => {
    setToasters((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const dismissAllToasts = useCallback(() => {
    setToasters([])
  }, [])

  const addToastListener = useCallback((listener: (toast: Toaster) => void) => {
    setToastListeners((prev) => [...prev, listener])
    return () => {
      setToastListeners((prev) => prev.filter(l => l !== listener))
    }
  }, [])

  // Clean up toasts on unmount
  useEffect(() => {
    return () => {
      setToasters([])
      setToastListeners([])
    }
  }, [])

  return {
    toasts: toasters,
    toast,
    success,
    error,
    warning,
    info,
    dismissToast,
    dismissAllToasts,
    addToastListener,
  }
}