# PersonalOS

PersonalOS is a desktop productivity platform designed around one core idea: progress should be measurable, resilient, and trustworthy. Instead of treating planning, execution, reflection, and reporting as separate tools, the product brings them together in a single offline-first workspace for goals, projects, tasks, habits, notes, time tracking, and review cycles.

This repository is presented as a portfolio case study for a commercial SaaS-style product. Public source access is intentionally curated: product architecture, technical decisions, and representative implementation patterns are visible, while operational secrets, private configuration, and non-essential internal artifacts are excluded.

## Product Value

- Unifies planning and execution across goals, projects, tasks, habits, reviews, and notes.
- Preserves historical accuracy with daily state tracking, archive-friendly data models, and audit-aware updates.
- Works reliably in offline-first scenarios, with local persistence and optional sync pathways.
- Surfaces meaningful analytics instead of vanity metrics by separating progress, completion, streaks, consistency, and review signals.
- Packages a complex product system into a desktop experience with secure process boundaries and local data ownership.

## Key Capabilities

- Goal management with categories, priorities, review cadences, and progress models.
- Project and task planning with status lifecycles, weighted progress, and daily rollover behavior.
- Habit tracking with streak logic, consistency scoring, and frequency-aware completion rules.
- Notes and review workflows for reflection, retrospectives, and long-term planning.
- Time tracking and productivity analytics across day, week, month, and broader reporting windows.
- Backup and restore flows with integrity-conscious data handling.
- Optional sync infrastructure for cloud-connected workflows without sacrificing local-first operation.
- Feedback, notifications, and desktop integrations handled from the Electron main process rather than exposing privileged behavior to the UI.

## Architecture

PersonalOS uses a layered desktop architecture that separates experience, orchestration, and data concerns cleanly.

### Experience Layer

- `renderer/`: React and TypeScript application for dashboarding, planning workflows, analytics, settings, and support surfaces.
- UI composition uses Tailwind CSS, Radix primitives, and app-specific components for command workflows, charts, forms, and productivity controls.

### Desktop Runtime

- `main/`: Electron main process for window lifecycle, IPC routing, storage access, feedback transport, updater hooks, and privileged desktop capabilities.
- `preload` and bridge APIs enforce explicit boundaries between renderer code and native/system access.

### Shared Domain Logic

- `shared/`: common constants and types used across the desktop runtime and renderer.
- `sync/`: optional synchronization primitives and cross-device workflow scaffolding.
- `undo/`: reusable undo and state-history utilities for richer interaction flows.

### Data Layer

- Local SQLite persistence with typed entities spanning goals, projects, tasks, checklist items, habits, habit completions, notes, time blocks, backups, sync state, and audit logs.
- Schema design emphasizes soft delete patterns, versioned updates, historical tracking, and recovery-friendly behavior.

## Technical Highlights

### Offline-First by Default

Core workflows are designed to remain useful without network dependency. Local data storage, desktop APIs, and retry-friendly optional network flows allow the product to keep working even when connectivity is unavailable or intermittent.

### Trustworthy Progress Modeling

The app distinguishes between completion and progress rather than flattening all work into a single metric. Tasks, habits, and goal rollups each use logic appropriate to their domain so analytics remain credible under real usage.

### Secure Desktop Boundaries

Sensitive actions live in the Electron main process. The renderer interacts through explicit bridge methods and IPC handlers, reducing accidental exposure of secrets, filesystem access, or system-level behavior.

### Resilience and Data Safety

Backups, archival flows, retry queues, and state history utilities reflect a product designed for long-term use rather than demo-only interactions. The codebase shows deliberate attention to correctness over time, not just surface-level UI delivery.

## Representative Stack

- Electron
- React
- TypeScript
- Vite
- Webpack
- Tailwind CSS
- Radix UI
- Zustand
- TanStack Query
- SQLite via `better-sqlite3`

## Repository Layout

```text
main/       Electron main process, IPC, database access, backup, settings, updater
renderer/   React application, pages, components, hooks, analytics, client logic
shared/     Shared constants and types
sync/       Sync-related helpers and abstractions
undo/       Undo/redo support utilities
scripts/    Utility and validation scripts used during development
types/      Global and package-specific type declarations
```

## Portfolio Framing

This project demonstrates strength in:

- Product-minded full-stack architecture for desktop software.
- Type-safe domain modeling across UI, runtime, and persistence layers.
- Designing for historical correctness, not just CRUD completeness.
- Translating complex operational logic into approachable user-facing workflows.
- Structuring a codebase so local-first reliability and future cloud extensibility can coexist.

## Public Repository Policy

To protect commercial IP and operational security, this public-facing repository intentionally omits:

- live credentials and private keys
- deployment and environment-specific instructions
- internal debugging notes and generated build artifacts
- sensitive infrastructure details not required to understand the engineering approach

## Contact

M. Saad  
`msaad23305@gmail.com`
