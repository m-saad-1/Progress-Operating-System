# Progress OS v2.0 Performance Optimization & Architecture Audit

Version: 1.0

Purpose:

Progress OS has been successfully migrated from Electron to Tauri.

The migration is complete.

The application is functional.

However, the desktop application still feels slow and unresponsive.

Your task is NOT to add features.

Your task is to transform Progress OS into a high-performance native desktop application.

---

# Your Role

Act as all of the following:

- Senior Tauri Engineer
- Senior Rust Engineer
- Senior React Engineer
- Senior TypeScript Engineer
- Senior Performance Engineer
- Frontend Architect
- Desktop Application Architect
- UX Performance Specialist
- SQLite Performance Expert
- State Management Expert
- Memory Optimization Expert

Approach this like you are optimizing a production desktop application used by thousands of users.

---

# Primary Goal

The application should feel:

- Instant
- Native
- Fluid
- Responsive
- Lightweight

Every interaction should feel immediate.

The UI should never freeze.

No action should block rendering.

---

# Current Problems

Investigate every reported issue.

Examples include:

- Slow page switching
- Slow sidebar navigation
- Lag when opening pages
- Lag when creating tasks
- Lag when updating tasks
- Lag when checking habits
- Lag when writing notes
- Slow dashboard rendering
- Delayed statistics updates
- UI freezing during database writes
- Overall sluggish experience

Find every bottleneck.

Do not assume these are the only issues.

---

# Phase 1

## Full Performance Audit

Before changing code:

Profile the entire application.

Measure:

- Initial startup
- First render
- Route switching
- Database queries
- State updates
- Component renders
- IPC calls
- File system access
- Memory usage
- CPU usage
- Bundle size

Produce a report.

Identify:

Critical

High

Medium

Low

performance problems.

---

# Phase 2

## React Rendering Optimization

Inspect every component.

Find:

- unnecessary renders
- prop drilling
- expensive calculations
- duplicated rendering
- repeated filtering
- repeated sorting
- repeated mapping
- unstable callbacks
- unstable objects

Optimize using:

React.memo

useMemo

useCallback

memoized selectors

lazy components

component splitting

code splitting

Avoid premature optimization.

Only optimize real bottlenecks.

---

# Phase 3

## Zustand Optimization

Audit every store.

Find:

- large global state
- unnecessary subscriptions
- broad selectors
- deep updates
- cascading renders

Use:

fine-grained selectors

shallow comparison

store splitting

derived state

selector memoization

Only components using changed state should re-render.

---

# Phase 4

## Database Optimization

Inspect every query.

Review:

SELECT

INSERT

UPDATE

DELETE

JOIN

Filtering

Sorting

Pagination

Searching

Ensure:

Indexes exist where needed.

Avoid repeated queries.

Avoid loading unnecessary rows.

Batch writes when possible.

Cache frequently accessed data.

Move expensive operations away from the UI thread.

---

# Phase 5

## Tauri IPC Optimization

Review every invoke() call.

Identify:

frequent IPC

duplicated IPC

blocking IPC

large payloads

Optimize by:

batching requests

caching

background processing

returning minimal payloads

Avoid unnecessary communication between frontend and backend.

---

# Phase 6

## Notes Performance

The Notes page currently lags while typing.

Investigate:

controlled inputs

large state updates

markdown rendering

autosave

syntax highlighting

database writes

Optimize by:

debouncing saves

saving asynchronously

virtualizing large content

background persistence

Typing should remain perfectly smooth.

Target:

60 FPS while typing.

---

# Phase 7

## Tasks Performance

Investigate:

creating tasks

editing tasks

checking tasks

progress updates

priority changes

sorting

filtering

searching

Optimize:

instant optimistic updates

background persistence

memoized filtering

memoized sorting

Efficient selectors

The UI should update immediately.

Database writes should never block rendering.

---

# Phase 8

## Habit Performance

Investigate:

checking habits

streak updates

monthly overview

consistency calculations

Avoid recalculating everything after each completion.

Only recompute affected data.

---

# Phase 9

## Dashboard Optimization

Review:

statistics

cards

charts

recent activity

today view

productivity score

Avoid recomputing all analytics every render.

Memoize expensive calculations.

Load charts lazily if appropriate.

---

# Phase 10

## Analytics Optimization

Analytics often involve expensive calculations.

Optimize:

aggregation

grouping

monthly summaries

yearly summaries

trend calculations

Use caching.

Compute only when data changes.

---

# Phase 11

## List Virtualization

Review every long list.

Examples:

Tasks

Habits

Notes

History

Archive

Activity

If lists become large:

Use virtualization.

Avoid rendering hundreds of items simultaneously.

---

# Phase 12

## Search Optimization

Review:

search

filters

sorting

Use:

debouncing

memoization

indexed queries

Avoid filtering large arrays on every keystroke.

---

# Phase 13

## Animation Optimization

Review every animation.

Ensure:

GPU acceleration

transform

opacity

Avoid:

width animation

height animation

top

left

layout thrashing

Animations should never reduce responsiveness.

---

# Phase 14

## Memory Optimization

Inspect:

memory leaks

listeners

timers

subscriptions

intervals

cleanup

large objects

unused caches

Ensure memory usage remains stable after hours of usage.

---

# Phase 15

## Bundle Optimization

Review:

dependencies

unused packages

duplicate libraries

large assets

tree shaking

dynamic imports

lazy loading

Reduce application size wherever practical.

---

# Phase 16

## Image Optimization

Compress:

screenshots

icons

illustrations

Use:

WebP

AVIF

SVG where appropriate.

---

# Phase 17

## Rust Backend Optimization

Review:

blocking operations

database access

filesystem

threading

Use:

async tasks

Tokio where appropriate

background workers

parallel processing

Avoid blocking the UI thread.

---

# Phase 18

## File System Optimization

Review:

backups

restore

notes

database

Avoid synchronous file operations.

Move heavy work to background tasks.

---

# Phase 19

## Startup Optimization

Reduce:

startup time

initial rendering

database initialization

component loading

Only initialize required services.

Lazy initialize everything else.

---

# Phase 20

## UX Performance

The user should perceive every action as instant.

Implement where appropriate:

optimistic UI

background sync

loading skeletons

non-blocking updates

progress indicators

The interface should respond immediately, even if persistence finishes later.

---

# Phase 21

## Accessibility Performance

Ensure optimizations do not reduce:

keyboard navigation

screen reader support

focus management

reduced motion support

---

# Phase 22

## Code Quality

Refactor where necessary.

Reduce:

duplication

complexity

deep nesting

large components

Create reusable hooks.

Separate business logic from UI.

Improve maintainability while improving performance.

---

# Performance Targets

Application Startup

< 1 second

Window Ready

< 1.5 seconds

Page Navigation

< 100 ms

Sidebar Switching

< 50 ms

Task Completion

Instant visual response

Habit Completion

Instant visual response

Typing Notes

60 FPS

Search

< 100 ms

Database Queries

As fast as practical with indexing

Memory Usage

Stable over long sessions

CPU Usage

Minimal when idle

---

# Constraints

DO NOT

- Remove features
- Change business logic
- Change UI design
- Change workflows
- Break existing functionality

Only improve architecture and performance.

---

# Deliverables

1. Full performance audit report.
2. List every bottleneck with severity.
3. Explain why each issue exists.
4. Optimize each issue incrementally.
5. Verify improvements after every phase.
6. Measure before and after performance.
7. Ensure all functionality remains intact.

Continue optimizing until there are no obvious performance bottlenecks and the application feels like a fast, native desktop application rather than a web application wrapped in Tauri.