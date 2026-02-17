# VroomX — SaaS TMS for Vehicle Transport Carriers

## What This Is

VroomX is a self-service SaaS TMS (Transportation Management System) for vehicle transport carriers. Carriers sign up, pick a pricing tier, and immediately get a full dispatch operation: order management, trip building, driver/truck fleet management, billing/invoicing, and an iOS driver app for inspections and BOL generation.

Built from scratch as a modern multi-tenant platform, drawing on proven business logic from an in-house TMS (Horizon Star) that processes real transport operations daily.

## Core Value

A vehicle transport carrier can sign up and start dispatching loads within minutes — orders, trips, drivers, trucks, and billing all in one system with no setup calls or enterprise sales process.

## Target Market

- Small-to-mid-size vehicle transport carriers (1-50 trucks)
- Currently using spreadsheets, outdated software, or overpriced legacy TMS tools
- Need dispatch, driver management, billing, and mobile driver apps
- Want self-service — no enterprise sales calls

## Business Model

Monthly flat-rate subscription tiers:
- **Starter** — Solo operators / small fleets (1-5 trucks)
- **Pro** — Growing carriers (6-20 trucks)
- **Enterprise** — Large operations (20+ trucks, priority support)

## Requirements — Active (v1)

### Authentication & Tenancy (AUTH)
- Self-service signup with email/password
- Organization (tenant) creation during signup
- Invite team members (dispatchers) to organization
- Role-based access (admin, dispatcher, viewer)
- Session management with secure token handling

### Order Management (ORD)
- Create orders (broker, vehicle details, pickup/delivery locations, dates, payment type)
- Order statuses: PENDING → IN_TRANSIT → DELIVERED
- Payment types: COD, COP, CHECK, BILL, SPLIT
- Assign orders to trips
- Search/filter orders by status, broker, date range
- Order detail view with vehicle info, timeline, payment tracking

### Trip Management (TRIP)
- Create trips (truck + driver + date range)
- Assign multiple orders to a trip (multi-load)
- Trip statuses: PLANNED → IN_PROGRESS → COMPLETED
- Trip-level financial calculations (revenue, fees, driver cut, expenses, net profit)
- Support for company drivers (% cut) and owner-operators (dispatch fee %)

### Driver Management (DRV)
- Add/edit drivers (personal info, contact, financial details)
- Driver types: Company Driver, Owner-Operator
- Driver status: ACTIVE, INACTIVE
- Configurable driver cut % or dispatch fee %
- Driver earnings view (trip-by-trip breakdown)

