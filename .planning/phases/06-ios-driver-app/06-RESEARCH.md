# Phase 6: iOS Driver App - Research

**Researched:** 2026-02-12
**Domain:** iOS native app (SwiftUI), Supabase Swift SDK, multi-tenant mobile auth, vehicle inspection workflows, offline-first architecture
**Confidence:** HIGH

## Summary

This phase builds a fresh SwiftUI iOS driver app that connects to the existing VroomX multi-tenant Supabase backend. The Horizon Star "LuckyCabbage Driver App" serves as a proven reference codebase with 50+ Swift files covering inspections, BOL generation, caching, and photo/video upload queues. The VroomX app must adapt these patterns to a multi-tenant architecture (UUID IDs, RLS with tenant_id in JWT, Supabase Auth instead of PIN-based login).

The Supabase Swift SDK (v2.41.1, released Feb 6, 2026) provides Auth, PostgREST, Storage, Realtime, and Functions modules via Swift Package Manager. The Horizon Star app uses raw URLSession HTTP calls against the Supabase REST API. The VroomX app should use the official Supabase Swift SDK for auth, database, storage, and realtime -- replacing the 1,260-line hand-rolled SupabaseService.

The critical architectural difference is identity: Horizon Star uses integer IDs and PIN-based login hitting a `drivers` table directly. VroomX uses UUID IDs, Supabase Auth (email OTP), and JWT claims with `tenant_id` in `app_metadata`. Every model struct must change from `Int` IDs to `UUID` (or `String`). RLS enforces tenant isolation automatically, so the app does not need to pass `tenant_id` in queries -- but the driver must be an authenticated Supabase Auth user with correct `app_metadata`.

**Primary recommendation:** Use the official `supabase-swift` SDK (v2.41.1) for all backend communication. Adapt Horizon Star's proven UI patterns (inspection flow, BOL generation, upload queue) but rebuild the data layer from scratch using the SDK's type-safe APIs. Keep Horizon's `UserDefaults`-based `CacheManager` approach for offline support rather than migrating to SwiftData -- the caching needs are simple key-value storage of JSON, not relational.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| supabase-swift | 2.41.1 | Supabase client (Auth + DB + Storage + Realtime) | Official SDK, active development, Swift-native async/await |
| SwiftUI | iOS 17+ | UI framework | Decision locked, native performance for camera/GPS |
| LocalAuthentication | System | Biometric auth (Face ID / Touch ID) | Apple's only API for biometrics, no alternative |
| UIGraphicsPDFRenderer | System | PDF generation (BOL, settlements) | System framework, no third-party dependency needed |
| CoreLocation | System | GPS for inspections | System framework for location services |
| AVFoundation | System | Camera/video capture | System framework for media capture |
| Network (NWPathMonitor) | System | Connectivity monitoring | Replaces Horizon's URL-ping approach |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| KeychainAccess | 4.2.2 | Secure token storage | Store auth tokens and PIN securely (not UserDefaults) |
| Swift Concurrency (actors) | System | Thread-safe token refresh | Serialize auth token operations (see PITFALLS MOD-10) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| supabase-swift SDK | Raw URLSession (Horizon pattern) | SDK provides type safety, automatic token refresh, realtime channels; raw HTTP gives full control but requires 1,200+ lines of boilerplate |
| UserDefaults caching | SwiftData | SwiftData is more powerful but overkill for simple JSON cache; UserDefaults is proven in Horizon codebase |
| KeychainAccess | Raw Security framework | KeychainAccess provides a clean Swift API over the verbose C-based Keychain API |
| APNs direct | Firebase Cloud Messaging | FCM adds a dependency but simplifies cross-platform if Android comes later; APNs direct is simpler for iOS-only |

### Installation

```
// In Xcode: File > Add Package Dependencies
// URL: https://github.com/supabase/supabase-swift.git
// Version: from 2.41.0

// Package.swift dependency:
.package(url: "https://github.com/supabase/supabase-swift.git", from: "2.41.0")
```

## Architecture Patterns

### Recommended Project Structure

