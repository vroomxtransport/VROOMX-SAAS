---
phase: 06-ios-driver-app
plan: 12
subsystem: ios-messages-notifications
tags: [swift, swiftui, push-notifications, apns, unusernotificationcenter, badge, supabase]

requires:
  - phase: 06-03
    provides: "Auth flow, MainTabView shell, ContentView routing"
  - phase: 06-04
    provides: "DataManager (notifications array, markNotificationRead, fetchNotifications), SupabaseManager"

provides:
  - "NotificationManager singleton for APNs registration, device token storage, push handling"
  - "MessagesView with notification list, time-based sections, unread indicators"
  - "Badge count management for Messages tab"

affects:
  - "VroomXDriverApp.swift needs @StateObject NotificationManager injection (orchestrator wires post-Wave 3)"
  - "MainTabView needs MessagesView() replacement and .badge(notificationManager.unreadCount) (orchestrator wires)"
  - "AuthManager.logout() should call notificationManager.deregisterDeviceToken()"

tech-stack:
  added: []
  patterns:
    - "UNUserNotificationCenterDelegate for foreground/background push handling"
    - "NotificationCenter.default posts for cross-view navigation (navigateToTrip/Order)"
    - "nonisolated delegate methods with Task { @MainActor } bridge for concurrency"
    - "Time-based notification grouping (Today/This Week/Earlier)"

key-files:
  created:
    - VroomXDriver/Core/NotificationManager.swift
    - VroomXDriver/Views/Messages/MessagesView.swift
  modified:
    - VroomXDriver/Core/DataManager.swift

decisions:
  - id: notification-manager-singleton
    choice: "NotificationManager as @MainActor singleton with NSObject base"
    reason: "UNUserNotificationCenterDelegate requires NSObject; singleton ensures single delegate registration"
  - id: navigation-via-notification-center
    choice: "NotificationCenter.default posts for push-tap navigation"
    reason: "Decouples NotificationManager from view layer; views observe navigation events independently"
  - id: nonisolated-delegate-bridge
    choice: "nonisolated delegate methods with Task { @MainActor } for async work"
    reason: "UNUserNotificationCenterDelegate methods are non-isolated; bridge to MainActor for safe state updates"
  - id: local-badge-fallback
    choice: "updateBadgeFromLocal() as fallback for badge count"
    reason: "Avoids network round-trip when local notifications array is already fresh from Realtime"
  - id: driverId-visibility
    choice: "DataManager.driverId changed from private to private(set)"
    reason: "NotificationManager needs read access for badge count queries"

metrics:
  duration: "2m 29s"
  completed: "2026-02-12"
---

# Phase 06 Plan 12: Messages Tab + Push Notifications Summary

**Built NotificationManager (APNs registration, device token UPSERT, foreground/background handling, badge count) and MessagesView (time-grouped notification list with unread indicators, filter chips, tap-to-read navigation).**

## What Was Built

### Task 1: NotificationManager (ba0861d)

Built `VroomXDriver/Core/NotificationManager.swift` -- a `@MainActor` singleton that manages the full push notification lifecycle:

- **Permission**: `requestPermission()` requests `.alert, .badge, .sound` authorization, then calls `registerForRemoteNotifications()`
- **Device Token**: `handleDeviceToken(_:)` converts raw `Data` to hex string; `registerDeviceToken(driverId:)` UPSERTs to `device_tokens` table with tenant_id, driver_id, platform=ios
- **Deregistration**: `deregisterDeviceToken()` deletes token row on logout
- **Foreground**: `willPresent` delegate shows banner + sound + badge, refreshes DataManager data
- **Background Tap**: `didReceive` delegate parses payload, refreshes data, posts `navigateToTrip` / `navigateToOrder` / `showUrgentAlert` via NotificationCenter
- **Badge**: `updateBadgeCount()` queries unread notifications from Supabase; `updateBadgeFromLocal()` computes from cached array
- **Payload Parsing**: Extracts `notification_type`, `trip_id`, `order_id`, `message` from APNs userInfo

Also changed `DataManager.driverId` from `private` to `private(set)` so NotificationManager can access it for badge queries.

### Task 2: MessagesView (bcfd83a)

Built `VroomXDriver/Views/Messages/MessagesView.swift` with:

- **Notification List**: All `driver_notifications` sorted by `created_at` desc
- **Time Sections**: "Today", "This Week", "Earlier" groupings
- **NotificationRow**: Unread dot (brandPrimary), type icon with colored background, bold title if unread, 2-line body, relative time ("2h ago", "Yesterday", "Feb 10")
- **Filter Bar**: Horizontal scroll of filter chips -- All, Unread, Trips, Status
- **Tap Actions**: Marks as read, posts navigation notification if data contains trip_id/order_id
- **Mark All Read**: Toolbar button iterates unread notifications
- **Pull-to-refresh**: Reloads notifications + updates badge count
- **Empty State**: Message icon with "No messages yet" text
- **MessageFilter enum**: All/Unread/TripAssignment/StatusChange cases

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] DataManager.driverId visibility**
- **Found during:** Task 1
- **Issue:** `driverId` was `private` on DataManager, but NotificationManager needs it for badge count queries
- **Fix:** Changed to `private(set)` -- readable externally, only settable internally
- **Files modified:** VroomXDriver/Core/DataManager.swift
- **Commit:** ba0861d

**2. [Plan Constraint] Skipped MainTabView.swift and VroomXDriverApp.swift modifications**
- **Reason:** Orchestrator rules explicitly prohibit modifying MainTabView.swift or VroomXDriverApp.swift -- the orchestrator will wire all tabs and inject environment objects after Wave 3 completes
- **Impact:** MessagesView and NotificationManager are fully built and ready; they just need to be wired into MainTabView (replace placeholder) and VroomXDriverApp (inject as @StateObject)

## Wiring Instructions (for orchestrator post-Wave 3)

The following changes are needed to activate this plan's work:

1. **VroomXDriverApp.swift**: Add `@StateObject private var notificationManager = NotificationManager.shared`, inject as `.environmentObject(notificationManager)`, call `notificationManager.requestPermission()` in `.task` or `onAppear`
2. **MainTabView.swift**: Replace Messages tab placeholder with `MessagesView()`, add `.badge(notificationManager.unreadCount)` on Messages tab item
3. **AuthManager.logout()**: Call `await NotificationManager.shared.deregisterDeviceToken()` before clearing state

## Verification Results

| Criteria | Status |
|----------|--------|
| Push permission requested | Done -- requestPermission() requests alert/badge/sound |
| Device token stored in device_tokens | Done -- registerDeviceToken UPSERTs with driver_id/tenant_id |
| Device token deregistered on logout | Done -- deregisterDeviceToken() deletes by token |
| Foreground notifications show banner | Done -- willPresent returns .banner, .sound, .badge |
| Background tap navigates | Done -- didReceive posts navigateToTrip/navigateToOrder |
| Messages tab badge shows unread count | Done -- unreadCount published, updateBadgeCount() queries DB |
| Tapping notification marks as read | Done -- handleTap calls markNotificationRead |
| Notifications grouped by time period | Done -- Today/This Week/Earlier sections |

## Next Phase Readiness

No blockers. NotificationManager and MessagesView are self-contained and ready for wiring. The orchestrator needs to:
- Inject NotificationManager as environment object in VroomXDriverApp
- Replace Messages tab placeholder in MainTabView
- Add badge modifier to Messages tab
- Call deregisterDeviceToken in logout flow