### Truck/Fleet Management (FLT)
- Add/edit trucks (unit #, type, year/make/model/VIN, ownership)
- Truck types: 7-Car, 8-Car, 9-Car Hauler, Flatbed, Enclosed
- Truck status: ACTIVE, INACTIVE, MAINTENANCE
- Trailer assignment (pair trucks with trailers)

### Billing & Invoicing (BIL)
- Track order payment status (unpaid → invoiced → paid)
- Broker-level receivables aggregation
- Aging analysis (current, 1-30, 31-60, 61-90, 90+ days)
- Collection rate tracking
- Mark payments received with date

### iOS Driver App (APP)
- Driver login (PIN + email)
- Trip list and trip detail views
- Vehicle inspection flow (photos, damage markers, signatures)
- BOL generation and email
- Expense tracking per trip

### Subscription & Billing — Platform (SUB)
- Stripe integration for subscription management
- Tier selection during signup (Starter/Pro/Enterprise)
- Usage dashboard showing plan limits
- Upgrade/downgrade flow

### Onboarding & Self-Service (ONB)
- Guided setup wizard after signup (add first driver, truck, order)
- Sample data option for exploration
- In-app help tooltips for key workflows

## Requirements — Out of Scope (v1)

- Payroll/settlement PDFs — complex, add in v2
- Compliance module (CDL tracking, violations, claims) — v2
- Fuel tracking / IFTA tax reporting — v2
- Maintenance records — v2
- Chrome Extension (Central Dispatch importer) — v2
- Advanced analytics/executive dashboard — v2
- Real-time collaborative editing — v2
- White-label branding — not planned
- Android driver app — iOS only for v1
- Customer-facing portal — v2+

## Constraints

- **Multi-tenancy**: Row-Level Security in PostgreSQL from day 1 (every table has `tenant_id`)
- **Self-service**: No manual provisioning — signup creates tenant + admin user automatically
- **Mobile**: iOS only for v1 driver app
- **Payments**: Stripe for subscription billing
- **Simple deployment**: Netlify + Supabase (no K8s, no Docker in production)
- **Fresh codebase**: Not a fork of Horizon Star — reimplemented from scratch

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS | SSR, API routes, file-based routing, great SaaS ecosystem |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions + Realtime) | Proven in Horizon Star, built-in RLS for multi-tenancy, generous free tier |
| Multi-tenancy | PostgreSQL RLS with `tenant_id` on every table | Row-level isolation, no schema duplication, scales well |
| Auth | Supabase Auth (email/password + magic link) | Integrated with RLS, handles sessions/tokens |
| Payments | Stripe Checkout + Billing Portal + Webhooks | Industry standard, self-service flows, webhook provisioning |
| Mobile | SwiftUI (iOS) | Better native experience for inspections/camera, proven in Horizon Star app |
| Hosting | Netlify (web) + Supabase Cloud (backend) | Zero-ops, auto-scaling, generous free tiers |
| Monitoring | Sentry (errors) + PostHog (analytics) | Essential observability for SaaS |
| Email | Resend (transactional emails) | Simple API, good DX, affordable |

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Fresh codebase (not fork) | Horizon Star's single-file architecture won't scale for SaaS | Decided |
| Supabase for backend | Proven in Horizon Star, built-in RLS for multi-tenancy, generous free tier | Decided |
| Next.js App Router | SSR, API routes, file-based routing, great ecosystem for SaaS | Decided |
| Stripe for billing | Industry standard, self-service flows, webhooks for provisioning | Decided |
| SwiftUI for iOS (not React Native) | Better native experience for inspections/camera, proven in Horizon Star app | Decided |
| Monthly flat tiers | Simple pricing, predictable revenue, easy to communicate | Decided |
| VroomX branded (not white-label) | Simpler v1, build brand recognition first | Decided |
| 1-2 customers first | Validate product-market fit before scaling | Decided |

## Reference Material

The Horizon Star TMS at `/Users/reepsy/Desktop/OG TMS CLAUDE/` contains battle-tested business logic for:
- Trip financial calculations (revenue, broker fees, local fees, driver cut, expenses, net profit)
- Dual driver types (company driver % cut vs owner-operator dispatch fee %)
- Payment type handling (COD, COP, CHECK, BILL, SPLIT, LOCAL_COD)
- 6-step vehicle inspection workflow (photos → video → exterior → notes → driver review → customer sign-off)
- Aging analysis (current → 1-30 → 31-60 → 61-90 → 90+ days)
- BOL generation from inspection data

These workflows should be referenced during phase planning — not copied, but reimplemented properly in the new architecture.

## Design System — UI Polish (Implemented)

### Established Patterns

The landing page and dashboard use a cohesive dark-atmospheric design system with the following CSS classes and conventions:

**CSS Utility Classes** (defined in `src/app/globals.css`):
- `glass-card` — Frosted glass card with backdrop-blur, subtle border, layered box-shadow (light/dark variants)
- `glass-card-hover` — Hover lift with brand-glow box-shadow transition
- `shimmer-border` — Pseudo-element gradient border shimmer on hover
- `card-hover` — Simple translateY(-2px) hover lift
- `hero-grid-bg` — Background grid pattern with radial mask fade
- `hero-radial-glow` — Dual radial gradient glow orbs
- `animate-marquee` — Infinite horizontal scroll (30s), pauses on hover
- `marquee-fade-mask` — Gradient transparency on left/right edges for seamless marquee
- `animate-pulse-glow` — Pulsing brand-color box-shadow
- `animate-pulse-ring` — Expanding/fading ring animation (for alerts)
- `gradient-border-animated` — Rotating conic-gradient border via `border-rotate` keyframe
- `animate-shimmer` — Moving gradient highlight
- `animate-fade-up` — Opacity + translateY entrance animation
- `sidebar-noise` — Subtle SVG noise texture overlay

**Brand Colors** (oklch):
- Brand primary: `oklch(0.55 0.22 260)` (deep indigo-blue)
- Brand gradient: `from-[oklch(0.55_0.22_260)] to-[oklch(0.55_0.2_290)]`
- CSS vars: `--brand`, `--brand-glow`, `--brand-glow-lg`, `--brand-gradient`, `--brand-gradient-vivid`
- Accent palette: `--accent-blue`, `--accent-violet`, `--accent-amber`, `--accent-emerald` (each with `-bg` variant)