```
VroomXDriver/
├── VroomXDriverApp.swift          # App entry point, environment setup
├── Config.swift                    # Supabase URL + anon key (NOT service role)
├── Info.plist                      # NSFaceIDUsageDescription, NSCameraUsageDescription, NSLocationWhenInUseUsageDescription
│
├── Core/
│   ├── SupabaseManager.swift       # Singleton: Supabase client init, auth state
│   ├── AuthManager.swift           # Login, logout, token refresh, biometric unlock
│   ├── CacheManager.swift          # Offline storage (UserDefaults-based, adapted from Horizon)
│   ├── NetworkMonitor.swift        # NWPathMonitor wrapper for connectivity state
│   ├── PendingActionsQueue.swift   # Offline mutation queue with retry
│   └── InspectionUploadQueue.swift # Actor-based media upload queue (adapted from Horizon)
│
├── Models/
│   ├── Driver.swift                # UUID-based driver model
│   ├── Trip.swift                  # UUID-based trip model
│   ├── Order.swift                 # UUID-based order model with all VroomX fields
│   ├── Expense.swift               # Trip expense model
│   ├── Inspection.swift            # Vehicle inspection + photos + videos + damages
│   ├── Notification.swift          # Driver notification model
│   ├── Settlement.swift            # Calculated settlement data
│   └── Enums.swift                 # OrderModule, InspectionStep, DamageType, PhotoType, etc.
│
├── Theme/
│   ├── ThemeManager.swift          # Dark/light mode state (@AppStorage)
│   ├── Colors.swift                # VroomX brand color palette (NOT Horizon green)
│   └── Typography.swift            # Font scale definitions
│
├── Views/
│   ├── Auth/
│   │   └── LoginView.swift         # Email OTP login with biometric unlock
│   │
│   ├── Main/
│   │   ├── MainTabView.swift       # 5-tab navigation (Home, Trips, Earnings, Messages, Profile)
│   │   └── ContentView.swift       # Root: LoginView vs MainTabView
│   │
│   ├── Home/
│   │   ├── HomeView.swift          # Greeting, stats, module tabs, order cards
│   │   ├── OrderCardView.swift     # Reusable order card component
│   │   └── ModuleTabsView.swift    # Pickup/Delivery/Completed/Archived segmented control
│   │
│   ├── Orders/
│   │   ├── OrderDetailView.swift   # Full order detail with map, ETA, timeline, files
│   │   ├── TimelineView.swift      # 7-step delivery progress timeline
│   │   ├── ETAButton.swift         # ETA submission with DatePicker
│   │   ├── MapLinkButton.swift     # Open address in Apple/Google Maps
│   │   └── FileManagementGrid.swift # 2-col files grid
│   │
│   ├── Trips/
│   │   ├── TripsView.swift         # Assigned trip list
│   │   ├── TripDetailView.swift    # Trip detail with orders, financials, expenses
│   │   └── AllTripsView.swift      # Trip history
│   │
│   ├── Inspection/
│   │   ├── InspectionView.swift         # 6-step flow controller
│   │   ├── InspectionPhotoView.swift    # Photo capture (7 required + 5 optional)
│   │   ├── InspectionVideoCaptureView.swift # Video walkthrough
│   │   ├── ExteriorInspectionView.swift # SVG damage diagram (5 views, 5 damage types)
│   │   ├── InspectionNotesView.swift    # Odometer, conditions, notes
│   │   ├── DriverReviewView.swift       # Driver sign-off
│   │   ├── CustomerReviewView.swift     # Customer verification flow
│   │   ├── CustomerSignOffView.swift    # Customer signature capture
│   │   ├── SignaturePadView.swift       # Drawing signature component
│   │   ├── VehicleDiagrams.swift        # SVG vehicle outlines (sedan, SUV, pickup, van, minivan)
│   │   └── VehicleDiagramView.swift     # Interactive damage marker placement
│   │
│   ├── BOL/
│   │   ├── BOLGenerator.swift      # PDF generation (2-page BOL with diagrams)
│   │   ├── BOLPreviewView.swift    # PDF preview + email/share
│   │   └── PDFGenerator.swift      # Settlement PDF + shared PDF utilities
│   │
│   ├── Earnings/
│   │   ├── EarningsView.swift           # Hero card, breakdown, bar chart, payment history
│   │   └── SettlementDetailView.swift   # Pay period detail with PDF/CSV export
│   │
│   ├── Messages/
│   │   └── MessagesView.swift      # Dispatch notifications, message history
│   │
│   ├── Profile/
│   │   └── ProfileView.swift       # Driver stats, theme toggle, preferences, sign out
│   │
│   └── Shared/
│       ├── OfflineBanner.swift     # "Offline -- showing cached data" banner
│       ├── ErrorBannerView.swift   # Inline error with retry
│       ├── LoadingView.swift       # Standard loading indicator
│       └── ContactActionSheet.swift # Call/SMS/Copy number actions
│
└── Assets.xcassets/
    ├── Colors/                     # Adaptive color sets (dark/light)
    └── Images/                     # Vehicle diagram images, app icon
```

### Pattern 1: Supabase Client Initialization with Multi-Tenant Auth

**What:** Initialize the Supabase Swift client with the VroomX project URL and anon key. Auth tokens carry tenant_id in app_metadata via the Custom Access Token Hook (already deployed in migration 00001).

**When to use:** App startup, single client instance shared app-wide.

**Example:**
```swift
// Source: https://supabase.com/docs/reference/swift/installing
import Supabase

class SupabaseManager {
    static let shared = SupabaseManager()

    let client: SupabaseClient

    private init() {
        client = SupabaseClient(
            supabaseURL: URL(string: Config.supabaseURL)!,
            supabaseKey: Config.supabaseAnonKey
        )
    }
}
```

