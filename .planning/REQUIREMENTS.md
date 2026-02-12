# VroomX SaaS TMS — Requirements (v1)

**Version:** 1.0
**Last Updated:** 2026-02-11
**Milestone:** v1.0 — MVP Launch

## Requirement Categories

| Prefix | Category | Count |
|--------|----------|-------|
| AUTH | Authentication & Tenancy | 8 |
| ORD | Order Management | 8 |
| TRIP | Trip Management | 7 |
| DRV | Driver Management | 6 |
| FLT | Fleet/Truck Management | 5 |
| BIL | Billing & Invoicing | 6 |
| APP | iOS Driver App | 7 |
| SUB | Subscription/Platform Billing | 5 |
| ONB | Onboarding & Self-Service | 4 |
| **Total** | | **56** |

---

## AUTH — Authentication & Tenancy

| ID | Requirement | Priority | Notes |
|----|------------|----------|-------|
| AUTH-1 | Self-service signup with email/password | P0 | Supabase Auth, creates user + tenant in one flow |
| AUTH-2 | Organization (tenant) creation during signup | P0 | Auto-create tenant record, set in JWT app_metadata |
| AUTH-3 | Tenant isolation via PostgreSQL RLS on every table | P0 | Every table has `tenant_id`, RLS enforced at DB level |
| AUTH-4 | JWT custom claims with tenant_id via Auth Hook | P0 | Custom Access Token Hook reads tenant_memberships |
| AUTH-5 | Role-based access control (owner, admin, dispatcher, viewer) | P0 | Stored in tenant_memberships, enforced in UI + RLS |
| AUTH-6 | Invite team members to organization | P1 | Email invite → accept → join tenant |
| AUTH-7 | Session management with secure token handling | P0 | Supabase SSR cookies, auto-refresh |
| AUTH-8 | Magic link login (passwordless option) | P2 | Supabase Auth built-in, secondary auth method |

## ORD — Order Management

| ID | Requirement | Priority | Notes |
|----|------------|----------|-------|
| ORD-1 | Create orders with full vehicle + location details | P0 | Broker, vehicle (year/make/model/VIN/color), pickup/delivery locations, dates |
| ORD-2 | Order status workflow: PENDING → ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED | P0 | Status transitions with timestamp tracking |
| ORD-3 | Payment type tracking (COD, COP, CHECK, BILL, SPLIT) | P0 | Per-order payment configuration |
| ORD-4 | Assign orders to trips | P0 | Many-to-one relationship (order → trip) |
| ORD-5 | Search/filter orders by status, broker, date range, driver | P0 | Server-side filtering with pagination |
| ORD-6 | Order detail view with vehicle info, timeline, payment tracking | P0 | Single-order view with full context |
| ORD-7 | Bulk order import via CSV | P1 | Upload CSV, map columns, validate, import |
| ORD-8 | Order notes and attachments (photos, documents) | P1 | Supabase Storage with tenant-scoped paths |

## TRIP — Trip Management

| ID | Requirement | Priority | Notes |
|----|------------|----------|-------|
| TRIP-1 | Create trips with truck + driver + date range | P0 | Core dispatch workflow |
| TRIP-2 | Assign multiple orders to a trip (multi-load) | P0 | Drag-and-drop or select-and-assign UI |
| TRIP-3 | Trip statuses: PLANNED → IN_PROGRESS → AT_TERMINAL → COMPLETED | P0 | Status transitions with business rules |
| TRIP-4 | Trip-level financial summary (revenue, fees, driver cut, expenses, net profit) | P0 | Computed on write, denormalized on trip record |
| TRIP-5 | Company driver support (% cut of carrier pay) | P0 | Driver pay = carrier_pay * driver_percentage |
| TRIP-6 | Owner-operator support (dispatch fee %) | P0 | Dispatch fee = revenue * dispatch_fee_percentage |
| TRIP-7 | Trip expense tracking (fuel, tolls, repairs) | P1 | Per-trip expenses linked to trip record |

## DRV — Driver Management

| ID | Requirement | Priority | Notes |
|----|------------|----------|-------|
| DRV-1 | Add/edit drivers with personal and contact info | P0 | Name, phone, email, address, emergency contact |
| DRV-2 | Driver types: Company Driver, Owner-Operator | P0 | Affects pay calculation logic |
| DRV-3 | Driver status: ACTIVE, INACTIVE | P0 | Only active drivers assignable to trips |
| DRV-4 | Configurable pay rate (% cut or dispatch fee %) | P0 | Per-driver financial configuration |
| DRV-5 | Driver earnings view (trip-by-trip breakdown) | P1 | List of completed trips with pay details |
| DRV-6 | Driver document uploads (CDL, medical card) | P1 | Supabase Storage, tenant-scoped |

## FLT — Fleet/Truck Management