**Component Accent Patterns**:
- Testimonials: per-card accent colors (blue/violet/emerald) for left-border gradients, avatar rings, quote watermarks
- Pricing cards: per-tier accents (blue/brand/violet), Pro plan uses gradient border wrapper + "Most Popular" glow badge
- Activity feed: event-type color coding — order(blue), trip(amber), invoice(emerald), driver(violet), maintenance(red)
- Fleet pulse: gradient progress bars with glow shadow when fill > 50%, pulse-ring alert when capacity > 85%
- Loads pipeline: hover tooltips on segments, brand-color highlight on order numbers, left accent border on section headers

### Files Modified in Design Polish Pass

| File | What Changed |
|------|-------------|
| `src/app/globals.css` | Added marquee, border-rotate, pulse-ring keyframes + utility classes |
| `src/components/marketing/testimonials.tsx` | Glass cards, decorative quote watermarks, gradient left-borders, avatar rings |
| `src/components/marketing/pricing-teaser.tsx` | Vertical pricing cards, feature bullets, gradient Pro card, tier accents |
| `src/components/marketing/logo-strip.tsx` | Infinite marquee scroll, 10 carriers, fade masks, hover pause |
| `src/components/marketing/final-cta.tsx` | Atmospheric bg (grid + orbs), rotating gradient border, pulse-glow CTA |
| `src/components/marketing/problem-solution.tsx` | Fixed broken arrow, gradient connector, hover lift, stronger gradients |
| `src/app/(dashboard)/dashboard/_components/loads-pipeline.tsx` | Rounded segments, hover tooltips, table hover effects, brand highlights |
| `src/app/(dashboard)/dashboard/_components/fleet-pulse.tsx` | Gradient bars, glow shadows, pulse-ring alerts, trend indicators |
| `src/app/(dashboard)/dashboard/_components/activity-feed.tsx` | Color-coded dots/icons by type, gradient connector, time-group headers |

### Dashboard Widget Customization

Users can toggle dashboard widgets on/off via a "Customize" popover in the hero header. Preferences persist in localStorage via Zustand.

**Architecture**: The dashboard page remains a server component for data fetching. A `DashboardWidgets` client wrapper receives pre-rendered widgets as props and conditionally renders them based on store state. This avoids converting the page to a client component.

**Files**:
| File | Purpose |
|------|---------|
| `src/stores/dashboard-store.ts` | Zustand store with `persist` — tracks `visibleWidgets` (Record of 6 widget IDs → boolean), `toggleWidget()`, `resetDefaults()` |
| `src/app/(dashboard)/dashboard/_components/customize-dashboard.tsx` | Popover with `Switch` toggles for each widget + "Reset to Default" |
| `src/app/(dashboard)/dashboard/_components/dashboard-widgets.tsx` | Client wrapper — reads store, conditionally renders widgets, handles grid reflow |

**Widget IDs**: `statCards`, `loadsPipeline`, `revenueChart`, `fleetPulse`, `upcomingPickups`, `activityFeed`

**Storage key**: `vroomx-dashboard` (localStorage)

### Grid/List View Toggle (Drivers & Trucks)

Users can switch between a 3-column card grid and a compact list (table-row) view on the Drivers and Trucks pages. Preference persists per-section in localStorage via Zustand.

**Architecture**: A shared `ViewToggle` pill component and a `useViewStore` Zustand persist store manage independent `'grid' | 'list'` preferences for each section. List views use dedicated row components (`DriverRow`, `TruckRow`) that display the same data as their card counterparts in a single horizontal line.

**Files**:
| File | Purpose |
|------|---------|
| `src/components/shared/view-toggle.tsx` | Shared grid/list toggle pill (generalized from dispatch board/list toggle) |
| `src/stores/view-store.ts` | Zustand store with `persist` — tracks `views` (`Record<'drivers' \| 'trucks', 'grid' \| 'list'>`) |
| `src/app/(dashboard)/drivers/_components/driver-row.tsx` | Compact list row: name, status/type badges, phone, email, pay info, status switch + edit |
| `src/app/(dashboard)/trucks/_components/truck-row.tsx` | Compact list row: unit #, status/type/ownership badges, vehicle line, VIN, status select + edit |

**Storage key**: `vroomx-views` (localStorage)

## Security Hardening (Implemented)