The VroomX `custom_access_token_hook` (migration 00001) already injects `tenant_id`, `role`, `plan`, and `subscription_status` into every JWT. When the driver logs in via email OTP, their JWT automatically contains their tenant context. All Supabase queries through the SDK are then scoped by RLS.

### Pattern 2: Email OTP Authentication (Replacing Horizon's PIN Login)

**What:** VroomX uses Supabase Auth email OTP. The driver enters their email, receives a 6-digit code, verifies it. After initial auth, enable biometric (Face ID/Touch ID) for quick re-access.

**When to use:** Login flow, session restore.

**Example:**
```swift
// Send OTP
try await SupabaseManager.shared.client.auth.signInWithOTP(email: email)

// Verify OTP
try await SupabaseManager.shared.client.auth.verifyOTP(
    email: email,
    token: otpCode,
    type: .email
)

// Get current session (includes JWT with tenant_id)
let session = try await SupabaseManager.shared.client.auth.session

// Access tenant_id from JWT claims
// The SDK handles token refresh automatically
```

### Pattern 3: Database Queries with Type-Safe Models

**What:** Use the Supabase Swift SDK's PostgREST client for all CRUD operations. Models must use UUID (String) IDs to match VroomX schema.

**When to use:** All data fetching and mutations.

**Example:**
```swift
// Fetch trips for the current driver
struct Trip: Codable, Identifiable {
    let id: String  // UUID as String
    let tenant_id: String
    let trip_number: String?
    let driver_id: String
    let truck_id: String
    let status: String  // planned, in_progress, at_terminal, completed
    let start_date: String
    let end_date: String
    let total_revenue: Double?
    // ... other fields
}

// RLS automatically filters by tenant_id from JWT
let trips: [Trip] = try await SupabaseManager.shared.client
    .from("trips")
    .select()
    .eq("driver_id", value: driverId)
    .order("start_date", ascending: false)
    .execute()
    .value
```

### Pattern 4: Storage Upload for Inspection Media

**What:** Upload inspection photos and videos to Supabase Storage buckets. Use the upload queue actor pattern from Horizon Star for reliability.

**When to use:** Inspection photo capture, video recording.

**Example:**
```swift
// Upload a photo to storage
let photoData = image.jpegData(compressionQuality: 0.8)!
let path = "inspections/\(inspectionId)/photos/\(photoType).jpg"

try await SupabaseManager.shared.client.storage
    .from("inspection-media")
    .upload(path: path, file: photoData, options: .init(contentType: "image/jpeg"))

// Get public URL
let publicURL = try SupabaseManager.shared.client.storage
    .from("inspection-media")
    .getPublicURL(path: path)
```

### Pattern 5: Realtime Subscriptions for Live Updates

**What:** Subscribe to order and trip changes via Supabase Realtime. When dispatch updates an order status from the web dashboard, the driver app reflects it immediately.

**When to use:** Home screen, trip detail, order detail.

**Example:**
```swift
// Subscribe to order changes for the current driver's trips
let channel = SupabaseManager.shared.client.realtime.channel("driver-orders")

let changes = channel.postgresChange(
    AnyAction.self,
    schema: "public",
    table: "orders"
)

await channel.subscribe()

for await change in changes {
    // Refresh relevant data
    await refreshOrders()
}
```

### Pattern 6: Biometric Unlock After Initial Login

**What:** After successful email OTP login, offer Face ID/Touch ID setup. Store encrypted session token in Keychain. On subsequent launches, authenticate biometrically and restore the Supabase session.

**When to use:** App launch after initial authentication.

**Example:**
```swift
import LocalAuthentication

func authenticateWithBiometrics() async -> Bool {
    let context = LAContext()
    var error: NSError?

    guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
        return false
    }

    do {
        let success = try await context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: "Unlock VroomX Driver"
        )
        if success {
            // Restore session from Keychain
            // The Supabase SDK handles token refresh automatically
        }
        return success
    } catch {
        return false
    }
}
```

### Anti-Patterns to Avoid

