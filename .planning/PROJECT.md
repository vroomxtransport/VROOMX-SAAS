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
