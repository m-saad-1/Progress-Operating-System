# Phase 3 — Zustand State Optimization

Version: 1.0

Purpose:

The React rendering optimization has been completed.

The next priority is optimizing the application's global state management.

The application currently uses Zustand.

Although Zustand is lightweight, poor store architecture, broad subscriptions, and unnecessary state updates can still cause excessive re-renders, sluggish UI, and unnecessary computations.

Your task is to optimize the Zustand architecture for maximum performance while preserving all existing functionality.

---

# Your Role

Act as:

- Senior Zustand Engineer
- Senior React Performance Engineer
- TypeScript Architect
- State Management Architect
- Desktop Application Performance Engineer

Treat this application as if it manages hundreds of thousands of records.

The UI should remain perfectly responsive regardless of dataset size.

---

# Primary Goal

Reduce unnecessary state updates.

Reduce unnecessary subscriptions.

Reduce unnecessary component re-renders.

Reduce unnecessary derived calculations.

Keep state updates extremely granular.

Only components whose data actually changes should re-render.

---

# Rules

DO NOT

- Rewrite business logic
- Replace Zustand with another library
- Change application features
- Change user workflows
- Break APIs
- Introduce unnecessary abstractions

Only optimize the existing Zustand architecture.

---

# Phase 1 — Store Architecture Audit

Review every Zustand store.

Document:

Store Name

Responsibilities

State Size

Actions

Computed Values

Dependencies

Subscriptions

Consumers

Determine whether each store has a single responsibility.

---

# Phase 2 — Store Splitting

Identify oversized stores.

Examples:

One store handling:

Tasks

Habits

Goals

Notes

Analytics

Dashboard

Settings

User Preferences

History

Statistics

If stores are handling unrelated concerns:

Split them into focused domain stores.

Example:

Task Store

Habit Store

Goal Store

Notes Store

Dashboard Store

Analytics Store

Settings Store

UI Store

Theme Store

Notification Store

History Store

Each store should have one clear responsibility.

---

# Phase 3 — Subscription Audit

Inspect every component subscription.

Find:

Components subscribing to entire stores.

Components reading unnecessary state.

Broad subscriptions.

Multiple subscriptions causing duplicate renders.

Replace broad subscriptions with fine-grained selectors.

---

# Phase 4 — Selector Optimization

Review every selector.

Ensure components subscribe only to the exact state they need.

Avoid:

store => store

store => ({ ...store })

Large object selectors

Nested object selectors

Prefer:

Individual primitive selectors

Memoized selectors

Stable selectors

---

# Phase 5 — Shallow Comparison

Inspect object selectors.

Where appropriate:

Use shallow comparison.

Prevent unnecessary renders caused by identical object references.

Apply only where profiling demonstrates benefit.

---

# Phase 6 — Derived State Optimization

Review all derived values.

Examples:

Completed task count

Today's tasks

Habit consistency

Current streak

Monthly summaries

Productivity score

Dashboard statistics

Analytics

Avoid recalculating derived values during every render.

Move expensive computations into memoized selectors or cached derived state.

---

# Phase 7 — Immutable Updates

Inspect every state update.

Ensure updates:

Only modify changed data.

Preserve unchanged references.

Avoid recreating entire arrays or objects unnecessarily.

Avoid deep cloning unless required.

---

# Phase 8 — Array Optimization

Review updates involving:

Tasks

Habits

Goals

Notes

History

Archive

Avoid:

Replacing entire arrays.

Rebuilding unchanged collections.

Instead:

Update only the affected item.

Preserve array references where possible.

---

# Phase 9 — Object Reference Stability

Review every action.

Avoid creating:

New arrays

New objects

New maps

New sets

Unless data actually changes.

Stable references reduce unnecessary React renders.

---

# Phase 10 — Store Action Optimization

Review every action.

Examples:

Create Task

Update Task

Delete Task

Complete Task

Update Habit

Save Note

Archive Item

Restore Item

Goal Update

Analytics Refresh

Ensure actions:

Only update affected state.

Avoid cascading updates across unrelated stores.

---