- **Integer IDs in models:** VroomX uses UUIDs. Every model ID must be `String` (UUID), not `Int`. This is the single biggest migration gotcha from Horizon Star code.
- **Raw HTTP calls for standard CRUD:** Use the Supabase Swift SDK, not hand-rolled URLSession. The SDK handles auth header injection, token refresh, retry, and type decoding.
- **Storing auth tokens in UserDefaults:** Use Keychain for auth tokens and session data. UserDefaults is fine for cache data but not for security-sensitive tokens.
- **Passing tenant_id in queries:** RLS handles tenant isolation automatically via the JWT. Do NOT add `.eq("tenant_id", ...)` to iOS queries -- it is redundant and exposes the tenant_id to the client unnecessarily.
- **Hardcoding Horizon Star branding:** This is VroomX. New color palette, new company name in BOL header, new app icon. Do not copy Horizon's green (#22c55e) or company details.
- **Forking Horizon Star code directly:** Fresh codebase is a locked decision. Study Horizon patterns, adapt them, do NOT copy-paste 50 files and try to refactor.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Supabase auth/token management | Custom URLSession auth layer | `supabase-swift` SDK Auth module | SDK handles token refresh, session persistence, OTP flows automatically |
| Realtime WebSocket connection | Custom WebSocket with heartbeat | `supabase-swift` Realtime module | SDK manages reconnection, channel subscriptions, heartbeat |
| File uploads with retry | Custom upload manager | `supabase-swift` Storage + Horizon's upload queue pattern | SDK handles auth headers; queue pattern handles offline/retry |
| PDF generation | Third-party PDF library | `UIGraphicsPDFRenderer` (system) | System framework is sufficient; Horizon's BOLGenerator proves the pattern |
| Biometric auth | Custom biometric flow | `LocalAuthentication` framework | Apple's standard, 10 lines of code with async/await |
| Network monitoring | URL ping (Horizon pattern) | `NWPathMonitor` (Network framework) | System API, event-driven, battery efficient |
| Keychain access | Raw Security framework calls | `KeychainAccess` library | Clean Swift API over verbose C-based Keychain |
| Vehicle diagram SVGs | Custom drawing code | Adapt Horizon's `VehicleDiagrams.swift` with pre-rendered images | Horizon already has sedan/SUV/pickup/van/minivan diagrams as asset images |

**Key insight:** The Horizon Star codebase already solved the hardest problems (inspection flow, damage diagrams, BOL PDF, upload queue with retry). The VroomX app's challenge is adapting these to the official Supabase SDK and multi-tenant architecture, not reinventing them.

## Common Pitfalls

### Pitfall 1: Integer ID vs UUID Mismatch

**What goes wrong:** Copying Horizon Star model structs with `let id: Int` and using them against VroomX tables that have `id UUID PRIMARY KEY`. Decoding fails silently or crashes at runtime.

**Why it happens:** Horizon Star's Supabase project uses auto-increment integer IDs. VroomX uses `gen_random_uuid()` UUIDs. Every single model in the Horizon codebase has `let id: Int`.

**How to avoid:** Define ALL model IDs as `let id: String` in VroomX. When creating records, omit the `id` field (let the database generate it). When querying, the UUID is returned as a string in JSON.

**Warning signs:** JSON decoding errors like "Expected to decode Int but found a string" at runtime.

### Pitfall 2: Auth Token Not Refreshed Before Requests

**What goes wrong:** The Supabase JWT expires (default 1 hour). If the app is backgrounded for >1 hour and then makes a request, the expired token causes a 401. The user sees "unauthorized" errors.

**Why it happens:** The Supabase Swift SDK handles token refresh automatically for its own client calls. But if you make any raw URLSession calls (e.g., for custom endpoints), you must manually ensure the token is fresh.

**How to avoid:** Use the SDK for all Supabase operations. If raw calls are needed, get the current session before each call: `let session = try await client.auth.session`. Use a Swift actor to serialize token refresh operations (prevents concurrent refresh race conditions).

**Warning signs:** Intermittent 401 errors after the app has been backgrounded.

### Pitfall 3: Driver Account Linking (Auth User to Driver Record)

**What goes wrong:** A Supabase Auth user logs in successfully but has no corresponding `drivers` record. The app shows an empty state because there are no trips, orders, or data for this auth user.

**Why it happens:** In VroomX, `drivers.id` is a UUID and there is no `auth_user_id` column on the drivers table. The web dashboard creates driver records when admin adds a driver. The driver may not yet have a Supabase Auth account, or the auth account email may not match the driver record email.

**How to avoid:** Establish a linking strategy BEFORE building the app:
1. **Option A (recommended):** Add an `auth_user_id UUID REFERENCES auth.users(id)` column to `drivers` table. When a driver first logs into the app, match by email and set `auth_user_id`. All subsequent queries filter by `auth_user_id`.
2. **Option B:** Match by email. Query `drivers` where `email = authenticated_user_email`. Fragile if emails change.
3. Add a migration to support whichever approach is chosen.

**Warning signs:** Driver logs in successfully but sees "No trips found" despite having trips in the web dashboard.

### Pitfall 4: Missing Database Tables for Inspection Workflow

**What goes wrong:** The iOS app tries to create vehicle_inspections, inspection_photos, inspection_damages, inspection_videos records, but these tables do not exist in VroomX's schema. VroomX migrations (00001-00005) cover tenants, memberships, orders, drivers, trucks, brokers, trips, trip_expenses, payments, and invites -- but NOT inspection-related tables.

