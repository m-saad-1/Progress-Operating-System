import React, { useRef, useState, useCallback, useEffect } from 'react'
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Code,
  Highlighter,
  Trash2,
  RotateCcw,
  RotateCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface RichTextEditorProps {
  value: string
  onChange: (content: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  autoSaveDelay?: number
  onAutoSave?: (content: string) => void
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Add details, notes, or context...',
  className,
  disabled = false,
  autoSaveDelay = 2000,
  onAutoSave,
}) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const selectionRangeRef = useRef<Range | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>()
  const historyRef = useRef<{ undoStack: string[], redoStack: string[] }>({ undoStack: [], redoStack: [] })
  const lastInputRef = useRef<string>('')
  const [, setHistoryUpdate] = useState(0) // Force re-render on history changes

  // Initialize editor with external value
  useEffect(() => {
    if (editorRef.current) {
      // Only update if the content is different to avoid cursor issues
      const currentHTML = editorRef.current.innerHTML
      const nextValue = value || ''
      if (currentHTML !== nextValue) {
        editorRef.current.innerHTML = nextValue
      }
    }
  }, [value])

  const saveSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    if (editorRef.current?.contains(range.commonAncestorContainer)) {
      selectionRangeRef.current = range.cloneRange()
    }
  }, [])

  const restoreSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection) return

    if (selectionRangeRef.current) {
      selection.removeAllRanges()
      selection.addRange(selectionRangeRef.current)
    } else {
      editorRef.current?.focus()
    }
  }, [])

  // Handle auto-save
  const triggerAutoSave = useCallback((content: string) => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    setAutoSaveStatus('saving')
    autoSaveTimeoutRef.current = setTimeout(() => {
      if (onAutoSave) {
        onAutoSave(content)
      }
      setAutoSaveStatus('saved')
      setTimeout(() => setAutoSaveStatus('idle'), 2000)
    }, autoSaveDelay)
  }, [autoSaveDelay, onAutoSave])

  const handleInput = useCallback(() => {
    const currentContent = editorRef.current?.innerHTML || ''
    if (lastInputRef.current !== currentContent) {
      onChange(currentContent)
      lastInputRef.current = currentContent
      triggerAutoSave(currentContent)
    }
  }, [onChange, triggerAutoSave])

  const executeCommand = (command: string, value?: string) => {
    if (lastInputRef.current !== '') {
      historyRef.current.undoStack.push(lastInputRef.current)
    }
    historyRef.current.redoStack = []
    setHistoryUpdate(prev => prev + 1)
    
    restoreSelection()
    document.execCommand(command, false, value)
    saveSelection()
    editorRef.current?.focus()
    
    const content = editorRef.current?.innerHTML || ''
    lastInputRef.current = content
    onChange(content)
    triggerAutoSave(content)
  }

  const handleUndo = () => {
    if (historyRef.current.undoStack.length > 0) {
      const currentContent = editorRef.current?.innerHTML || ''
      if (currentContent) {
        historyRef.current.redoStack.push(currentContent)
      }
      const previousContent = historyRef.current.undoStack.pop()
      if (previousContent !== undefined && editorRef.current) {
        editorRef.current.innerHTML = previousContent
        lastInputRef.current = previousContent
        onChange(previousContent)
        triggerAutoSave(previousContent)
        setHistoryUpdate(prev => prev + 1)
      }
    }
  }

  const handleRedo = () => {
    if (historyRef.current.redoStack.length > 0) {
      const currentContent = editorRef.current?.innerHTML || ''
      if (currentContent) {
        historyRef.current.undoStack.push(currentContent)
      }
      const nextContent = historyRef.current.redoStack.pop()
      if (nextContent !== undefined && editorRef.current) {
        editorRef.current.innerHTML = nextContent
        lastInputRef.current = nextContent
        onChange(nextContent)
        triggerAutoSave(nextContent)
        setHistoryUpdate(prev => prev + 1)
      }
    }
  }

  const clearFormatting = () => {
    if (window.getSelection()?.toString()) {
      executeCommand('removeFormat')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Allow default undo/redo with Ctrl+Z and Ctrl+Y
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      handleUndo()
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault()
      handleRedo()
    }
  }

  const escapeHtml = (content: string) => {
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  const convertPlainTextToHtml = (text: string) => {
    const normalized = text.replace(/\r\n/g, '\n')
    return escapeHtml(normalized).replace(/\n/g, '<br />')
  }

  const sanitizePastedHtml = (rawHtml: string) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(rawHtml, 'text/html')
    const allowedTags = new Set([
      'P', 'BR', 'UL', 'OL', 'LI', 'STRONG', 'B', 'EM', 'I', 'U', 'MARK', 'BLOCKQUOTE', 'PRE', 'CODE', 'SPAN', 'DIV',
    ])

    const cleanNode = (node: Node): Node | null => {
      if (node.nodeType === Node.TEXT_NODE) {
        return document.createTextNode(node.textContent || '')
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return null
      }

      const element = node as HTMLElement
      const tagName = element.tagName.toUpperCase()

      if (!allowedTags.has(tagName)) {
        const fragment = document.createDocumentFragment()
        Array.from(element.childNodes).forEach((child) => {
          const cleanedChild = cleanNode(child)
          if (cleanedChild) fragment.appendChild(cleanedChild)
        })
        return fragment
      }

      const mappedTag = tagName === 'B' ? 'STRONG' : tagName === 'I' ? 'EM' : tagName
      const cleanedElement = document.createElement(mappedTag.toLowerCase())

      if (mappedTag === 'SPAN') {
        const style = element.style
        if (style.fontWeight === 'bold' || style.fontWeight === '700') {
          const strong = document.createElement('strong')
          Array.from(element.childNodes).forEach((child) => {
            const cleanedChild = cleanNode(child)
            if (cleanedChild) strong.appendChild(cleanedChild)
          })
          return strong
        }

        if (style.fontStyle === 'italic') {
          const em = document.createElement('em')
          Array.from(element.childNodes).forEach((child) => {
            const cleanedChild = cleanNode(child)
            if (cleanedChild) em.appendChild(cleanedChild)
          })
          return em
        }

        if (style.textDecoration.includes('underline')) {
          const underline = document.createElement('u')
          Array.from(element.childNodes).forEach((child) => {
            const cleanedChild = cleanNode(child)
            if (cleanedChild) underline.appendChild(cleanedChild)
          })
          return underline
        }

        if (style.backgroundColor) {
          const mark = document.createElement('mark')
          Array.from(element.childNodes).forEach((child) => {
            const cleanedChild = cleanNode(child)
            if (cleanedChild) mark.appendChild(cleanedChild)
          })
          return mark
        }
      }

      Array.from(element.childNodes).forEach((child) => {
        const cleanedChild = cleanNode(child)
        if (cleanedChild) cleanedElement.appendChild(cleanedChild)
      })

      return cleanedElement
    }

    const fragment = document.createDocumentFragment()
    Array.from(doc.body.childNodes).forEach((child) => {
      const cleanedChild = cleanNode(child)
      if (cleanedChild) fragment.appendChild(cleanedChild)
    })

    const wrapper = document.createElement('div')
    wrapper.appendChild(fragment)
    return wrapper.innerHTML
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return

    e.preventDefault()
    restoreSelection()

    const html = e.clipboardData.getData('text/html')
    const plainText = e.clipboardData.getData('text/plain')

    if (html) {
      const normalizedHtml = sanitizePastedHtml(html)
      document.execCommand('insertHTML', false, normalizedHtml)
    } else {
      const normalizedPlainText = plainText.replace(/\r\n/g, '\n')
      const insertedAsText = document.execCommand('insertText', false, normalizedPlainText)
      if (!insertedAsText) {
        document.execCommand('insertHTML', false, convertPlainTextToHtml(normalizedPlainText))
      }
    }

    saveSelection()
    const content = editorRef.current?.innerHTML || ''
    lastInputRef.current = content
    onChange(content)
    triggerAutoSave(content)
  }

  const insertList = (ordered: boolean) => {
    restoreSelection()
    const selection = window.getSelection()
    const selectedText = selection?.toString() || ''

    if (selectedText.trim().length > 0) {
      const lines = selectedText
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

      if (lines.length > 1) {
        const tag = ordered ? 'ol' : 'ul'
        const listHtml = `<${tag}>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</${tag}>`
        executeCommand('insertHTML', listHtml)
        return
      }
    }

    if (ordered) {
      executeCommand('insertOrderedList')
    } else {
      executeCommand('insertUnorderedList')
    }
  }

  const insertBlockquote = () => {
    executeCommand('formatBlock', 'blockquote')
  }

  const insertCodeBlock = () => {
    executeCommand('formatBlock', 'pre')
  }

  const insertInlineCode = () => {
    restoreSelection()
    const selection = window.getSelection()
    const selectedText = selection?.toString() || 'code'
    const escapedText = selectedText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    executeCommand('insertHTML', `<code>${escapedText}</code>`)
  }

  const highlightText = (color: string = 'yellow') => {
    restoreSelection()
    document.execCommand('backColor', false, color === 'yellow' ? '#fef08a' : color)
    saveSelection()
    editorRef.current?.focus()
    const content = editorRef.current?.innerHTML || ''
    lastInputRef.current = content
    onChange(content)
    triggerAutoSave(content)
  }

  const handleToolbarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    saveSelection()
  }

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={120}>
      <div className={cn('flex flex-col border rounded-lg bg-background overflow-hidden', className)}>
        {/* Toolbar - Fixed */}
        <div className="sticky top-0 z-10 flex-shrink-0 border-b bg-muted/90 backdrop-blur p-2 flex flex-wrap gap-1 items-center">
          <div className="flex gap-1">
            {/* Text Formatting */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => executeCommand('bold')}
                  onMouseDown={handleToolbarMouseDown}
                  disabled={disabled}
                  className="h-8 w-8 p-0 hover:bg-accent"
                >
                  <Bold className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>Bold (Ctrl+B)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => executeCommand('italic')}
                  onMouseDown={handleToolbarMouseDown}
                  disabled={disabled}
                  className="h-8 w-8 p-0 hover:bg-accent"
                >
                  <Italic className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>Italic (Ctrl+I)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => executeCommand('underline')}
                  onMouseDown={handleToolbarMouseDown}
                  disabled={disabled}
                  className="h-8 w-8 p-0 hover:bg-accent"
                >
                  <Underline className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>Underline (Ctrl+U)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => highlightText('yellow')}
                  onMouseDown={handleToolbarMouseDown}
                  disabled={disabled}
                  className="h-8 w-8 p-0 hover:bg-accent"
                >
                  <Highlighter className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>Highlight</TooltipContent>
            </Tooltip>
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Lists */}
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertList(false)}
                  onMouseDown={handleToolbarMouseDown}
                  disabled={disabled}
                  className="h-8 w-8 p-0 hover:bg-accent"
                >
                  <List className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>Bullet List</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertList(true)}
                  onMouseDown={handleToolbarMouseDown}
                  disabled={disabled}
                  className="h-8 w-8 p-0 hover:bg-accent"
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>Numbered List</TooltipContent>
            </Tooltip>
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Block Formatting */}
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={insertBlockquote}
                  onMouseDown={handleToolbarMouseDown}
                  disabled={disabled}
                  className="h-8 w-8 p-0 hover:bg-accent"
                >
                  <Quote className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>Quote Block</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={insertCodeBlock}
                  onMouseDown={handleToolbarMouseDown}
                  disabled={disabled}
                  className="h-8 w-8 p-0 hover:bg-accent"
                >
                  <Code className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>Code Block</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={insertInlineCode}
                  onMouseDown={handleToolbarMouseDown}
                  disabled={disabled}
                  className="h-8 w-8 p-0 hover:bg-accent"
                >
                  <span className="text-[11px] font-mono">&lt;/&gt;</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>Inline Code</TooltipContent>
            </Tooltip>
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Undo/Redo */}
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleUndo}
                  onMouseDown={handleToolbarMouseDown}
                  disabled={disabled || historyRef.current.undoStack.length === 0}
                  className="h-8 w-8 p-0 hover:bg-accent"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>Undo (Ctrl+Z)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRedo}
                  onMouseDown={handleToolbarMouseDown}
                  disabled={disabled || historyRef.current.redoStack.length === 0}
                  className="h-8 w-8 p-0 hover:bg-accent"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>Redo (Ctrl+Y)</TooltipContent>
            </Tooltip>
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Clear Formatting */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFormatting}
                onMouseDown={handleToolbarMouseDown}
                disabled={disabled}
                className="h-8 w-8 p-0 hover:bg-accent"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>Clear Formatting</TooltipContent>
          </Tooltip>

          {/* Auto-save Indicator */}
          <div className="ml-auto flex items-center gap-2 text-xs">
            {autoSaveStatus === 'saving' && (
              <div className="flex items-center gap-1 text-amber-500">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>Saving...</span>
              </div>
            )}
            {autoSaveStatus === 'saved' && (
              <div className="flex items-center gap-1 text-green-500">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <span>Saved</span>
              </div>
            )}
          </div>
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto bg-background/50">
          <style>{`
            [role="textbox"] {
              white-space: normal;
              word-wrap: break-word;
              overflow-wrap: break-word;
            }
            [role="textbox"] blockquote {
              border-left: 4px solid currentColor;
              padding-left: 1rem;
              margin-left: 0;
              opacity: 0.8;
              font-style: italic;
            }
            [role="textbox"] pre {
              background-color: var(--color-bg-muted);
              padding: 0.75rem;
              border-radius: 0.375rem;
              overflow-x: auto;
              font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
              font-size: 0.875rem;
              white-space: pre;
              overflow-wrap: normal;
            }
            [role="textbox"] p {
              margin: 0;
              margin-bottom: 0.5rem;
            }
            [role="textbox"] p:last-child {
              margin-bottom: 0;
            }
            [role="textbox"] ul {
              list-style: disc;
              margin-left: 1.5rem;
              margin-top: 0;
              margin-bottom: 0.5rem;
              padding-left: 0;
            }
            [role="textbox"] ol {
              list-style: decimal;
              margin-left: 1.5rem;
              margin-top: 0;
              margin-bottom: 0.5rem;
              padding-left: 0;
            }
            [role="textbox"] li {
              margin-bottom: 0.25rem;
            }
            [role="textbox"] br {
              line-height: 1.5;
            }
            [role="textbox"] strong {
              font-weight: 600;
            }
            [role="textbox"] em {
              font-style: italic;
            }
            [role="textbox"] u {
              text-decoration: underline;
            }
            [role="textbox"] mark {
              background-color: #fef08a;
              padding: 0.125rem 0.25rem;
              border-radius: 0.125rem;
            }
            [role="textbox"]:empty:before {
              content: attr(data-placeholder);
              color: var(--color-muted-foreground);
              pointer-events: none;
            }
          `}</style>
          <div
            ref={editorRef}
            contentEditable={!disabled}
            onInput={handleInput}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false)
              saveSelection()
            }}
            suppressContentEditableWarning
            role="textbox"
            className={cn(
              'w-full h-full px-4 py-3 outline-none',
              'focus:ring-0 focus:border-0',
              isFocused && 'ring-1 ring-green-500/20',
              disabled && 'opacity-50 cursor-not-allowed bg-muted/30',
              'text-base leading-relaxed'
            )}
            style={{
              minHeight: '420px',
              maxHeight: '100%',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
            }}
            data-placeholder={placeholder}
          />
        </div>

        {/* Footer Info */}
        <div className="flex-shrink-0 border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>{value?.length || 0} characters</span>
            <span>Tip: Use Ctrl+Z to undo, Ctrl+Y to redo</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
