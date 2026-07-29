# Phase 4 — Database & Tauri IPC Optimization

Version: 1.0

Purpose:

The React rendering layer and Zustand state management have already been optimized.

The next priority is optimizing the communication between the frontend, the Tauri backend, and the local database.

The application currently experiences noticeable delays when:

- Switching pages
- Creating tasks
- Updating tasks
- Checking habits
- Saving notes
- Opening analytics
- Refreshing dashboard statistics

These delays are likely caused by inefficient database operations, excessive IPC communication, blocking Rust commands, or poor caching.

Your task is to optimize the complete data flow without changing business logic or user experience.

---

# Your Role

Act as:

- Senior Tauri Engineer
- Senior Rust Engineer
- SQLite Performance Expert
- Database Architect
- IPC Optimization Specialist
- Desktop Performance Engineer
- Systems Architect

Think like you are optimizing a production desktop application handling hundreds of thousands of records.

---

# Primary Goal

Every user interaction should feel instantaneous.

Database operations should never block the UI.

IPC communication should be minimal, efficient, and asynchronous.

The frontend should never wait unnecessarily.

---

# Rules

DO NOT

- Change business logic
- Remove features
- Replace the database
- Rewrite the application architecture
- Introduce unnecessary complexity

Only optimize performance.

---

# Phase 1 — Database Architecture Audit

Review the entire database architecture.

Document:

Database engine

Schema

Relationships

Indexes

Foreign keys

Constraints

Query flow

Connection management

Transactions

Caching

Document the complete data flow.

---

# Phase 2 — Query Profiling

Inspect every query.

Examples:

Task Queries

Habit Queries

Goal Queries

Notes Queries

Analytics Queries

Dashboard Queries

Settings Queries

History Queries

Archive Queries

Measure:

Execution time

Rows scanned

Rows returned

Frequency

Memory allocation

Identify:

Slow queries

Repeated queries

Duplicate queries

Expensive joins

Large scans

Blocking queries

---

# Phase 3 — Index Optimization

Inspect every table.

Determine:

Missing indexes

Unused indexes

Composite indexes

Foreign key indexes

Search indexes

Sorting indexes

Date indexes

Add indexes only where profiling proves benefit.

Avoid unnecessary indexing.

---

# Phase 4 — Query Optimization

Rewrite inefficient queries where appropriate.

Avoid:

SELECT *

Repeated filtering

Repeated sorting

Large joins

Multiple round trips

Nested queries

Repeated aggregation

Prefer:

Minimal columns

Parameterized queries

Efficient filtering

Proper ordering

Optimized joins

Batch retrieval

---

# Phase 5 — Batch Operations

Review every write operation.

Examples:

Create multiple tasks

Import data

Bulk archive

Bulk delete

Bulk restore

Bulk habit updates

Batch database writes wherever possible.

Reduce transaction overhead.

---

# Phase 6 — Transactions

Review every transaction.

Ensure:

Atomic updates

Minimal duration

No unnecessary locking

No nested transactions

Transactions should complete as quickly as possible.

---

# Phase 7 — Connection Management

Inspect database connections.

Review:

Connection lifetime

Connection reuse

Pooling (if applicable)

Repeated connection creation

Ensure connections are reused efficiently.

Avoid unnecessary initialization.

---

# Phase 8 — Dashboard Data Loading

Dashboard often performs multiple queries.

Optimize:

Today's Tasks

Habits

Progress

Statistics

Recent Activity

Charts

Avoid sequential queries.

Load independent data concurrently.

Reduce total dashboard loading time.

---

# Phase 9 — Analytics Optimization

Analytics often perform expensive aggregation.

Optimize:

Monthly summaries

Yearly summaries

Productivity score

Habit consistency

Task completion

Trend analysis

Cache expensive calculations where appropriate.

Avoid recalculating unchanged data.

---

# Phase 10 — Search Optimization

Review:

Task search

Habit search

Notes search

Goal search

Archive search

Ensure searches use efficient indexed queries.

Avoid loading all records into memory.

---

# Phase 11 — Lazy Database Loading

Review every page.

Load only required data.

Examples:

Analytics

Archive

Settings

History

Large reports

Do not load unused data during startup.

---

# Phase 12 — Tauri IPC Audit

Inspect every invoke() call.

Document:

Command

Frequency

Payload size

Execution time

Blocking behavior

Return size

Identify:

Duplicate calls

Repeated calls

Sequential calls

Large payloads

Unnecessary commands

---

# Phase 13 — IPC Optimization

Reduce IPC overhead.

Optimize:

Payload size