**Why it happens:** Horizon Star's inspection tables exist in Horizon's separate Supabase project. VroomX has not yet added inspection tables.

**How to avoid:** A new migration (00006) must create: `vehicle_inspections`, `inspection_photos`, `inspection_videos`, `inspection_damages`, `order_attachments`, and `driver_notifications` tables with `tenant_id` columns and RLS policies matching VroomX patterns. This migration is a PREREQUISITE for the iOS app.

**Warning signs:** 404 or "relation does not exist" errors when the app tries to create inspections.

### Pitfall 5: VroomX Orders Schema Differs from Horizon Star

**What goes wrong:** The iOS app code expects Horizon Star's order fields (e.g., `delivery_status`, `local_fee`, `driver_paid_status`, `pickup_sequence`, `delivery_sequence`) but VroomX's orders table has different columns (`status` enum instead of `delivery_status`, different financial fields, no sequence columns).

**Why it happens:** VroomX was designed as a new multi-tenant system with different schema decisions. The orders table (migration 00002) has: `status` (enum: new/assigned/picked_up/delivered/invoiced/paid/cancelled), `pickup_location`, `pickup_city`, `pickup_state`, `pickup_zip`, `pickup_contact_name`, `pickup_contact_phone`, `delivery_location/city/state/zip/contact_name/contact_phone`, `revenue`, `carrier_pay`, `broker_fee`, `payment_type` (enum), `vehicle_color`, `pickup_date`, `delivery_date`, `actual_pickup_date`, `actual_delivery_date`.

**How to avoid:** Build VroomX models from the ACTUAL VroomX schema (migrations 00002 + 00003), not from Horizon Star's models. Map VroomX's `status` enum to the delivery progress timeline. Add any missing columns via migration.

**Warning signs:** Compile-time errors when trying to use non-existent fields, or runtime JSON decoding failures.

### Pitfall 6: Push Notification Token Storage Without Tenant Context

**What goes wrong:** Device push tokens are stored globally. When a driver switches tenants (unlikely but possible in multi-tenant), notifications from the old tenant still arrive.

**Why it happens:** Push tokens are device-specific, not tenant-specific. The notification dispatch system needs to know which tenant's notifications to send to which device token.

**How to avoid:** Store push tokens in a `device_tokens` table with `tenant_id`, `driver_id`, `device_token`, `platform`, `last_active_at`. On login, register the token. On logout, deregister. On tenant switch, re-register.

**Warning signs:** Receiving notifications for the wrong tenant after switching accounts.

### Pitfall 7: Offline Cache Not Cleared on Logout/Tenant Switch

**What goes wrong:** Driver A logs out. Driver B logs in on the same device. Driver B sees Driver A's cached trips, orders, and earnings because the cache was not cleared.

**Why it happens:** The CacheManager stores data keyed by generic keys ("cached_trips") not by driver/tenant. Horizon Star has this same vulnerability.

**How to avoid:** Clear ALL cached data on logout: `CacheManager.shared.clearAllCache()`. Also clear Keychain tokens. Also clear any pending upload queue items. When the new driver logs in, start with a clean state.

**Warning signs:** Data from another driver visible after logout/login.

## Code Examples

### VroomX Order Model (From Actual Schema)

```swift
// Source: VroomX migration 00002_core_entities.sql + 00003_trips_and_dispatch.sql
struct VroomXOrder: Codable, Identifiable {
    let id: String                      // UUID
    let tenant_id: String               // UUID
    let order_number: String?
    let broker_id: String?              // UUID
    let driver_id: String?              // UUID
    let trip_id: String?                // UUID (from migration 00003)

    // Vehicle
    let vehicle_vin: String?
    let vehicle_year: Int?
    let vehicle_make: String?
    let vehicle_model: String?
    let vehicle_type: String?
    let vehicle_color: String?

    // Status
    let status: String                  // new, assigned, picked_up, delivered, invoiced, paid, cancelled

    // Pickup
    let pickup_location: String?
    let pickup_city: String?
    let pickup_state: String?
    let pickup_zip: String?
    let pickup_contact_name: String?
    let pickup_contact_phone: String?
    let pickup_date: String?            // DATE

    // Delivery
    let delivery_location: String?
    let delivery_city: String?
    let delivery_state: String?
    let delivery_zip: String?
    let delivery_contact_name: String?
    let delivery_contact_phone: String?
    let delivery_date: String?          // DATE

    // Actual dates
    let actual_pickup_date: String?     // TIMESTAMPTZ
    let actual_delivery_date: String?   // TIMESTAMPTZ

    // Financial
    let revenue: Double?
    let carrier_pay: Double?
    let broker_fee: Double?
    let payment_type: String?           // COD, COP, CHECK, BILL, SPLIT

    let notes: String?
    let created_at: String?
    let updated_at: String?

    // Computed
    var vehicleDescription: String {
        let year = vehicle_year != nil ? String(vehicle_year!) : ""
        let make = vehicle_make ?? ""
        let model = vehicle_model ?? ""
        return "\(year) \(make) \(model)".trimmingCharacters(in: .whitespaces)
    }

    var pickupFullAddress: String {
        [pickup_location, pickup_city, pickup_state, pickup_zip]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
    }

    var deliveryFullAddress: String {
        [delivery_location, delivery_city, delivery_state, delivery_zip]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
    }
}
```

