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
- **Simple deployment**: Vercel + Supabase (no K8s, no Docker in production)
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
| Hosting | Vercel (web) + Supabase Cloud (backend) | Zero-ops, auto-scaling, generous free tiers |
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