Serialization

Deserialization

Command frequency

Avoid sending entire objects when only IDs or changed fields are required.

Return only the minimum required data.

---

# Phase 14 — Async Rust Commands

Inspect every Rust command.

Identify blocking operations.

Move expensive work to asynchronous execution where appropriate.

Ensure the frontend remains responsive while work completes.

Avoid blocking the main thread.

---

# Phase 15 — Background Processing

Move long-running operations into background tasks.

Examples:

Backup

Restore

Analytics

Large imports

Large exports

Statistics generation

Database maintenance

The UI should remain fully interactive.

---

# Phase 16 — Notes Saving

Review note persistence.

Avoid saving on every keystroke.

Implement efficient autosave strategies.

Examples:

Debounce

Background save

Change detection

Batch writes

Typing should never pause because of database operations.

---

# Phase 17 — Task Operations

Optimize:

Create

Update

Delete

Archive

Restore

Complete

Progress updates

Priority changes

Use optimistic UI where appropriate.

Persist changes asynchronously.

---

# Phase 18 — Habit Operations

Optimize:

Completion

Streak updates

Consistency calculations

History updates

Monthly summaries

Avoid recomputing unrelated habit data.

---

# Phase 19 — Caching Strategy

Review frequently accessed data.

Examples:

Settings

Dashboard

Today's Tasks

Current Habits

User Preferences

Frequently used statistics

Cache only data that provides measurable performance improvements.

Invalidate caches correctly.

Avoid stale data.

---

# Phase 20 — Serialization Optimization

Review data passed between:

React

↓

Tauri

↓

Rust

↓

Database

Reduce:

Serialization cost

Deserialization cost

Large JSON payloads

Duplicate object creation

---

# Phase 21 — File System Optimization

Inspect:

Backups

Restore

Exports

Imports

Attachments

Settings

Avoid synchronous file operations.

Move expensive file work to background threads.

---

# Phase 22 — Memory Optimization

Review:

Database caches

Query results

Large datasets

Unused objects

Temporary allocations

Release memory when no longer needed.

---

# Phase 23 — Startup Optimization

Review application startup.

Delay initialization of:

Analytics

History

Archive

Reports

Large caches

Initialize only essential services immediately.

---

# Phase 24 — Error Handling

Ensure failures do not block the UI.

Examples:

Database unavailable

File write failure

IPC timeout

Corrupted record

Gracefully recover without freezing.

---

# Phase 25 — Profiling Validation

After every optimization:

Measure:

Database query time

IPC execution time

Page load time

Task completion time

Habit completion time

Dashboard loading

Notes saving

Analytics loading

Compare:

Before

After

Every optimization should be measurable.

---

# Deliverables

Produce:

## Database Architecture Report

Overview of the optimized architecture.

---

## Query Optimization Report

Every optimized query.

Reason.

Performance gain.

---

## Index Report

Indexes added.

Indexes removed.

Reason.

---

## IPC Optimization Report

Every optimized command.

Reduced payload sizes.

Reduced command frequency.

Execution improvements.

---

## Caching Strategy

Explain:

What is cached.

Why.

Invalidation strategy.

---

## Startup Improvements

Initialization changes.

Lazy loading strategy.

---

## Before vs After Metrics

Compare:

Startup time

Dashboard load

Task creation

Task completion

Habit completion

Notes saving

Analytics loading

Query execution

IPC latency

Memory usage

---

## Remaining Bottlenecks

List anything requiring future optimization.

---

# Performance Targets

Database Queries

< 10 ms for common operations

Task Creation

Instant UI response

Task Update

Instant

Habit Completion

Instant

Notes Save

Background

Dashboard Loading

< 100 ms

Analytics

As fast as practical with caching

IPC Calls

Minimal

Payload Size

Minimal

Startup

< 1 second

Window Ready

< 1.5 seconds

---

# Constraints

DO NOT

- Change business logic
- Remove functionality
- Replace the database engine
- Rewrite application architecture
- Introduce unnecessary caching

Only improve performance and efficiency.

---

# Success Criteria

By the end of this phase:

- Database queries are indexed and optimized.
- Expensive queries have been eliminated or reduced.
- IPC communication is minimal and asynchronous.
- Dashboard data loads concurrently where appropriate.
- Notes save smoothly without interrupting typing.
- Task and habit updates feel instantaneous.
- Startup time is significantly reduced.
- Large datasets remain responsive.
- Profiling confirms measurable improvements across query execution, IPC latency, and user interactions.
- The application feels like a truly native desktop application with no noticeable database or IPC-induced lag.