### VroomX Trip Model (From Actual Schema)

```swift
// Source: VroomX migration 00003_trips_and_dispatch.sql
struct VroomXTrip: Codable, Identifiable {
    let id: String                      // UUID
    let tenant_id: String               // UUID
    let trip_number: String?
    let driver_id: String               // UUID
    let truck_id: String                // UUID
    let status: String                  // planned, in_progress, at_terminal, completed
    let start_date: String              // DATE
    let end_date: String                // DATE
    let carrier_pay: Double?
    let total_revenue: Double?
    let total_broker_fees: Double?
    let driver_pay: Double?
    let total_expenses: Double?
    let net_profit: Double?
    let order_count: Int?
    let origin_summary: String?
    let destination_summary: String?
    let notes: String?
    let created_at: String?
    let updated_at: String?
}
```

### Supabase Auth Email OTP Flow

```swift
// Source: https://supabase.com/docs/reference/swift/introduction
import Supabase

class AuthManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentDriver: VroomXDriver?
    @Published var error: String?

    private let supabase = SupabaseManager.shared.client

    func sendOTP(email: String) async throws {
        try await supabase.auth.signInWithOTP(email: email)
    }

    func verifyOTP(email: String, code: String) async throws {
        let session = try await supabase.auth.verifyOTP(
            email: email,
            token: code,
            type: .email
        )

        // Session JWT now contains tenant_id in app_metadata
        // Fetch the driver record linked to this auth user
        await fetchDriverRecord(authUserId: session.user.id.uuidString)
    }

    private func fetchDriverRecord(authUserId: String) async {
        do {
            // Query drivers by auth_user_id (requires migration to add this column)
            let drivers: [VroomXDriver] = try await supabase
                .from("drivers")
                .select()
                .eq("auth_user_id", value: authUserId)
                .execute()
                .value

            await MainActor.run {
                self.currentDriver = drivers.first
                self.isAuthenticated = drivers.first != nil
            }
        } catch {
            await MainActor.run {
                self.error = "Driver account not found. Contact your dispatcher."
            }
        }
    }
}
```

### Inspection Upload Queue (Actor Pattern from Horizon)

```swift
// Adapted from: Horizon Star InspectionUploadQueue.swift
// Key changes: UUID IDs instead of Int, tenant-aware storage paths

actor InspectionUploadQueue {
    static let shared = InspectionUploadQueue()

    struct QueueItem: Codable, Identifiable {
        let id: String                          // UUID
        let inspectionId: String                // UUID (was Int in Horizon)
        let mediaKind: MediaKind                // photo or video
        let slotKey: String
        let localPath: String
        let mimeType: String
        let byteSize: Int
        var attempts: Int
        var status: UploadStatus                // pending, uploading, failed
        var lastError: String?
        var nextRetryAt: Date?

        enum MediaKind: String, Codable { case photo, video }
        enum UploadStatus: String, Codable { case pending, uploading, failed }
    }

    private var items: [QueueItem] = []

    func enqueue(_ item: QueueItem) { /* ... */ }
    func nextReadyItem() -> QueueItem? { /* ... */ }
    func markCompleted(itemId: String) { /* ... */ }
    func markFailed(itemId: String, error: String) {
        // Exponential backoff: 5s, 10s, 20s ... capped at 15 min
        // Identical to Horizon's proven pattern
    }
}
```

## State of the Art

| Old Approach (Horizon) | Current Approach (VroomX) | When Changed | Impact |
|------------------------|---------------------------|--------------|--------|
| Raw URLSession HTTP calls | Supabase Swift SDK v2.41.1 | SDK matured in 2025 | Eliminates 1,200+ lines of HTTP boilerplate; type-safe; auto token refresh |
| Integer auto-increment IDs | UUID primary keys | VroomX schema design | All model structs must use `String` for IDs |
| Single-tenant (no RLS) | Multi-tenant with RLS + JWT claims | VroomX architecture | No `tenant_id` filtering in app code; RLS handles it |
| PIN code + email/password login | Supabase Auth email OTP + biometrics | VroomX security model | Proper auth system; PIN replaced by biometric quick-access |
| `apple.com` connectivity ping | `NWPathMonitor` | iOS 12+ (Network framework) | Event-driven, no polling, battery efficient |
| UserDefaults for auth tokens | Keychain for tokens, UserDefaults for cache | Security best practice | Prevents token theft if device backup is compromised |
| Hardcoded company details in BOL | Tenant-configurable company details | Multi-tenant requirement | BOL must pull company name/address from tenant record |

