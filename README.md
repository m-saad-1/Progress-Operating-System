# Progress Operating System (Personal OS)

A sophisticated desktop productivity platform built to unify planning, execution, reflection, and analytics in one offline-first system. Personal OS combines tasks, goals, habits, notes, reviews, time management, backups, and optional sync into a single product experience designed for long-term personal operating workflows.

This public repository is intentionally curated to showcase product architecture and engineering capability without exposing sensitive commercial implementation details.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)

## v2.0.0 Migration (Electron → Tauri)

Personal OS has been completely rebuilt on Tauri 2.0, migrating away from Electron. This architectural shift brings massive improvements across the board:

- **Desktop Framework**: Transitioned from Node.js/Chromium (Electron) to a lightweight Rust-based core (Tauri 2.0).
- **Memory Usage**: Drastic reduction in baseline RAM footprint by utilizing the native OS webview instead of shipping a bundled Chromium instance.
- **Bundle Size**: Application installer size has been dramatically reduced, making downloads and updates much faster.
- **Performance**: Near-instant startup times and significantly faster, more efficient IPC communication between the UI and backend.
- **Security Model**: Enhanced security utilizing Tauri's strict IPC access controls, isolated contexts, and capability-based security model. 
- **Native Integration**: Deeper, more reliable OS integrations using native Tauri plugins (e.g., `@tauri-apps/plugin-sql` for SQLite, `@tauri-apps/plugin-notification`, `@tauri-apps/plugin-dialog`).

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

- Tauri 2.0
- Rust

**Backend And IPC**

- Rust in the Tauri core process
- Type-safe IPC-based secure communication boundaries
- SQLite (`@tauri-apps/plugin-sql`) for local persistence

## Project Structure

```text
PersonalOS/
src-tauri/  Tauri 2.0 Rust backend, capabilities, migrations, and core runtime logic
renderer/   React renderer application, pages, components, hooks, analytics, and UI state
shared/     Shared constants and types
sync/       Sync-related utilities and abstractions
undo/       Undo and history support
types/      Global TypeScript declarations
scripts/    Internal development and validation scripts
```

## Engineering Highlights

- Offline-first architecture with local persistence as the primary source of truth.
- Secure boundary design via Tauri capabilities and explicit IPC access patterns.
- Historical data modeling for tasks, habits, reviews, and progress snapshots.
- Type-safe domain structures shared across renderer and runtime layers.
- Backup, archive, and retry-oriented reliability patterns for long-term product use.

## Database And State Design

- **Database**: SQLite-backed local data model for goals, projects, tasks, checklist items, habits, notes, time blocks, backups, and sync state.
- **State Management**: React hooks, Zustand, and TanStack Query used for local UI state, global coordination, and async workflow management.
- **Undo Support**: Dedicated undo/history utilities for richer interaction safety.

## Security Posture

- Context isolation enabled between renderer and main process.
- Sensitive operations handled in the Rust backend.
- Renderer access limited through explicit Tauri capability APIs.
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
