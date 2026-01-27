import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Calendar,
  CheckSquare,
  FileText,
  Home,
  Plus,
  Settings,
  Target,
  TrendingUp,
  User,
} from 'lucide-react'
import { useHotkeys } from 'react-hotkeys-hook'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  // Open command palette with Cmd/Ctrl + K
  useHotkeys('ctrl+k, cmd+k', (e) => {
    e.preventDefault()
    setOpen(true)
  })

  // Close on escape
  useHotkeys('escape', () => {
    if (open) {
      setOpen(false)
    }
  })

  const commands = [
    {
      name: 'Dashboard',
      icon: Home,
      action: () => navigate('/'),
    },
    {
      name: 'New Goal',
      icon: Target,
      action: () => navigate('/goals?new=true'),
    },
    {
      name: 'New Task',
      icon: CheckSquare,
      action: () => navigate('/tasks?new=true'),
    },
    {
      name: 'New Note',
      icon: FileText,
      action: () => navigate('/notes?new=true'),
    },
    {
      name: 'Goals',
      icon: Target,
      action: () => navigate('/goals'),
    },
    {
      name: 'Tasks',
      icon: CheckSquare,
      action: () => navigate('/tasks'),
    },
    {
      name: 'Habits',
      icon: Calendar,
      action: () => navigate('/habits'),
    },
    {
      name: 'Notes',
      icon: FileText,
      action: () => navigate('/notes'),
    },
    {
      name: 'Analytics',
      icon: TrendingUp,
      action: () => navigate('/analytics'),
    },
    {
      name: 'Settings',
      icon: Settings,
      action: () => navigate('/settings'),
    },
    {
      name: 'Profile',
      icon: User,
      action: () => navigate('/settings?tab=profile'),
    },
  ]

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
          <CommandGroup heading="Navigation">
            {commands.slice(0, 5).map((command) => (
              <CommandItem
                key={command.name}
                onSelect={() => {
                  command.action()
                  setOpen(false)
                }}
              >
                <command.icon className="mr-2 h-4 w-4" />
                <span>{command.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          
          <CommandSeparator />
          
          <CommandGroup heading="Quick Actions">
            {commands.slice(5).map((command) => (
              <CommandItem
                key={command.name}
                onSelect={() => {
                  command.action()
                  setOpen(false)
                }}
              >
                <command.icon className="mr-2 h-4 w-4" />
                <span>{command.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          
          <CommandSeparator />
          
          <CommandGroup heading="Create">
            <CommandItem
              onSelect={() => {
                navigate('/goals?new=true')
                setOpen(false)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              <span>New Goal</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                navigate('/tasks?new=true')
                setOpen(false)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              <span>New Task</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                navigate('/notes?new=true')
                setOpen(false)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              <span>New Note</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}