**Deprecated/outdated:**
- Horizon Star's `LocalizationManager` (EN/GE bilingual) -- VroomX is English-only for launch. Localization can be added later with standard SwiftUI `.localizedStringKey`.
- Horizon Star's `Config.swift` with hardcoded Supabase credentials for the Horizon project -- VroomX has its own Supabase project with different URL and keys.

## Schema Migration Requirements

The VroomX database needs the following NEW tables that do not yet exist (required before the iOS app can function):

### New Migration: 00006_driver_app_tables.sql

**Tables to create:**
1. `vehicle_inspections` -- with `tenant_id`, RLS, same structure as Horizon but UUID IDs
2. `inspection_photos` -- with `tenant_id`, RLS
3. `inspection_videos` -- with `tenant_id`, RLS
4. `inspection_damages` -- with `tenant_id`, RLS
5. `order_attachments` -- with `tenant_id`, RLS (for BOL PDFs, receipts)
6. `driver_notifications` -- with `tenant_id`, RLS (for push notification history)
7. `device_tokens` -- with `tenant_id`, for push notification targeting

**Columns to add to existing tables:**
1. `drivers` table: Add `auth_user_id UUID REFERENCES auth.users(id)` -- links Supabase Auth user to driver record
2. `drivers` table: Add `pin_hash TEXT` -- for PIN quick-access (hashed, not plaintext)
3. `orders` table: Add `pickup_eta TIMESTAMPTZ`, `delivery_eta TIMESTAMPTZ` -- for ETA submission from driver app

**Storage buckets to create:**
1. `inspection-media` -- photos and videos from inspections
2. `receipts` -- expense receipt photos
3. `bol-documents` -- generated BOL PDFs

## Discretionary Recommendations

### VroomX Brand Color Palette

**Recommendation:** Deep blue primary with electric accent, distinct from Horizon's green.

| Token | Dark Mode | Light Mode | Usage |
|-------|-----------|------------|-------|
| `brandPrimary` | `#3B82F6` (blue-500) | `#2563EB` (blue-600) | Primary actions, tab bar tint |
| `brandAccent` | `#8B5CF6` (violet-500) | `#7C3AED` (violet-600) | Highlights, badges |
| `brandSuccess` | `#22C55E` (green-500) | `#16A34A` (green-600) | Completed, positive |
| `brandWarning` | `#F59E0B` (amber-500) | `#D97706` (amber-600) | Pending, attention |
| `brandDanger` | `#EF4444` (red-500) | `#DC2626` (red-600) | Errors, destructive |
| `appBackground` | `#09090B` | `#F8FAFC` | Main background |
| `cardBackground` | `#18181B` | `#FFFFFF` | Card surfaces |
| `textPrimary` | `#FAFAFA` | `#0F172A` | Primary text |
| `textSecondary` | `#A1A1AA` | `#64748B` | Secondary text |

This palette is professional, works well in both light and dark modes, and is distinctly different from Horizon's green-centric design.

### Push Notification Strategy

**Recommendation:** Use Apple Push Notification service (APNs) directly via a Supabase Edge Function, rather than Firebase Cloud Messaging.

**Rationale:**
- iOS-only app (no Android planned) -- FCM adds unnecessary complexity
- APNs is the native service; FCM for iOS is just a wrapper around APNs anyway
- Supabase Edge Function can call the APNs HTTP/2 API directly using JWT-based authentication
- Fewer dependencies (no Firebase SDK, no GoogleService-Info.plist)

**Architecture:**
1. iOS app registers for push notifications, receives device token
2. App stores token in `device_tokens` table via Supabase
3. Web dashboard actions (trip assignment, status change) INSERT into `driver_notifications`
4. Database webhook triggers Edge Function on INSERT to `driver_notifications`
5. Edge Function reads device token from `device_tokens`, sends APNs push
6. iOS app receives push and refreshes relevant data

### Offline Sync Conflict Resolution

**Recommendation:** Last-write-wins with timestamp comparison, not merge.

**Rationale:**
- The driver app primarily writes status updates and ETA submissions -- these are "current state" values, not accumulated data
- If the driver updates an ETA offline and dispatch updates the same order online, the most recent write should win
- Merge conflicts (e.g., combining two different ETA values) do not make semantic sense for this domain

**Implementation:**
- Every pending action in the queue includes a `created_at` timestamp
- On sync, use Supabase's `.update()` which uses the database's `updated_at` trigger
- If a server-side update happened after the offline mutation was created, the server version wins (checked via `updated_at` comparison)
- Show a toast notification: "Some updates were superseded by newer changes from dispatch"

