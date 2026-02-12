---
phase: 06-ios-driver-app
plan: 04
subsystem: ios-data-layer
tags: [swift, supabase, realtime, offline, cache, actor, swiftui]

requires:
  - phase: 06-01
    provides: "Xcode scaffold, Config.swift with Supabase credentials and cache keys"
  - phase: 06-02
    provides: "Model structs (VroomXTrip, VroomXOrder, VroomXExpense, DriverNotification), enums, SupabaseManager, NetworkMonitor, CacheManager"
provides:
  - "DataManager singleton: centralized fetch, cache, Realtime, and offline-aware mutations for all driver data"
  - "PendingActionsQueue: actor-based offline mutation queue with UserDefaults persistence and max 5 retries"
  - "InspectionUploadQueue: actor-based media upload queue with exponential backoff (5s to 15min cap)"
  - "OfflineBanner, ErrorBannerView, LoadingView shared UI components for consistent state display"
affects:
  - "06-05 through 06-13 (all views consume DataManager for data)"
  - "06-07/06-08 (inspection views use InspectionUploadQueue for media uploads)"
  - "All views use OfflineBanner, ErrorBannerView, LoadingView for state display"

tech-stack:
  added: []
  patterns:
    - "Actor-based queues (PendingActionsQueue, InspectionUploadQueue) for thread-safe offline processing"
    - "Cache-first pattern: fetch from server -> cache result -> on error load from cache"
    - "Realtime postgresChange subscriptions on 3 tables with automatic re-fetch"
    - "Exponential backoff: baseInterval * 2^(attempt-1), capped at max"
    - "Offline-aware mutations: check NetworkMonitor -> queue if offline -> process on reconnect"

key-files:
  created:
    - "VroomXDriver/Core/DataManager.swift"
    - "VroomXDriver/Core/PendingActionsQueue.swift"
    - "VroomXDriver/Core/InspectionUploadQueue.swift"
    - "VroomXDriver/Views/Shared/OfflineBanner.swift"
    - "VroomXDriver/Views/Shared/ErrorBannerView.swift"
    - "VroomXDriver/Views/Shared/LoadingView.swift"
  modified:
    - "VroomXDriver/Core/NetworkMonitor.swift"

key-decisions:
  - "NetworkMonitor.shared singleton added for DataManager and queue access"
  - "@MainActor on DataManager for safe @Published property updates"
  - "Combine sink on NetworkMonitor.$isConnected for auto-reconnect queue processing"
  - "AnyJSON for Supabase update dictionaries (SDK requirement for dynamic columns)"
  - "ISO8601DateFormatter for all timestamp mutations"

patterns-established:
  - "DataManager.shared as the single source of truth for all driver data"
  - "PendingActionsQueue.shared.enqueue() pattern for offline mutations"
  - "InspectionUploadQueue.shared.enqueue() pattern for media uploads"
  - "OfflineBanner as .safeAreaInset or .overlay at top of every main view"

duration: 3min
completed: 2026-02-12
---

# Phase 6 Plan 04: Data Layer + Offline Queues Summary

**DataManager with Supabase PostgREST fetch/cache/Realtime, actor-based offline mutation queue with UserDefaults persistence, inspection media upload queue with exponential backoff, and 3 shared UI components (OfflineBanner, ErrorBannerView, LoadingView)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-12T10:41:08Z
- **Completed:** 2026-02-12T10:44:25Z
- **Tasks:** 2/2
- **Files created:** 6
- **Files modified:** 1

## Accomplishments

- DataManager singleton with 5 fetch methods (trips, orders, ordersForTrip, expenses, notifications), 5 mutation methods (updateOrderStatus, submitETA, createExpense, deleteExpense, markNotificationRead), Realtime subscriptions on 3 tables, and CacheManager integration
- PendingActionsQueue actor with UserDefaults persistence, max 5 retries, and action execution for all 5 mutation types
- InspectionUploadQueue actor with exponential backoff (5s, 10s, 20s, 40s, 80s... capped at 15min), Supabase Storage upload, and database record updates
- OfflineBanner with amber wifi.slash styling and slide animation
- ErrorBannerView with red dismissable banner and optional retry button
- LoadingView with centered ProgressView and brandPrimary tint

## Task Commits

Each task was committed atomically:

1. **Task 1: Build DataManager with fetch, cache, Realtime, and mutations** - `a0d1491` (feat)
2. **Task 2: Build offline queues and shared UI components** - `3890210` (feat)

## Files Created/Modified

- `VroomXDriver/Core/DataManager.swift` - @MainActor ObservableObject singleton with fetch, cache, Realtime, and offline-aware mutations
- `VroomXDriver/Core/PendingActionsQueue.swift` - Actor-based offline mutation queue with UserDefaults persistence and 5 action handlers
- `VroomXDriver/Core/InspectionUploadQueue.swift` - Actor-based media upload queue with exponential backoff and Supabase Storage integration
- `VroomXDriver/Views/Shared/OfflineBanner.swift` - Amber wifi.slash banner shown when NetworkMonitor.isConnected == false
- `VroomXDriver/Views/Shared/ErrorBannerView.swift` - Red dismissable error banner with optional retry button
- `VroomXDriver/Views/Shared/LoadingView.swift` - Centered ProgressView with brandPrimary tint and optional message
- `VroomXDriver/Core/NetworkMonitor.swift` - Added static let shared singleton for DataManager/queue access

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Added `NetworkMonitor.shared` singleton | DataManager and queues reference it; was missing from plan 02 |
| `@MainActor` on DataManager | Required for safe @Published property updates from async contexts |
| `AnyJSON` dictionary for Supabase updates | SDK requires AnyJSON for dynamic update columns (status + timestamps) |
| Combine sink for network reconnection | Processes pending queue and refreshes data when connectivity restored |
| ISO8601DateFormatter for all timestamps | Matches Supabase/PostgreSQL timestamp format |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added NetworkMonitor.shared singleton**
- **Found during:** Task 1
- **Issue:** DataManager and PendingActionsQueue reference `NetworkMonitor.shared` but NetworkMonitor had no static shared property
- **Fix:** Added `static let shared = NetworkMonitor()` to NetworkMonitor class
- **Files modified:** VroomXDriver/Core/NetworkMonitor.swift
- **Commit:** 3890210

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DataManager.shared ready for all view consumption (trips, orders, expenses, notifications)
- PendingActionsQueue handles offline mutations for all 5 mutation types
- InspectionUploadQueue ready for inspection photo/video uploads
- Shared UI components ready for use in all subsequent view plans
- No blockers for any downstream plan

---
*Phase: 06-ios-driver-app*
*Completed: 2026-02-12*
