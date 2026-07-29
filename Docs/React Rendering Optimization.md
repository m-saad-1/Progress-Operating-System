# Phase 2 — React Rendering Optimization

Version: 1.0

Purpose:

The Performance Audit has been completed.

All rendering bottlenecks have been identified.

Your task is now to optimize the React application so that the UI feels instantaneous while preserving all existing functionality.

DO NOT redesign the application.

DO NOT change business logic.

DO NOT change the user experience.

Only optimize rendering performance.

---

# Your Role

Act as:

- Senior React Engineer
- Senior Frontend Performance Engineer
- React Profiler Expert
- TypeScript Architect
- Desktop Application Performance Engineer

Optimize the application as if it will manage tens of thousands of tasks, habits, notes, and analytics without any noticeable lag.

---

# Primary Goal

Reduce unnecessary renders.

Reduce render time.

Reduce reconciliation work.

Reduce expensive calculations.

Improve perceived responsiveness.

Every interaction should feel instant.

---

# Rules

DO NOT

- Rewrite business logic
- Remove features
- Change workflows
- Break existing APIs
- Introduce unnecessary abstractions
- Optimize without evidence

Every optimization must solve a real bottleneck identified during profiling.

---

# Phase 1 — React Profiler Validation

Before changing code:

Use React DevTools Profiler to validate every expensive component.

Measure:

- Render duration
- Commit duration
- Render count
- Component tree depth
- Re-render frequency

Verify every optimization with profiling.

Never optimize blindly.

---

# Phase 2 — Component Render Optimization

Inspect every React component.

Find:

- Components re-rendering without data changes
- Parent components forcing child renders
- Expensive render trees
- Repeated JSX generation
- Nested render waterfalls

Optimize only where needed.

---

# Phase 3 — React.memo

Review every component.

Apply React.memo only to components that:

- Receive stable props
- Render frequently
- Are expensive to render

Examples:

Task Card

Habit Card

Goal Card

Analytics Card

Dashboard Widget

Sidebar Items

Calendar Cells

Charts

Statistics Cards

Timeline Items

Avoid wrapping every component with React.memo.

Use it only where profiling proves benefit.

---

# Phase 4 — Stable Props

Inspect every memoized component.

Prevent unnecessary renders caused by:

New object literals

New array literals

Inline callbacks

Inline styles

Inline configuration objects

Replace unstable props with memoized references.

---

# Phase 5 — useCallback Optimization

Audit every callback.

Review:

onClick

onChange

onSubmit

onToggle

onDelete

onUpdate

onComplete

onArchive

Memoize callbacks passed to memoized children.

Avoid unnecessary useCallback usage.

Use only where it prevents real renders.

---

# Phase 6 — useMemo Optimization

Inspect expensive calculations.

Examples:

Filtering

Sorting

Searching

Grouping

Statistics

Progress calculations

Monthly summaries

Yearly summaries

Memoize calculations that depend on stable inputs.

Avoid recalculating during every render.

Never use useMemo for trivial computations.

---

# Phase 7 — Derived Data

Move expensive derived values out of render functions.

Examples:

Filtered task lists

Habit summaries

Progress percentages

Analytics datasets

Dashboard statistics

Cache derived values using memoization.

---

# Phase 8 — Render Tree Simplification

Review component hierarchy.

Identify:

Large parent components

Deep nesting

Oversized pages

Extract reusable subcomponents.

Reduce render depth.

Reduce reconciliation work.

---

# Phase 9 — Page-Level Optimization

Review every page individually.

Examples:

Dashboard

Tasks

Habits

Goals

Notes

Reviews

Analytics

Settings

Ensure switching pages only renders the active page.

Prevent hidden pages from rendering unnecessarily.

---

# Phase 10 — Conditional Rendering

Review conditional rendering.

Prevent mounting expensive components unless needed.

Examples:

Charts

Modals

Dialogs

Editors

Large lists

Analytics

Load only when required.

---

# Phase 11 — Lazy Loading

Implement lazy loading for heavy pages.

Examples:

Analytics

Settings

Reviews

Archive

Help

Documentation