### First-Launch Onboarding for Drivers

**Recommendation:** Minimal -- 3 steps maximum.

1. **Welcome screen:** "Welcome to VroomX" with app features overview (1 static screen)
2. **Permission requests:** Camera, Location, Notifications (standard iOS permission flow)
3. **Biometric setup:** "Enable Face ID for quick access?" (optional, can skip)

No tutorial wizard. Drivers are trained by their dispatcher. The app should be intuitive enough from the tab navigation alone. Add contextual tips (small info popovers) on first use of complex features like the inspection flow.

## Open Questions

1. **Driver-to-Auth-User linking mechanism**
   - What we know: VroomX `drivers` table has no `auth_user_id` column. The web dashboard creates driver records. Drivers will log in via email OTP.
   - What's unclear: How does the system match a Supabase Auth user to a driver record? By email? By explicit admin linking?
   - Recommendation: Add `auth_user_id` column to drivers table. Web dashboard admin links a driver to their auth account (or auto-links on first matching-email login). This migration should be planned as a Phase 6 prerequisite.

2. **VroomX order status vs Horizon delivery_status**
   - What we know: VroomX uses a single `status` enum (new/assigned/picked_up/delivered/invoiced/paid/cancelled). Horizon uses a separate `delivery_status` field (nil/pending_pickup/awaiting_pickup/picked_up/in_transit/delivered).
   - What's unclear: Should the iOS app use VroomX's `status` field directly for the delivery timeline, or should we add a `delivery_status` column for finer-grained tracking?
   - Recommendation: Use VroomX's existing `status` enum for the timeline. Map: new/assigned = Pickup tab, picked_up = In Transit (Delivery tab), delivered = Completed tab. Add `delivery_status` column ONLY if the existing status enum is insufficient for the 7-step timeline.

3. **Earnings/Settlement data source**
   - What we know: VroomX trips have denormalized financial fields (total_revenue, total_broker_fees, driver_pay, total_expenses, net_profit). Horizon Star calculated settlements from raw order/expense data.
   - What's unclear: Are VroomX's denormalized trip financials kept up-to-date by the web dashboard? Can the iOS app rely on `trips.driver_pay` directly?
   - Recommendation: Use the denormalized fields on trips for display. If they are stale, recalculate from orders + expenses on the client (same as Horizon pattern).

4. **Storage bucket configuration**
   - What we know: Horizon Star uses `inspection-media` and `receipts` buckets. VroomX has not created any Storage buckets yet.
   - What's unclear: Should buckets be public or private? What RLS policies should apply?
   - Recommendation: Create private buckets with RLS policies that check tenant_id. Generate signed URLs for access. Photos/videos should not be publicly accessible.

## Sources

### Primary (HIGH confidence)
- VroomX migrations 00001-00005 (local files) -- actual database schema
- Horizon Star PROJECT.md (1,484 lines) -- proven implementation guide
- Horizon Star Swift source code (50+ files) -- working inspection, BOL, caching patterns
- [supabase-swift v2.41.1 releases](https://github.com/supabase/supabase-swift/releases) -- latest SDK version confirmed
- [Supabase Swift API Reference](https://supabase.com/docs/reference/swift/introduction) -- official documentation
- [Supabase iOS SwiftUI Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/ios-swiftui) -- official guide

### Secondary (MEDIUM confidence)
- [Supabase Push Notifications Guide](https://supabase.com/docs/guides/functions/examples/push-notifications) -- architecture for APNs/FCM via Edge Functions
- [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) -- JWT claims injection
- [Apple LocalAuthentication (Face ID/Touch ID)](https://www.hackingwithswift.com/books/ios-swiftui/using-touch-id-and-face-id-with-swiftui) -- biometric auth patterns
- [Swift Package Index: supabase-swift](https://swiftpackageindex.com/supabase/supabase-swift) -- platform compatibility confirmed

### Tertiary (LOW confidence)
- [SwiftData offline-first patterns](https://medium.com/@ashitranpura27/offline-first-swiftui-with-swiftdata-clean-fast-and-sync-ready-9a4faefdeedb) -- architecture options (not used, but researched)
- [Supabase community discussion on push notifications](https://github.com/orgs/supabase/discussions/13930) -- APNs vs FCM approaches

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- supabase-swift SDK is well-documented, Horizon patterns are proven
- Architecture: HIGH -- project structure follows established SwiftUI conventions, migration from Horizon patterns is well-understood
- Pitfalls: HIGH -- identified from direct comparison of Horizon Star schema vs VroomX schema
- Schema migration needs: HIGH -- verified against actual VroomX migration files
- Discretionary items (colors, push, offline): MEDIUM -- reasonable recommendations based on domain analysis

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (30 days -- supabase-swift SDK is actively developed, check for updates)
