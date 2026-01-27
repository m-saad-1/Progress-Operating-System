import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
    this.setState({
      error,
      errorInfo,
    })

    // Log error to analytics service if available
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      try {
        ;(window as any).electronAPI.executeQuery(`
          INSERT INTO audit_log (id, entity_type, entity_id, action, old_value, new_value)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          crypto.randomUUID(),
          'system',
          'error-boundary',
          'error',
          null,
          JSON.stringify({
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString(),
          }),
        ])
      } catch (e) {
        console.error('Failed to log error:', e)
      }
    }
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  private handleReload = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4">
          <div className="max-w-lg w-full space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-4">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight mb-2">
                Something went wrong
              </h1>
              <p className="text-muted-foreground mb-6">
                The application encountered an unexpected error. Don't worry, your data is safe.
              </p>
            </div>

            <div className="bg-card border rounded-lg p-4 space-y-3">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Error Details</h3>
                <code className="block text-xs bg-muted p-3 rounded overflow-x-auto">
                  {this.state.error?.message || 'Unknown error'}
                </code>
              </div>

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Component Stack</h3>
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-32 overflow-y-auto">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={this.handleReset}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button
                onClick={this.handleGoHome}
                variant="default"
                className="flex-1"
              >
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Button>
              <Button
                onClick={this.handleReload}
                variant="secondary"
                className="flex-1"
              >
                Reload Page
              </Button>
            </div>

            <div className="text-center text-xs text-muted-foreground space-y-1">
              <p>
                If the problem persists, please check the logs or contact support.
              </p>
              <p>
                All your data is automatically backed up and can be restored.
              </p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}