Keep Dashboard fast.

---

# Phase 12 — Code Splitting

Review bundle composition.

Split:

Heavy routes

Large feature modules

Charts

Markdown editor

Rich text editor

Settings

Load only when required.

---

# Phase 13 — List Rendering

Review every list.

Examples:

Tasks

Habits

Notes

Archive

History

Activity

Optimize:

Keys

Sorting

Filtering

Pagination

Virtualization readiness

Avoid rendering unnecessary rows.

---

# Phase 14 — Expensive UI Components

Review:

Charts

Calendars

Markdown Editor

Statistics

Timeline

Progress Graphs

Ensure they only re-render when their data changes.

---

# Phase 15 — Dashboard Optimization

Dashboard is frequently visited.

Optimize:

Widgets

Cards

Charts

Today's Tasks

Recent Activity

Productivity Score

Each widget should update independently.

Avoid full dashboard renders.

---

# Phase 16 — Notes Optimization

Typing must remain smooth.

Prevent:

Full editor re-renders

Expensive markdown rendering

Large state updates

Repeated formatting

Typing should maintain 60 FPS.

---

# Phase 17 — Task Optimization

Optimize:

Completion

Editing

Progress updates

Priority changes

Sorting

Searching

Filtering

Only affected task cards should re-render.

Never refresh the entire list.

---

# Phase 18 — Habit Optimization

Optimize:

Check/uncheck

Streak updates

Consistency

Monthly overview

Only affected habit cards should update.

---

# Phase 19 — Context Optimization

Audit React Context.

Identify:

Large providers

Frequent updates

Broad consumers

Split contexts where appropriate.

Avoid global re-renders.

---

# Phase 20 — Event Handler Optimization

Review:

Mouse events

Keyboard events

Resize

Scroll

Pointer

Prevent unnecessary listener recreation.

Use stable handlers.

---

# Phase 21 — Animation Optimization

Ensure animations use:

transform

opacity

GPU acceleration

Avoid:

width

height

top

left

margin

layout thrashing

Animations should never trigger unnecessary renders.

---

# Phase 22 — Suspense Optimization

Use Suspense boundaries where beneficial.

Ensure:

Fast initial render

Progressive loading

Smooth transitions

No blocking UI.

---

# Phase 23 — Custom Hooks

Extract duplicated rendering logic into reusable hooks.

Examples:

Filtering

Sorting

Pagination

Statistics

Progress calculations

Search

Reduce repeated computation.

---

# Phase 24 — Render Validation

After every optimization:

Profile again.

Compare:

Before

After

Measure:

Render count

Render duration

Commit duration

Component renders

Verify improvements objectively.

---

# Deliverables

Produce:

## Optimization Summary

What was optimized.

---

## Components Optimized

Every optimized component.

---

## Before vs After

Render counts

Render duration

Commit duration

---

## React.memo Usage

Where it was applied.

Why.

---

## useMemo Usage

Where.

Why.

---

## useCallback Usage

Where.

Why.

---

## Lazy Loaded Modules

List every module.

---

## Code Split Modules

List every module.

---

## Remaining Bottlenecks

Anything still requiring optimization in later phases.

---

# Performance Targets

Dashboard Render

< 50 ms

Page Switching

< 100 ms

Task Completion

Instant UI update

Habit Completion

Instant UI update

Typing Notes

60 FPS

Search

< 50 ms

Filtering

Instant

Sorting

Instant

Render Count

Minimum necessary

Hidden Pages

No unnecessary renders

---

# Constraints

DO NOT

- Change business logic
- Remove features
- Break APIs
- Change design
- Rewrite architecture unnecessarily

Only improve rendering performance.

---

# Success Criteria

By the end of this phase:

- Page navigation feels instant.
- Components only render when their data changes.
- Large lists remain responsive.
- Notes editor feels smooth while typing.
- Dashboard updates individual widgets instead of the entire page.
- Filtering, sorting, and searching no longer trigger unnecessary renders.
- React Profiler confirms significantly fewer renders and lower commit times.
- The application feels like a native desktop application rather than a React application running inside Tauri.