| ID | Requirement | Priority | Notes |
|----|------------|----------|-------|
| FLT-1 | Add/edit trucks (unit #, type, year/make/model/VIN, ownership) | P0 | Core fleet inventory |
| FLT-2 | Truck types: 7-Car, 8-Car, 9-Car Hauler, Flatbed, Enclosed | P0 | Dropdown selection |
| FLT-3 | Truck status: ACTIVE, INACTIVE, MAINTENANCE | P0 | Only active trucks assignable to trips |
| FLT-4 | Trailer assignment (pair trucks with trailers) | P1 | Optional truck-trailer linking |
| FLT-5 | Truck document uploads (registration, insurance) | P1 | Supabase Storage, tenant-scoped |

## BIL — Billing & Invoicing

| ID | Requirement | Priority | Notes |
|----|------------|----------|-------|
| BIL-1 | Track order payment status (unpaid → invoiced → paid) | P0 | Per-order payment lifecycle |
| BIL-2 | Broker-level receivables aggregation | P0 | Total owed by each broker |
| BIL-3 | Aging analysis (current, 1-30, 31-60, 61-90, 90+ days) | P0 | Based on invoice_date |
| BIL-4 | Mark payments received with date and amount | P0 | Payment recording workflow |
| BIL-5 | Collection rate tracking (% of invoiced amount received) | P1 | Dashboard metric |
| BIL-6 | Basic invoice generation (PDF from order data) | P1 | Generate downloadable/emailable invoice |

## APP — iOS Driver App

| ID | Requirement | Priority | Notes |
|----|------------|----------|-------|
| APP-1 | Driver login (email/password + PIN for quick access) | P0 | Supabase Auth with tenant context |
| APP-2 | Trip list view (assigned trips with status) | P0 | Real-time updates via Supabase Realtime |
| APP-3 | Trip detail view (orders, route, financials) | P0 | All trip context for the driver |
| APP-4 | Order status updates from the field | P0 | Mark picked up, in transit, delivered |
| APP-5 | Vehicle inspection flow (photos, damage markers, signatures) | P1 | Multi-step inspection with photo capture |
| APP-6 | BOL generation and email | P1 | Generate PDF from inspection/order data |
| APP-7 | Per-trip expense tracking | P1 | Add fuel, tolls, repairs to current trip |

## SUB — Subscription/Platform Billing

| ID | Requirement | Priority | Notes |
|----|------------|----------|-------|
| SUB-1 | Stripe Checkout integration for subscription signup | P0 | Embedded or hosted checkout during onboarding |
| SUB-2 | Three pricing tiers: Starter ($49/mo), Pro ($149/mo), Enterprise ($299/mo) | P0 | Flat monthly pricing |
| SUB-3 | Stripe Billing Portal for plan management | P0 | Self-service upgrade/downgrade/cancel |
| SUB-4 | Webhook handling for subscription lifecycle events | P0 | Payment success, failure, cancellation, renewal |
| SUB-5 | Tier-based feature/limit enforcement | P1 | Starter=5 trucks, Pro=20, Enterprise=unlimited |

## ONB — Onboarding & Self-Service

| ID | Requirement | Priority | Notes |
|----|------------|----------|-------|
| ONB-1 | 14-day free trial with full feature access | P0 | Trial auto-created on signup, Stripe trial period |
| ONB-2 | Guided setup wizard (add first driver, truck, order) | P1 | Step-by-step onboarding flow after signup |
| ONB-3 | Sample data option for exploration | P2 | Pre-populated demo data to try features |
| ONB-4 | In-app help tooltips for key workflows | P2 | Contextual help for new users |

---

## Priority Legend

| Priority | Meaning | Target |
|----------|---------|--------|
| P0 | Must have for launch | Phase 1-5 |
| P1 | Important, ship soon after launch | Phase 5-6 |
| P2 | Nice to have, can wait | Phase 7+ |

## Out of Scope (v1)

These are explicitly NOT part of v1. Documented to prevent scope creep.

- Payroll/settlement PDF generation
- Compliance module (CDL tracking, violations, claims)
- Fuel tracking / IFTA tax reporting
- Maintenance record management
- Chrome Extension (Central Dispatch importer)
- Advanced analytics / executive dashboard
- Real-time collaborative editing
- White-label branding
- Android driver app
- Customer-facing portal
- GPS/ELD integration
- QuickBooks integration
- Route optimization
- Built-in messaging/chat
- Multi-language support
- Offline-first web dashboard

## Traceability Matrix

Every v1 requirement maps to at least one roadmap phase:

| Phase | Requirements Covered | Status |
|-------|---------------------|--------|
| 1 — Project Setup + Auth + Multi-Tenancy | AUTH-1, AUTH-2, AUTH-3, AUTH-4, AUTH-5, AUTH-7, SUB-1, SUB-2, ONB-1 | ✓ Complete |
| 2 — Data Model + Core Entities | ORD-1, ORD-2, ORD-3, ORD-5, ORD-6, DRV-1, DRV-2, DRV-3, DRV-4, FLT-1, FLT-2, FLT-3 | ✓ Complete |
| 3 — Dispatch Workflow | ORD-4, TRIP-1, TRIP-2, TRIP-3, TRIP-4, TRIP-5, TRIP-6 | ✓ Complete |
| 4 — Billing & Invoicing | BIL-1, BIL-2, BIL-3, BIL-4, BIL-5, BIL-6, ORD-3 | ✓ Complete |
| 5 — Onboarding + Stripe Polish | AUTH-6, SUB-3, SUB-4, SUB-5, ONB-2, ONB-1 | ✓ Complete |
| 6 — iOS Driver App | APP-1, APP-2, APP-3, APP-4, APP-5, APP-6, APP-7 | ✓ Complete |
| 7 — Polish & Launch Prep | AUTH-8, ORD-7, ORD-8, TRIP-7, DRV-5, DRV-6, FLT-4, FLT-5, ONB-3, ONB-4 | ✓ Complete |

**Coverage:** 56/56 requirements mapped (100%)
**Status:** 56/56 requirements implemented (100%) — All phases complete as of 2026-02-12
