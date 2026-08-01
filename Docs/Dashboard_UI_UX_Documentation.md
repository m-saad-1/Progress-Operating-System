# PersonalOS Dashboard: Complete UI/UX Documentation

**Component:** `Dashboard` (`d:\WEB_DEVELOPMENT\PersonalOS\renderer\src\pages\dashboard.tsx`)  
**Purpose:** The central hub of PersonalOS. Provides an immediate, holistic view of the user's day, prioritizing immediate action (Today's Tasks, Pending Habits) alongside high-level insights (Productivity Score, Month Health).

---

## 1. Overall Layout & Architecture

The Dashboard uses a responsive CSS Grid layout designed for a wide-screen desktop experience. It is divided into distinct sections:

1. **Header Section:** Greeting, Date, Quick Actions.
2. **Alerts & Reminders:** Dynamic banners for Weekly/Monthly reviews and missing data.
3. **Top Stat Cards (KPIs):** A row of 4 prominent metric cards highlighting progress at a glance.
4. **Main Content Grid (2:1 Ratio):**
   * **Left Column (2/3 width):** "Today's Tasks" list and the detailed "Progress Analytics" charts.
   * **Right Column (1/3 width):** "Pending Habits", "Active Goals", and other supplementary widgets.

---

## 2. Styling & Visual Language (Tailwind CSS)

*   **Glassmorphism & Gradients:** Cards use subtle radial gradients and low-opacity backgrounds (`bg-gradient-to-br from-sky-500/5 to-transparent`) to feel modern without overwhelming the user.
*   **Color Coding (Semantic):**
    *   **Sky Blue:** Overall Progress
    *   **Violet:** Task Progress
    *   **Emerald/Green:** Daily Overall Progress & Habits
    *   **Amber:** Monthly Health
    *   **Purple:** Goal Activity
    *   **Red/Rose:** At-Risk Items & Warnings
*   **Typography:** Strict adherence to modern Sans-serif, tracking tight on headers (`tracking-tight`), and muted grays for subtitles (`text-muted-foreground`).
*   **Micro-interactions:** Interactive elements use `hover:-translate-y-0.5`, `transition-all duration-300`, and `will-change-transform` for 60 FPS GPU-accelerated feedback.

---

## 3. Content, Text, & Components Detailed

### 3.1. Header & Greeting
*   **Behavior:** Dynamically calculates the time of day to display `"Good morning!"`, `"Good afternoon!"`, or `"Good evening!"`.
*   **Content:** Displays the current formatted date (e.g., `Friday, July 31, 2026`).
*   **Actions:** Contains the `<QuickActions />` component for fast entry of tasks or habits.

### 3.2. Review Alerts
*   **Behavior:** Conditionally renders based on the day of the week/month and whether a review is already completed.
*   **Content:**
    *   *Weekly Review:* "Sunday review is ready. Capture wins, blockers, and priorities for next week."
    *   *Monthly Review:* "It’s the last day of the month. Complete your monthly review to close the cycle clearly."

### 3.3. Key Metric Cards (Top Row)
These cards provide immediate feedback on productivity health:
1.  **Overall Progress (This Month):** Combines task completion weight with habit consistency. Displays a massive percentage.
2.  **Task Progress:** Highlights today's completion rate and weighted progress (prioritized execution).
3.  **Daily Overall Progress:** A composite score of today's tasks + due habits.
4.  **Month Health:** Evaluates tasks and habits for the entire current month, displaying remaining days.
5.  **Habit Consistency:** Shows today's completed vs. expected habits, with weekly and monthly consistency percentages.
6.  **At-Risk Items (Red Alert):** Flags overdue tasks, struggling habits (under 50% consistency), and past-due goals.

### 3.4. Today's Tasks (Main Left Column)
*   **Content:** Renders the `<TaskList />` component specifically filtered for *Today*. 
*   **Behavior:** 
    *   Incomplete tasks sort to the top by priority (Critical -> Low).
    *   Completed tasks automatically drop to the bottom.
    *   Shows a badge like `2/5 done`.
    *   Clicking a checkbox triggers an Optimistic UI update (`onMutate`) for instantaneous visual feedback (0ms latency), while saving to SQLite in the background.

### 3.5. Progress Analytics Chart (Main Left Column)
*   **Behavior:** A tabbed interface (Productivity, Tasks, Habits, Goals) rendering interactive `recharts` SVG graphs.
*   **Styling:** 
    *   Area Charts (`Productivity` tab) use SVG `<linearGradient>` for a beautiful fading drop-shadow effect.
    *   Tooltips are custom styled as floating popovers.
*   **Data:** Pulls a localized 7-day trailing snapshot to prevent heavy DB aggregations on the main thread.

### 3.6. Habits (Right Column)
*   **Content:** Renders the `<HabitTracker compact={true} />`.
*   **Behavior:** 
    *   **Crucial UX Decision:** This widget ONLY shows *pending* (incomplete) habits for the day/week. 
    *   Once a habit is ticked off, it disappears from this widget to keep the user's workspace decluttered.
    *   If all are complete, it shows a success empty state: "No pending habits remaining. Keep up the great work!"

### 3.7. Active Goals (Right Column)
*   **Behavior:** Slices the top 3 most urgent or prioritized active goals.
*   **Styling Effects:** 
    *   If a goal is highly urgent (due in < 7 days and < 80% complete), the card gets an amber warning glow (`border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10`).
    *   Hovering a goal card slightly elevates it.

---

## 4. Underlying UX & Performance Behaviors

1.  **Optimistic Rendering:** Every interaction (tick a checkbox, archive a task) uses `react-query`'s `onMutate` to instantly update the local Zustand store. The user never sees a loading spinner for core actions.
2.  **Binary Task Completion:** A task is only considered complete when its progress hits `100%`. There is no "partial credit" in the primary task counter, encouraging full execution.
3.  **Smart Date Scoping:** The dashboard aggressively filters out "Yesterday's" data. Overdue tasks are pushed to the "At-Risk" alert rather than cluttering "Today's Tasks", forcing the user to consciously reschedule or delete them.
4.  **Hardware Acceleration:** Modals (like "Add Task") and tooltips utilize `will-change-transform` for smooth compositor-thread animations, ensuring the UI never stutters when opening heavy forms.