### Security Headers

Production-grade HTTP security headers added to `next.config.ts`:
- **CSP**: Restricts script/style/connect/frame sources to app + Supabase + Stripe + PostHog
- **HSTS**: 2-year max-age with preload
- **X-Frame-Options**: DENY (clickjacking prevention)
- **X-Content-Type-Options**: nosniff
- **Referrer-Policy**: strict-origin-when-cross-origin
- **Permissions-Policy**: Disables camera, microphone, geolocation, browsing-topics

### Rate Limiting

In-memory token bucket rate limiter (`src/lib/rate-limit.ts`) integrated into the `authorize()` function via an optional `rateLimit` config parameter. Rate limits are per-user per-action.

| Tier | Limit | Actions |
|------|-------|---------|
| Strict (3-5/min) | Email sends, batch ops | `sendInvite`, `sendDriverAppInvite`, `batchCreateOrders`, `batchMarkPaid`, `seedSampleData`, `clearSampleData` |
| Moderate (30/min) | Entity creation | `createOrder`, `createTrip`, `createDriver`, `createTruck`, `createTrailer`, `createBroker`, `createFuelEntry`, `createMaintenanceRecord`, `createComplianceDoc`, `createLocalDrive`, `createTripExpense`, `recordPayment`, `createTask`, `createDocument`, `createCustomRole` |
| Chat (60/min) | Messages | `sendMessage` |
| Channel (10/min) | Chat channels | `createChannel` |
| FMCSA (10/min) | External API | FMCSA carrier lookup |

**Production note**: For multi-instance serverless, replace in-memory store with Upstash Redis.

### Input Validation (Zod Max Bounds)

All 16 Zod validation schemas updated with max-length/max-value constraints:
- String fields: `.max(200)` for names/labels, `.max(500)` for addresses/descriptions, `.max(5000)` for notes
- Numeric fields: `.max(10_000_000)` for monetary amounts, `.max(1_000_000)` for volumes/odometer
- IDs: `.max(36)` for UUID fields
- Zip codes: `.max(20)`, VIN: `.max(17)`

### Search Sanitization

`src/lib/sanitize-search.ts` strips dangerous PostgREST filter characters (`(),.\'%`) and caps at 200 chars. Applied to all 10 query modules that accept search input: orders, drivers, brokers, compliance, fuel, maintenance, local-drives, trailers, trucks, trips.

### FMCSA API Hardening

`src/app/api/fmcsa/route.ts` now requires Supabase auth (401 if unauthenticated) and rate limits to 10 lookups/min per user (429 if exceeded).

## RBAC & Custom Roles (Implemented)

### Authorization System

`src/lib/authz.ts` — Central `authorize()` function used by all server actions:
1. Authenticates user via Supabase
2. Extracts `tenant_id` and `role` from `app_metadata`
3. Applies optional per-action rate limiting
4. Resolves permissions (built-in role lookup or custom role DB fetch)
5. Checks required permission
6. Checks account suspension status

Returns typed `AuthzContext` with `{ supabase, user, tenantId, role, permissions }` or error.

### Permission System

`src/lib/permissions.ts` — 30 permissions across 18 resource categories:

| Category | Permissions |
|----------|------------|
| orders | view, create, update, delete |
| trips | view, create, update, delete |
| drivers | view, create, update, delete |
| trucks | view, create, update, delete |
| trailers | view, create, update, delete |
| brokers | create, update, delete |
| local_drives | create, update, delete |
| fuel | create, update, delete |
| maintenance | create, update, delete |
| compliance | create, update, delete |
| billing | manage |
| payments | create, update |
| invoices | create, send |
| tasks | create, update, delete |
| chat | create |
| documents | create, delete |
| trip_expenses | create, update, delete |
| settings | view, manage |

**Built-in roles**:
- `admin` (and legacy `owner`): Full access (`['*']`)
- `dispatcher`: Trip/order/driver/truck/broker/local-drive/fuel/maintenance/tasks/chat/documents/trip-expenses
- `billing`: Orders (view/update), trips (view), billing (manage), payments (all), invoices (all)
- `safety`: Compliance (full), driver/truck/trailer/documents (view only)

**Wildcard support**: `hasPermission()` checks exact match, global `*`, or category `resource.*`.

### Custom Roles

Tenant-scoped custom roles stored in `custom_roles` table with JSONB permissions array.

