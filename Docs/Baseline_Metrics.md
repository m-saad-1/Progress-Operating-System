# Phase 0 Baseline Metrics

| Metric | Measurement (Baseline) |
| --- | --- |
| **Development Build (cargo)** | ~2m 48s (unoptimized target) |
| **Vite Frontend Startup** | ~11.0s (ready time) |
| **Window Ready Time** | *Pending User Measurement* |
| **Page Switching Latency** | *Pending User Measurement* |
| **Task Creation Latency** | *Pending User Measurement* |
| **Notes Typing FPS** | *Pending User Measurement* |
| **Memory Usage (Idle)** | *Pending User Measurement* |
| **CPU Usage (Idle)** | *Pending User Measurement* |

## Branch Status
- Current Branch: `performance-v2`
- Commit Status: All prior planning documents have been successfully committed.

## Action Required
Please launch the application natively using `npm run tauri dev` or the provided `.bat` scripts, and verify that the application works correctly without any regressions from the recent migration. If you can provide rough timings or visual feedback for the pending metrics above, we can record them as our official baseline before we start modifying the code in Phase 1!
