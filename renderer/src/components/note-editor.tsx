import React, { useState, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Code,
  Link,
  Image,
  Save,
  X,
  Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NoteEditorProps {
  initialData?: {
    id?: string
    title: string
    content: string
    type: 'free' | 'daily' | 'weekly' | 'goal' | 'task'
    mood?: string
    tags?: string[]
  }
  onSave: (data: any) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function NoteEditor({
  initialData,
  onSave,
  onCancel,
  isLoading = false,
}: NoteEditorProps) {
  const [title, setTitle] = useState(initialData?.title || '')
  const [content, setContent] = useState(initialData?.content || '')
  const [type, setType] = useState(initialData?.type || 'free')
  const [mood, setMood] = useState(initialData?.mood || '')
  const [tags, setTags] = useState<string[]>(initialData?.tags || [])
  const [newTag, setNewTag] = useState('')

  const handleSave = async () => {
    await onSave({
      ...initialData,
      title,
      content,
      type,
      mood,
      tags,
      updated_at: new Date().toISOString(),
    })
  }

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave()
    }
    if (e.key === 'Escape') {
      onCancel()
    }
  }

  const insertMarkdown = (syntax: string) => {
    const textarea = document.querySelector('textarea')
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)
    const newText = content.substring(0, start) + syntax + selectedText + syntax + content.substring(end)
    
    setContent(newText)
    
    // Focus and set cursor position
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + syntax.length, end + syntax.length)
    }, 0)
  }

  const moods = [
    '😊 Happy',
    '😢 Sad',
    '😡 Angry',
    '😴 Tired',
    '😌 Calm',
    '🤔 Thoughtful',
    '🎉 Excited',
    '😰 Anxious',
    '😎 Confident',
    '🤯 Overwhelmed',
  ]

  return (
    <div className="space-y-6" onKeyDown={handleKeyDown}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {initialData?.id ? 'Edit Note' : 'New Note'}
        </h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={onCancel}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            <Save className="mr-2 h-4 w-4" />
            {isLoading ? 'Saving...' : 'Save Note'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title"
              className="mt-1"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="content">Content</Label>
              <div className="flex items-center space-x-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => insertMarkdown('**')}
                  title="Bold"
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => insertMarkdown('*')}
                  title="Italic"
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => insertMarkdown('\n- ')}
                  title="Bullet List"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => insertMarkdown('\n1. ')}
                  title="Numbered List"
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => insertMarkdown('> ')}
                  title="Quote"
                >
                  <Quote className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => insertMarkdown('`')}
                  title="Code"
                >
                  <Code className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start typing your note here... (Markdown supported)"
              className="min-h-[400px] font-mono text-sm"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="type">Note Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as 'free' | 'daily' | 'weekly' | 'goal' | 'task')}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free Note</SelectItem>
                <SelectItem value="daily">Daily Journal</SelectItem>
                <SelectItem value="weekly">Weekly Review</SelectItem>
                <SelectItem value="goal">Goal Reflection</SelectItem>
                <SelectItem value="task">Task Notes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="mood">Mood (Optional)</Label>
            <Select value={mood} onValueChange={setMood}>
              <SelectTrigger id="mood">
                <SelectValue placeholder="How are you feeling?" />
              </SelectTrigger>
              <SelectContent>
                {moods.map((moodOption) => (
                  <SelectItem key={moodOption} value={moodOption}>
                    {moodOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="tags">Tags</Label>
            <div className="flex space-x-2 mt-1">
              <Input
                id="tags"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a tag"
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              />
              <Button type="button" onClick={handleAddTag}>
                <Tag className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="flex items-center space-x-1"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-4 bg-muted/50">
            <h4 className="font-medium mb-2">Markdown Tips</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>**Bold** - <strong>Bold text</strong></li>
              <li>*Italic* - <em>Italic text</em></li>
              <li># Heading 1</li>
              <li>## Heading 2</li>
              <li>- Bullet list</li>
              <li>1. Numbered list</li>
              <li>&gt; Quote</li>
              <li>`Code`</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}