**Files**:
| File | Purpose |
|------|---------|
| `src/db/schema.ts` | Drizzle table definition (id, tenant_id, name, description, permissions JSONB) |
| `src/app/actions/custom-roles.ts` | CRUD server actions (create, update, delete, fetch) |
| `src/app/(dashboard)/settings/roles-section.tsx` | UI: built-in role viewer + custom role CRUD with permission picker |

**Custom role assignment**: Users assigned role `custom:{uuid}` in `app_metadata`. The `authorize()` function detects the prefix and fetches permissions from DB.

### Database Migrations

| Migration | Purpose |
|-----------|---------|
| `00009_restrict_tenants_update.sql` | RLS WITH CHECK policy preventing authenticated users from modifying subscription fields (plan, stripe IDs, suspension status). Only service role can change these. |
| `00010_custom_roles.sql` | Creates `custom_roles` table with RLS policies (select/insert/update/delete), tenant_id index, and migrates existing `owner` roles to `admin`. |

## API Contract Alignment (Implemented)

### Unified Action Result Type

`src/types/action.ts` — Standardized response types for all server actions:

| Type | Shape | Used By |
|------|-------|---------|
| `ActionResult<T>` | `{ success: true, data: T } \| { error }` | Create, update, status-change actions |
| `ActionResult` (void) | `{ success: true } \| { error }` | Delete actions, void operations |
| `ActionFieldErrors` | `{ error: Record<string, string[]> }` | Zod validation failures |
| `ActionError` | `{ error: string }` | Auth, runtime, business logic errors |

Type guards: `isActionError()`, `isFieldError()`, `isStringError()` — re-exported from `src/types/index.ts`.

### Mismatches Fixed

| Issue | Fix | Files |
|-------|-----|-------|
| `Driver.pay_rate` typed `number`, DB returns `string` | Changed to `string` in `database.ts`, removed 4 defensive `typeof` hacks, fixed `trips.ts` cast bug | `database.ts`, 4 driver components, `trips.ts` |
| Inconsistent action return shapes (`{ data }` vs `{ success, data }` vs `{ success, tripId }`) | Unified all 15 action files to `{ success: true, data? }` | All `src/app/actions/*.ts` |
| `Tenant` interface missing 5 DB columns | Added `dot_number`, `mc_number`, `is_suspended`, `grace_period_ends_at`, `onboarding_completed_at` | `database.ts` |
| `Driver` interface missing 2 DB columns | Added `auth_user_id`, `pin_hash` | `database.ts` |
| Drizzle type export naming inconsistency | Prefixed Phase 1-2 exports (`Broker` → `DrizzleBroker`, etc.) | `schema.ts` |

### Type Architecture

Three type layers, now aligned:
1. **`src/db/schema.ts`** — Drizzle schema (DB truth, migrations only, never imported at runtime)
2. **`src/types/database.ts`** — Runtime interfaces matching Supabase JS client return shapes
3. **`src/types/index.ts`** — Enums, constants, labels, colors + action result re-exports

All `numeric()` DB columns → `string` in TypeScript (Supabase returns PostgreSQL numeric as string).

## Financials Dashboard (Implemented)

### KPI Calculations

`src/lib/financial/kpi-calculations.ts` — Pure calculation functions for financial KPIs:
- Revenue, expenses, net profit, profit margin
- Revenue per mile, cost per mile
- Driver pay totals, average revenue per order
- Period-over-period trend calculations

### Dashboard Components

| Component | Purpose |
|-----------|---------|
| `financials-dashboard.tsx` | Orchestrator: fetches data, manages period state, renders sub-components |
| `period-selector.tsx` | Date range picker (This Month / Last Month / This Quarter / YTD / Custom) |
| `kpi-cards.tsx` | Revenue, expenses, net profit, margin cards with trend indicators |
| `kpi-trend-chart.tsx` | Line/area chart showing KPI trends over time |
| `expense-breakdown-chart.tsx` | Donut chart of expense categories |
| `profit-by-driver-table.tsx` | Driver profitability ranking table |
| `profit-by-truck-table.tsx` | Truck profitability ranking table |

### Billing Page Updates

| Component | Purpose |
|-----------|---------|
| `billing-kpi-cards.tsx` | Receivables summary cards (total outstanding, overdue, collection rate) |
| `payment-status-cards.tsx` | Payment status distribution (moved from financials) |
| `recent-payments-table.tsx` | Latest payments received (moved from financials) |