# Phase 11 — Cross-Store Dependencies

Inspect communication between stores.

Identify:

Circular dependencies

Redundant synchronization

Repeated updates

Shared derived values

Reduce coupling between stores.

Keep stores independent wherever possible.

---

# Phase 12 — Dashboard State

Dashboard often combines data from multiple stores.

Optimize:

Statistics

Today's Tasks

Habit Summary

Recent Activity

Progress

Widgets

Ensure each widget subscribes only to the state it requires.

Avoid full dashboard updates.

---

# Phase 13 — Notes State

Review notes management.

Ensure typing does NOT trigger updates across unrelated stores.

Autosave should not cause global re-renders.

Editor state should remain isolated.

---

# Phase 14 — Task State

Optimize:

Completion

Editing

Priority

Progress

Filtering

Searching

Sorting

Archive

Updating one task must never trigger updates for every task.

---

# Phase 15 — Habit State

Optimize:

Completion

Streak

Consistency

Monthly tracking

History

Only affected habits should update.

---

# Phase 16 — Analytics State

Analytics calculations are expensive.

Separate:

Raw data

Derived statistics

Charts

Cached summaries

Only recompute when underlying data changes.

---

# Phase 17 — UI State

Separate UI state from business state.

Examples:

Dialogs

Modals

Sidebar

Theme

Notifications

Current Page

Search Query

Selected Filters

Never mix UI state with application data.

---

# Phase 18 — Persistence Optimization

Review Zustand persistence.

Inspect:

Serialization

Hydration

Storage writes

Storage reads

Avoid:

Persisting unnecessary state.

Persist only essential application data.

---

# Phase 19 — Hydration Optimization

Review startup.

Avoid blocking the UI while stores hydrate.

Hydrate lazily where appropriate.

Render UI as early as possible.

---

# Phase 20 — Batch Updates

Review actions that update multiple values.

Where appropriate:

Batch updates together.

Prevent multiple consecutive renders.

Avoid cascading state updates.

---

# Phase 21 — Memory Optimization

Review store memory usage.

Remove:

Unused state

Dead actions

Unused selectors

Duplicate caches

Prevent unnecessary memory growth.

---

# Phase 22 — Developer Experience

Improve maintainability.

Ensure:

Clear store boundaries.

Consistent naming.

Strong TypeScript types.

Reusable selectors.

Predictable actions.

Readable architecture.

---

# Validation

After every optimization:

Verify:

Number of subscribers

State update frequency

Render frequency

Store update cost

Memory usage

React Profiler results

Ensure measurable improvements.

---

# Deliverables

Produce:

## Store Architecture Overview

Explain each store and its responsibility.

---

## Optimization Summary

Every optimization performed.

---

## Store Changes

List every modified store.

Explain why.

---

## Selector Improvements

Every optimized selector.

---

## Subscription Improvements

Every optimized subscription.

---

## Derived State Improvements

Every cached or memoized computation.

---

## Cross-Store Improvements

Dependency reductions.

---

## Before vs After

Compare:

State update frequency

Component re-renders

Subscription count

Memory usage

Hydration performance

---

## Remaining Issues

Document anything requiring future optimization.

---

# Performance Targets

Task Completion

Only one task updates.

Habit Completion

Only affected habit updates.

Notes Typing

No unrelated state updates.

Dashboard

Widgets update independently.

Hydration

Fast and non-blocking.

Subscriptions

Granular.

Selectors

Minimal.

Global Re-renders

Near zero.

Memory

Stable.

---

# Constraints

DO NOT

- Replace Zustand
- Change application features
- Break APIs
- Rewrite business logic
- Change user experience

Only improve state architecture and performance.

---

# Success Criteria

By the end of this phase:

- State updates are granular and isolated.
- Components subscribe only to the exact state they require.
- Updating one task no longer causes unrelated components to re-render.
- Dashboard widgets update independently.
- Notes editing remains isolated from the rest of the application.
- Hydration is fast and non-blocking.
- Memory usage remains stable.
- React Profiler confirms fewer renders caused by state updates.
- The application feels significantly more responsive, even with large datasets.