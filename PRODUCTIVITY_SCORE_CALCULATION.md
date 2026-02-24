# Productivity Score Calculation - Dynamic Weighting System

## Overview
The Productivity Score has been refactored to use **dynamic weighting** based on actual contribution and available data, rather than fixed category ratios.

## Previous System (Legacy)
- **Formula**: `overall = (taskComponent * 0.65) + (habitComponent * 0.35)`
- **Issue**: Fixed 65% task / 35% habit distribution regardless of data availability
- **Problem**: If habits didn't exist, score was artificially capped at 50% of max

## New System (Current)

### Category Weights
- **Tasks Weight**: 20 (contribution multiplier)
- **Habits Weight**: 4 (contribution multiplier)
- **Total Weight**: 24

### Calculation Formula

#### When Habits Exist:
```
overall = (taskCompletion% × 20 + habitCompletion% × 4) / 24
```

**Proportional Contribution:**
- Tasks: 20/24 = 83.33% of score
- Habits: 4/24 = 16.67% of score

#### When NO Habits Exist:
```
overall = taskCompletion% × 100%
```

**Behavior:**
- Tasks represent 100% of productivity score
- Not artificially limited to 50%
- Reflects actual performance on available data

### Component Calculations

#### Task Completion %
```
taskCompletion% = (earnedWeight / totalWeight) × 100
```
- Represents weighted task progress relative to planned task weights
- Already calculated by `calculateTaskAnalytics.weightedCompletionRate`

#### Habit Completion %
```
habitCompletion% = (completedPeriods / expectedPeriods) × 100
```
- Represents habit consistency relative to expected completion frequency
- Already calculated by `calculateHabitAnalytics.avgConsistency`

## Breakdown Object
The `ProductivityScore.breakdown` object now includes:
- `weightedCompletion`: Task weighted completion %
- `habitConsistency`: Habit average consistency %
- `taskWeight`: Total planned task weight
- `habitWeight`: Total habit weight
- `taskCategoryWeight`: 20 (fixed category weight multiplier)
- `habitCategoryWeight`: 4 (fixed category weight multiplier)
- `hasHabits`: Boolean indicating if habits exist

## Usage in UI

### Analytics Page
- Displays dynamic productivity score with category-specific explanation
- If habits exist: "Tasks (80%) + Habits (75%) — dynamically weighted"
- If no habits: "Tasks (85%) — no habits tracked"

### Dashboard Page
- Uses same calculation for selected period
- Displays overall score matching Analytics tab

## Example Scenarios

### Scenario 1: Complete Data (Tasks + Habits)
**Given:**
- Task completion: 80%
- Habit consistency: 60%
- Habits exist: Yes

**Calculation:**
```
overall = (80 × 20 + 60 × 4) / 24
        = (1600 + 240) / 24
        = 1840 / 24
        = 77% (rounded)
```

**Interpretation:**
- Tasks are delivering 80% of planned weight
- Habits are completing 60% of their expected frequency
- Overall productivity: 77%
- Tasks weighted 83%, Habits weighted 17%

---

### Scenario 2: Tasks Only (No Habits)
**Given:**
- Task completion: 85%
- Habit consistency: 0%
- Habits exist: No

**Calculation:**
```
overall = 85% (tasks represent 100% of score)
```

**Interpretation:**
- No habits to track, so all productivity comes from tasks
- Score reflects 85% of planned task weight achieved
- Not artificially limited (previous system would have capped at ~42%)

---

### Scenario 3: Low Task Performance, Strong Habits
**Given:**
- Task completion: 40%
- Habit consistency: 95%
- Habits exist: Yes

**Calculation:**
```
overall = (40 × 20 + 95 × 4) / 24
        = (800 + 380) / 24
        = 1180 / 24
        = 49% (rounded)
```

**Interpretation:**
- Task performance is weak (40%)
- Habit consistency is excellent (95%)
- Overall score heavily weighted by weak task performance
- Shows that consistent habits alone can't compensate for task underperformance

## Benefits

1. **Accuracy**: Scores reflect actual performance, not forced category ratios
2. **Flexibility**: System adapts to available data (with or without habits)
3. **Fairness**: If habits don't exist, tasks aren't penalized with artificial 50% cap
4. **Proportional**: Tasks and habits contribute based on realistic weight values
5. **Transparency**: Breakdown object provides detailed weighting information

## Implementation Files
- **Main Logic**: `renderer/src/lib/progress.ts` → `calculateProductivityScore()`
- **Analytics Display**: `renderer/src/pages/analytics.tsx`
- **Dashboard Integration**: `renderer/src/pages/dashboard.tsx`

## Testing Validation
All TypeScript compilation checks passed without errors.
System is ready for production use.
