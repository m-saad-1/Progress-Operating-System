# Phase 1 — Performance Audit & Bottleneck Analysis

Version: 1.0

Purpose:

The Electron → Tauri migration has been completed successfully.

However, the application still feels sluggish and does not provide a native desktop experience.

**DO NOT optimize anything yet.**

Your only responsibility is to **measure, profile, inspect, and identify every performance bottleneck** in the application.

Do not refactor.

Do not rewrite code.

Do not introduce new features.

Produce a comprehensive performance report that will guide the optimization phases.

---

# Your Role

Act as:

- Senior Tauri Engineer
- Senior Rust Engineer
- Senior React Engineer
- Senior TypeScript Engineer
- Performance Engineer
- Desktop Application Architect
- React Profiler Expert
- Memory Analysis Expert

Approach this exactly as you would audit a production desktop application.

---

# Primary Objective

Identify **every source of lag**.

Never assume the reported issues are the only problems.

The goal is to understand **why** the application feels slow.

---

# Rules

DO NOT optimize.

DO NOT rewrite.

DO NOT refactor.

DO NOT change architecture.

DO NOT change UI.

Only inspect, profile, measure and explain.

---

# Step 1 — Understand the Architecture

Analyze the complete project.

Document:

- Folder structure
- Application architecture
- React architecture
- State management architecture
- Database architecture
- Rust backend
- IPC communication
- Local storage
- Notes editor
- Analytics engine
- Charts
- Routing
- Component hierarchy

Create a dependency flow showing how data moves through the application.

---

# Step 2 — Build a Performance Profile

Measure the following:

Application startup

Window creation

Initial render

Dashboard render

Page switching

Sidebar switching

Task rendering

Habit rendering

Goal rendering

Notes rendering

Analytics rendering

Settings rendering

Database initialization

State initialization

Chart rendering

File loading

IPC communication

Memory allocation

CPU usage

Record approximate timings where possible.

---

# Step 3 — React Render Audit

Inspect every page.

Identify:

Components rendering unnecessarily

Repeated renders

Render loops

Large component trees

Expensive calculations during render

Repeated sorting

Repeated filtering

Repeated mapping

Large prop chains

Large context updates

Unstable callbacks

Unstable objects

Repeated object creation

Large inline functions

Record:

Component

Reason

Impact

Severity

---

# Step 4 — Zustand Audit

Inspect every store.

Identify:

Large global state

Over-subscribed components

Broad selectors

State mutations affecting unrelated components

Repeated derived calculations

Large nested objects

Missing shallow comparisons

Missing selectors

Store coupling

Document:

Store

Issue

Impact

Severity

---

# Step 5 — Tauri IPC Audit

Inspect every invoke() call.

Measure:

Frequency

Payload size

Blocking behavior

Duplicate requests

Repeated requests

Sequential IPC

Parallel IPC

Unnecessary IPC

Document every IPC interaction.

---

# Step 6 — Database Audit

Review every query.

Measure:

SELECT

INSERT

UPDATE

DELETE

Search

Sort

Aggregation

Filtering

Large table scans

Missing indexes

Repeated queries

Duplicate queries

N+1 patterns

Blocking writes

Document every expensive query.

---

# Step 7 — File System Audit

Inspect:

Backups

Restore

Notes

Settings

Database

File reads

File writes

Large synchronous operations

Blocking file operations

Document all filesystem bottlenecks.

---

# Step 8 — Notes Editor Audit

Investigate typing lag.

Inspect:

Controlled inputs

Autosave

Database writes

State updates

Rendering

Markdown rendering

Syntax highlighting

Large note rendering

Measure:

Typing latency

Save frequency

Render frequency

Update frequency

---

# Step 9 — Tasks Audit

Measure:

Task creation

Task editing

Task completion

Priority updates

Progress updates

Filtering

Searching

Sorting

Archive

Deletion

Determine why each interaction feels slow.

---

# Step 10 — Habits Audit

Measure:

Habit completion

Streak calculation

Monthly overview

Consistency calculation

History generation

Determine whether unnecessary recalculations occur.

---

# Step 11 — Dashboard Audit

Inspect:

Statistics

Today's tasks

Charts

Recent activity

Progress calculations

Widgets

Determine:

How often each widget re-renders.

Whether expensive calculations occur every render.

---

# Step 12 — Analytics Audit

Inspect:

Monthly reports

Yearly reports

Trend analysis

Productivity calculations

Charts

Determine:

Whether calculations are cached.

Whether expensive aggregations repeat unnecessarily.

---

# Step 13 — Component Tree Audit

Inspect every page.

Measure:

Component depth

Children count

Re-render frequency

Largest component

Most expensive component

Render waterfall

Find oversized components that should later be split.

---

# Step 14 — Memory Audit

Inspect:

Memory growth

Memory leaks

Detached listeners

Intervals

Subscriptions

Unused objects

Caches

Determine whether memory stabilizes after prolonged use.

---

# Step 15 — CPU Audit

Identify:

CPU spikes

Heavy rendering

Expensive loops

Background work

Continuous polling

Animations

Charts

Determine what consumes CPU while idle.

---

# Step 16 — Bundle Audit

Review:

Dependencies

Duplicate packages

Large libraries

Unused packages

Unused imports

Large assets

Tree shaking

Dynamic imports

Generate bundle size report.

---

# Step 17 — Animation Audit

Inspect:

Hover animations

Page transitions

Charts

Scrolling

Dashboard

Cards

Sidebar

Identify:

Layout thrashing

Expensive animations

Animations triggering reflow

Paint-heavy effects

---

# Step 18 — Event Listener Audit

Inspect:

Resize

Scroll

Mousemove

Keyboard

Visibility

IPC

Timers

Intervals

Determine whether unnecessary listeners exist.

---

# Step 19 — Network & IPC Timeline

Even though the application is local, create a timeline showing:

User Action

↓

Frontend

↓

State Update

↓

IPC

↓

Rust

↓

Database

↓

Filesystem

↓

Return

↓

React Render

↓

UI Update

Identify unnecessary delays.

---

# Step 20 — User Interaction Audit

Measure perceived responsiveness.

Examples:

Opening pages

Closing dialogs

Checking habits

Completing tasks

Typing notes

Saving notes

Changing filters

Searching

Opening analytics

Everything should feel instant.

Record interactions that do not.

---

# Severity Classification

For every issue classify:

Critical

Causes freezes.

High

Noticeable lag.

Medium

Occasional delay.

Low

Minor inefficiency.

---

# Deliverables

Produce a detailed report containing:

## Executive Summary

Overall health of the application.

---

## Architecture Overview

How the application currently works.

---

## Performance Metrics

Measured timings.

---

## Bottlenecks

Every issue discovered.

---

## Root Cause Analysis

Explain WHY every issue exists.

---

## Evidence

Reference the relevant components, stores, queries, IPC calls, or modules.

---

## Priority Matrix

Critical

High

Medium

Low

---

## Optimization Roadmap

Do NOT implement.

Only recommend the order in which bottlenecks should be addressed.

---

# Success Criteria

By the end of this phase, there should be a complete understanding of:

- Why the application feels slow
- Which components cause lag
- Which database operations are expensive
- Which state updates trigger unnecessary renders
- Which IPC calls are inefficient
- Which pages are the slowest
- Which components consume the most resources
- Which optimizations will provide the greatest performance improvements

**Do not optimize anything in this phase. The objective is to build an accurate performance baseline that will guide all subsequent optimization work.**