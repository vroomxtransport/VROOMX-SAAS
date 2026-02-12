# Phase 6: iOS Driver App - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a full-featured iOS driver app (SwiftUI) that replicates all Horizon Star driver app functionality on the VroomX multi-tenant Supabase backend. Drivers can view trips, update order statuses, run 6-step vehicle inspections, generate BOLs, submit ETAs, track expenses, view earnings/settlements, and receive push notifications. This is the complete driver-facing mobile experience — web dashboard admin features are NOT in scope.

**Reference:** Horizon Star LLC Driver App (v3 redesign) at `/Users/reepsy/Desktop/OG TMS CLAUDE/Horizon Star LLC Driver App/`
- `PROJECT.md` — 1,484-line implementation guide with screen designs, data models, code samples
- `ui_concept_4_driver_app_v3.html` — Interactive HTML mockup of all v3 screens
- `LuckyCabbage Driver App/` — Swift source code for inspection, BOL, caching, Supabase integration

</domain>

<decisions>
## Implementation Decisions

### Feature scope — Full Horizon parity
- Include ALL Horizon Star driver app features, not just roadmap minimum
- Earnings/settlement views with PDF and CSV export
- ETA submission for pickup and delivery
- Messages/notifications from dispatch
- Video capture in inspection workflow (in addition to photos)
- Contact actions (call, SMS, copy number) for pickup/delivery contacts
- Theme support (light/dark mode)
- Settlement detail screen with trip breakdown

### App structure — 5-tab navigation (mirror Horizon)
- Home: greeting, quick stats, module tabs (Pickup/Delivery/Completed/Archived), order cards, quick actions
- Trips: assigned trip list → trip detail (route, financials, orders, status workflow)
- Earnings: pay period hero card, financial breakdown, payment history → settlement detail
- Messages: dispatch notifications, message history
- Profile: driver stats, theme toggle, preferences, cache/sync info, sign out

### Authentication
- Email/password login + PIN quick-access (same as Horizon)
- Multi-tenant: tenant_id in JWT via Custom Access Token Hook (VroomX pattern)
- Biometric unlock after initial PIN setup (Face ID / Touch ID)
- Session persistence — driver stays logged in until explicit sign out

### 6-step vehicle inspection workflow (copy Horizon exactly)
1. **Photo capture** — 7 required photos (odometer, front, left, right, rear, top, key/VIN) + 5 optional
2. **Video capture** — Full vehicle walkthrough video
3. **Exterior inspection** — Interactive SVG vehicle diagram (5 views: front, rear, left, right, top) with drag-to-place damage markers. 5 damage types: Scratch (orange, S), Dent (red, D), Chip (blue, C), Broken (purple, B), Missing (pink, M)
4. **Interior/Notes** — Odometer reading, interior condition, custom notes, GPS location + timestamp
5. **Driver review** — Driver reviews all data, signs digitally
6. **Customer sign-off** — Customer verifies condition, signs digitally, triggers BOL generation

### BOL generation and delivery
- Auto-generate PDF from inspection + order data
- Email delivery via Supabase Edge Function
- Option to email immediately after customer sign-off
- BOL accessible from order detail files grid

### Order status updates from the field
- Mark picked up → in transit → delivered
- Status changes sync to web dashboard in real-time via Supabase Realtime
- Delivery progress timeline (7 steps matching Horizon v3)

### Offline & connectivity
- Full offline support for inspection workflow and PDF generation
- CacheManager for local storage of trips, orders, expenses
- Pending actions queue — mutations queued when offline, sync on reconnect
- Supabase Realtime WebSocket for live updates when connected

### Expense tracking
- Per-trip expense entry (fuel, tolls, meals, repairs)
- Category selection with amount
- Receipt photo upload to Supabase Storage
- Expenses reflected in trip financial summary and settlement calculations

### Push notifications
- Trip assignment notifications
- Status change alerts
- Urgent dispatch messages

### Branding — VroomX (new, distinct from Horizon)
- Fresh VroomX color palette — NOT Horizon's green
- Professional dark mode as default, light mode alternative
- SF Symbols for iconography (iOS native)
- Typography consistent with iOS HIG

### Claude's Discretion
- VroomX brand color palette selection (professional, distinct from Horizon green)
- Exact typography scale and spacing
- Animation and transition details
- Error state designs
- Onboarding/first-launch experience for drivers
- Supabase Storage bucket naming
- Push notification service implementation (APNs vs Firebase)
- Exact offline sync conflict resolution strategy

</decisions>

<specifics>
## Specific Ideas

- "Copy from the Horizon TMS" — full feature parity with Horizon Star driver app v3
- Reference the interactive mockup at `ui_concept_4_driver_app_v3.html` for screen layouts and navigation flow
- Reference Horizon Swift source code for inspection workflow, vehicle diagram SVG, signature capture, BOL PDF generation, and offline caching patterns
- Reimplement in fresh SwiftUI codebase targeting VroomX multi-tenant Supabase backend (different schema from Horizon)
- Multi-tenant architecture: tenant_id in JWT, RLS on all tables — drivers can never see other tenants' data

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-ios-driver-app*
*Context gathered: 2026-02-12*
