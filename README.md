# Personal Operating System (Personal OS)

A sophisticated desktop productivity platform built to unify planning, execution, reflection, and analytics in one offline-first system. Personal OS combines tasks, goals, habits, notes, reviews, time management, backups, and optional sync into a single product experience designed for long-term personal operating workflows.

This public repository is intentionally curated to showcase product architecture and engineering capability without exposing sensitive commercial implementation details.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)

## Features

### Core Productivity Tools

- **Dashboard**: Central hub with a live overview of tasks, goals, habits, and performance metrics.
- **Task Management**: Structured task planning with priorities, progress tracking, lifecycle status, and daily rollover behavior.
- **Goal Tracking**: Long-term goal management with linked progress signals and review-oriented planning.
- **Habit Tracker**: Habit consistency, streak monitoring, and frequency-aware completion logic.
- **Notes**: Rich note capture for ideas, planning, reflection, and supporting context.

### Time And Analytics

- **Pomodoro Timer**: Built-in focus timer for structured deep-work sessions.
- **Time Tracking**: Activity-aware time capture tied to productivity workflows.
- **Analytics Dashboard**: Multi-range reporting across completion, progress, consistency, and trends.
- **Progress Charts**: Visual reporting for progress signals over time.
- **Monthly Analytics**: Deeper performance analysis across recurring workflows and long-term behavior.

### Advanced Product Features

- **Reviews**: Periodic review workflows for reflection, retrospectives, and planning adjustment.
- **Archive**: Controlled historical preservation for completed and inactive records.
- **Backup And Restore**: Data safety features designed for long-term reliability.
- **Offline Support**: Local-first operation with optional sync pathways.
- **Theme System**: Dark mode, light mode, and user-preference-based presentation.
- **Context Tips**: Embedded guidance to support product discoverability.
- **Command Palette**: Keyboard-first command access for power-user workflows.

### User Experience

- **Error Boundaries**: Graceful recovery behavior for runtime failures.
- **Keyboard Shortcuts**: Fast navigation and command execution throughout the app.
- **Responsive Layouts**: Flexible interface behavior across desktop window sizes.
- **Performance Optimization**: Lazy loading, scoped state updates, and efficient rendering patterns.
- **Real-Time Sync Foundations**: Architecture ready for cloud-connected workflows without sacrificing local ownership.

## Architecture

### Technology Stack

**Frontend**

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Radix UI
- React Router
- TanStack Query
- Recharts
- Lucide React

**Desktop Runtime**

- Electron
- Electron Forge
- Webpack

**Backend And IPC**

- Node.js in the Electron main process
- IPC-based secure communication boundaries
- SQLite for local persistence

## Project Structure

```text
PersonalOS/
main/       Electron main process, IPC, storage, backup, updater, privileged runtime logic
renderer/   React renderer application, pages, components, hooks, analytics, and UI state
shared/     Shared constants and types
sync/       Sync-related utilities and abstractions
undo/       Undo and history support
types/      Global TypeScript declarations
scripts/    Internal development and validation scripts
```

## Engineering Highlights

- Offline-first architecture with local persistence as the primary source of truth.
- Secure Electron boundary design via preload bridges and explicit IPC access patterns.
- Historical data modeling for tasks, habits, reviews, and progress snapshots.
- Type-safe domain structures shared across renderer and runtime layers.
- Backup, archive, and retry-oriented reliability patterns for long-term product use.

## Database And State Design

- **Database**: SQLite-backed local data model for goals, projects, tasks, checklist items, habits, notes, time blocks, backups, and sync state.
- **State Management**: React hooks, Zustand, and TanStack Query used for local UI state, global coordination, and async workflow management.
- **Undo Support**: Dedicated undo/history utilities for richer interaction safety.

## Security Posture

- Context isolation enabled between renderer and main process.
- Sensitive operations handled in the Electron main process.
- Renderer access limited through explicit bridge APIs.
- Public repository sanitized to avoid exposing credentials, generated artifacts, and internal-only notes.

## Public Repository Policy

To protect commercial IP and operational security, this repository intentionally excludes:

- live credentials and private keys
- environment-specific deployment details
- internal debugging notes
- generated build output and local-only artifacts not required to understand the product

## Contact

**M. Saad**

- GitHub: [@m-saad-1](https://github.com/m-saad-1)
- Email: `msaad23305@gmail.com`
