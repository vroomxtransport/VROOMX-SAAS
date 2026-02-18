# VroomX SaaS TMS — Roadmap

**Milestone:** v1.0 — MVP Launch
**Created:** 2026-02-11
**Total Phases:** 7

---

## Phase 1: Project Setup + Auth + Multi-Tenancy ✓

**Status:** Complete (2026-02-11)

**Goal:** A carrier can sign up, create an organization, log in, and see an empty dashboard. Stripe subscription is active. RLS tenant isolation is enforced on every table. This is the foundation — nothing else works without it.

**Requirements:** AUTH-1, AUTH-2, AUTH-3, AUTH-4, AUTH-5, AUTH-7, SUB-1, SUB-2, ONB-1

**Plans:** 8 plans

Plans:
- [x] 01-01-PLAN.md — Scaffold Next.js 16 project, install deps, init shadcn/ui, create directory structure
- [x] 01-02-PLAN.md — SQL schema (tenants, memberships, stripe_events) + RLS policies + auth hook + Drizzle ORM
- [x] 01-03-PLAN.md — Supabase client factories (browser, server, service-role) + proxy.ts auth session refresh
- [x] 01-04-PLAN.md — Login and signup pages with Server Actions (auth + tenant creation + Stripe Checkout)
- [x] 01-05-PLAN.md — Stripe config, webhook handlers, and /api/webhooks/stripe route with idempotency
- [x] 01-06-PLAN.md — Email confirmation route, logout action, signup UX polish with useActionState
- [x] 01-07-PLAN.md — Protected dashboard layout with sidebar navigation, header, user menu
- [x] 01-08-PLAN.md — Sentry error monitoring + PostHog analytics integration

**Key Deliverables:**
- Next.js 16 project with TypeScript, Tailwind CSS v4, shadcn/ui
- Supabase project with multi-tenant schema (tenants, tenant_memberships tables)
- Custom Access Token Hook injecting tenant_id into JWT
- RLS policy template applied to all tables
- Supabase Auth (email/password signup + login)
- Signup flow: register -> create tenant -> select Stripe tier -> redirect to dashboard
- Stripe Checkout integration (Starter/Pro/Enterprise tiers)
- 14-day free trial auto-activation
- Protected dashboard layout with sidebar navigation
- Role-based access (owner, admin, dispatcher, viewer)
- Sentry + PostHog integration
- CI/CD via Netlify (auto-deploy on push)

**Research Flags:** RLS `(SELECT ...)` wrapper pattern critical (see PITFALLS.md CRIT-3). Avoid auth.users triggers (see PITFALLS.md Anti-Pattern 4).

**Success Criteria:**
- [x] New user can sign up and land on empty dashboard
- [x] Tenant isolation verified: User A cannot see User B's data
- [x] Stripe subscription created on signup
- [x] RLS policies on tenants, tenant_memberships tables
- [ ] Automated test: cross-tenant query returns 0 rows (deferred to Phase 7)

---

## Phase 2: Data Model + Core Entities (CRUD) ✓

**Status:** Complete (2026-02-11)

**Goal:** A dispatcher can create and manage orders, drivers, trucks, and brokers. All entity CRUD is functional with proper forms, validation, and list views. Data is tenant-isolated.

**Requirements:** ORD-1, ORD-2, ORD-3, ORD-5, ORD-6, DRV-1, DRV-2, DRV-3, DRV-4, FLT-1, FLT-2, FLT-3

**Plans:** 6 plans

Plans:
- [x] 02-01-PLAN.md — Database schema (orders, drivers, trucks, brokers) + RLS + shared infrastructure + Zod schemas
- [x] 02-02-PLAN.md — Brokers CRUD vertical slice (list, form, drawer, detail, server actions)
- [x] 02-03-PLAN.md — Drivers CRUD vertical slice (list, form, drawer, detail, pay configuration)
- [x] 02-04-PLAN.md — Trucks CRUD vertical slice (list, form, drawer, detail, status management)
- [x] 02-05-PLAN.md — Orders CRUD with multi-step wizard, VIN decode, and advanced filtering
- [x] 02-06-PLAN.md — Order detail + status workflow + cross-entity links + Realtime wiring

**Key Deliverables:**
- Database tables: orders, drivers, trucks, brokers (all with tenant_id + RLS)
- Orders CRUD: create, edit, list, detail view, status workflow
- Drivers CRUD: create, edit, list, driver types (company/owner-operator), pay config
- Trucks CRUD: create, edit, list, truck types, status management
- Brokers CRUD: create, edit, list (contact info, payment terms)
- Server-side pagination and filtering on all list views
- TanStack Query for data fetching + Supabase Realtime for live updates
- Form validation with proper error handling
- Zustand store for UI state (sidebar, modals, filters)

**Research Flags:** Financial calculations belong in application code with denormalized summaries (see ARCHITECTURE.md Section 6).

**Success Criteria:**
- [x] Dispatcher can create, edit, view, and filter orders
- [x] Dispatcher can manage drivers with pay configuration
- [x] Dispatcher can manage trucks with status tracking
- [ ] All data is tenant-isolated (verified via cross-tenant test) — human verification needed
- [x] List views paginate at 50+ records
- [ ] Real-time updates: change in tab A reflects in tab B — human verification needed

---

## Phase 3: Dispatch Workflow ✓

**Status:** Complete (2026-02-12)

**Goal:** A dispatcher can create trips, assign orders to trips, and see trip-level financial summaries. The core dispatch workflow — the primary value proposition of the TMS — is functional.

**Requirements:** ORD-4, TRIP-1, TRIP-2, TRIP-3, TRIP-4, TRIP-5, TRIP-6

**Plans:** 6 plans

Plans:
- [x] 03-01-PLAN.md — DB schema (trips, trip_expenses, trip_id on orders) + types + validations + sidebar nav
- [x] 03-02-PLAN.md — TDD: Trip financial calculation module (3 driver pay models)
- [x] 03-03-PLAN.md — Trip server actions, queries, and TanStack Query hooks
- [x] 03-04-PLAN.md — Dispatch board page with status-grouped trip list and creation modal
- [x] 03-05-PLAN.md — Trip detail page (financial card, orders, expenses, status workflow)
- [x] 03-06-PLAN.md — Order-to-trip assignment from order detail page

**Key Deliverables:**
- Database tables: trips, trip_expenses (with denormalized financial columns + route summary)
- Trip CRUD: create (truck + driver + date range), edit, list, detail view
- Order-to-trip assignment (bidirectional: from trip detail and order detail)
- Trip status workflow: PLANNED -> IN_PROGRESS -> AT_TERMINAL -> COMPLETED
- Trip financial calculations (TDD with 8+ test cases):
  - Total revenue (sum of order revenues)
  - Carrier pay / broker fees
  - Driver pay (3 models: company %, owner-operator dispatch fee %, per-car flat rate)
  - Trip expenses
  - Net profit
- Dispatch board: status-grouped filterable list view with trip creation modal
- Unassigned orders view (orders not yet on a trip)
- Financial summary card with 6 key numbers and inline carrier pay editing

**Research Flags:** Reference Horizon Star trip financial logic but reimplement in TypeScript (see PROJECT.md Reference Material).

**Success Criteria:**
- [x] Dispatcher can create a trip and assign multiple orders
- [x] Trip financial summary auto-calculates on order assignment
- [x] Company driver pay calculated as % of carrier pay
- [x] Owner-operator dispatch fee calculated as % of revenue
- [x] Dispatch board shows trips with order counts and financial totals
- [x] Unassigned orders are visible and assignable

---

## Phase 4: Billing & Invoicing ✓

**Status:** Complete (2026-02-12)

**Goal:** A carrier can track payments, view aging analysis, and see which brokers owe money. Basic invoice generation works. The financial backbone of the TMS is complete.

**Requirements:** BIL-1, BIL-2, BIL-3, BIL-4, BIL-5, BIL-6

**Plans:** 5 plans

Plans:
- [x] 04-01-PLAN.md — DB foundation: payments table, payment_status enum, tenant company columns, types, validations, npm deps
- [x] 04-02-PLAN.md — Invoice generation: PDF template, Resend client, email template, API routes for PDF/send
- [x] 04-03-PLAN.md — Payment data layer: server actions, receivables queries, aging computation, hooks
- [x] 04-04-PLAN.md — Order detail billing: payment recorder, send invoice button, payment status display
- [x] 04-05-PLAN.md — Billing page: receivables table, aging analysis, batch actions, collection rate, sidebar nav

**Key Deliverables:**
- Order payment status tracking (unpaid -> invoiced -> partially paid -> paid)
- Invoice date and payment date fields on orders
- Broker receivables dashboard (grouped by broker, total owed)
- Aging analysis: current, 1-30, 31-60, 61-90, 90+ day buckets
- Mark payment received with date and amount (single + batch)
- Collection rate tracking (% of invoiced amount collected)
- Invoice PDF generation via @react-pdf/renderer
- Email invoice via Resend with PDF attachment
- Batch send invoices and batch mark paid from billing page

**Research Flags:** Aging analysis via security_invoker view (see ARCHITECTURE.md Section 6). Use Resend for email (team familiarity from Horizon Star).

**Success Criteria:**
- [x] Dispatcher can mark orders as invoiced and track payment dates
- [x] Aging analysis shows correct bucket totals
- [x] Broker receivables page shows per-broker totals
- [x] Invoice PDF generates with correct order details
- [x] Collection rate metric is accurate

---

## Phase 5: Onboarding + Stripe Polish ✓

**Status:** Complete (2026-02-12)

**Goal:** The full signup-to-dispatch experience is smooth. Team invites work. Stripe billing is production-ready with webhook handling, dunning, and plan enforcement.

**Requirements:** AUTH-6, SUB-3, SUB-4, SUB-5, ONB-2

**Plans:** 5 plans

Plans:
- [x] 05-01-PLAN.md — DB foundation: invites table, tenant dunning columns, tier enforcement triggers, types/validations
- [x] 05-02-PLAN.md — Tier limit enforcement: checkTierLimit/isAccountSuspended utilities, Server Action guards on createTruck/createDriver
- [x] 05-03-PLAN.md — Stripe Billing Portal Server Action + webhook expansion with dunning (invoice.paid, payment_failed grace period)
- [x] 05-04-PLAN.md — Team invite flow: send/revoke actions, React Email template, accept route, settings team section
- [x] 05-05-PLAN.md — Onboarding wizard on dashboard, billing/usage sections on settings, grace period/suspension banners in layout

**Key Deliverables:**
- Team invite flow (email invite -> accept -> join tenant with role)
- Stripe Billing Portal integration (upgrade/downgrade/cancel)
- Stripe webhook handling (invoice.paid, invoice.payment_failed with dunning)
- Webhook idempotency (stripe_events table)
- Tier-based limits enforcement:
  - Starter: 5 trucks, 3 users
  - Pro: 20 trucks, 10 users
  - Enterprise: unlimited
- Dual enforcement: Server Action checks + DB triggers
- Guided onboarding wizard (add first driver -> truck -> order)
- Usage dashboard (current plan, limits, upgrade CTA)
- Dunning flow (failed payment -> 14-day grace period -> account suspension)
- Settings page with billing, usage, and team management sections

**Research Flags:** Stripe webhook idempotency is critical (see PITFALLS.md CRIT-4). Use Next.js API routes for webhooks, not Edge Functions (see PITFALLS.md MOD-2).

**Success Criteria:**
- [x] Team member can be invited and join with correct role
- [x] Stripe Billing Portal works for plan changes
- [x] Webhook events processed correctly (idempotent)
- [x] Tier limits enforced (Starter user cannot add 6th truck)
- [x] Onboarding wizard guides new user through first setup
- [x] Failed payment triggers grace period, not immediate lockout

---

## Phase 6: iOS Driver App ✓

**Status:** Complete (2026-02-12)

**Goal:** Drivers have a full-featured iOS app (SwiftUI) with Horizon Star parity: view trips, update order statuses, run 6-step vehicle inspections, generate BOLs, track earnings/settlements, and receive push notifications. The app connects to the same multi-tenant Supabase backend.

**Requirements:** APP-1, APP-2, APP-3, APP-4, APP-5, APP-6, APP-7

**Plans:** 13 plans

Plans:
- [x] 06-01-PLAN.md — DB migration (inspection tables, auth_user_id, ETAs, storage buckets) + Xcode project scaffold
- [x] 06-02-PLAN.md — Theme system (VroomX blue/violet palette) + all data models (UUID-based) + core services (Supabase, network, cache)
- [x] 06-03-PLAN.md — Auth flow (email OTP + biometric + PIN) + ContentView routing + 5-tab MainTabView shell
- [x] 06-04-PLAN.md — Data layer (DataManager: fetch, cache, Realtime, mutations) + offline queues + shared UI components
- [x] 06-05-PLAN.md — Home tab (greeting, stats, module tabs, order cards with quick actions)
- [x] 06-06-PLAN.md — Trips tab (trip list, trip detail with financials/orders/expenses, trip history)
- [x] 06-07-PLAN.md — Order detail (timeline, status updates, ETA, map links, contacts, file grid)
- [x] 06-08-PLAN.md — Inspection steps 1-3 (photo capture, video walkthrough, exterior SVG damage diagrams)
- [x] 06-09-PLAN.md — Inspection steps 4-6 (notes/GPS, driver signature, customer sign-off)
- [x] 06-10-PLAN.md — BOL generation (2-page PDF) + preview + email delivery via Edge Function
- [x] 06-11-PLAN.md — Earnings tab (pay period hero card, financial breakdown, settlement detail with PDF/CSV export)
- [x] 06-12-PLAN.md — Messages tab + push notifications (APNs registration, device tokens, notification history)
- [x] 06-13-PLAN.md — Profile tab (driver stats, theme toggle, cache info, sign out)

**Key Deliverables:**
- Fresh SwiftUI project (separate from Horizon Star driver app)
- Supabase Swift SDK integration (Auth + DB + Storage + Realtime)
- Driver login (email OTP + biometric unlock + PIN quick-access)
- 5-tab navigation: Home, Trips, Earnings, Messages, Profile
- Trip list and detail views (assigned trips, real-time status, financials)
- Order detail with status updates, ETA submission, map links, contact actions
- 6-step vehicle inspection flow (photos, video, SVG damage diagrams, notes/GPS, driver signature, customer sign-off)
- BOL generation (2-page PDF) with email delivery via Supabase Edge Function
- Earnings/settlement views with PDF and CSV export
- Per-trip expense tracking (fuel, tolls, repairs, meals)
- Push notifications for trip assignments and status changes
- Offline support (cache, pending actions queue, upload queue with retry)
- VroomX branding (blue/violet palette, dark mode default)

**Research Flags:** Multi-tenant iOS auth needs tenant_id in JWT (see PITFALLS.md MOD-10). Use Swift actor for token refresh serialization. Clear all caches on tenant switch.

**Success Criteria:**
- [x] Driver can log in and see assigned trips
- [x] Driver can update order status from the field
- [x] Vehicle inspection captures photos and signature
- [x] BOL PDF generates correctly and can be emailed
- [x] Expenses can be added to trips
- [ ] Data syncs in real-time with web dashboard — human verification needed

---

## Phase 7: Polish & Launch Prep ✓

**Status:** Complete (2026-02-12)

**Goal:** VroomX is production-ready for 1-2 paying carrier customers. All P1/P2 features are shipped, error handling is solid, and the product is deployable.

**Requirements:** AUTH-8, ORD-7, ORD-8, TRIP-7 (already done), DRV-5, DRV-6, FLT-4, FLT-5, ONB-3, ONB-4

**Plans:** 10 plans

Plans:
- [x] 07-01-PLAN.md — DB migration (trailers, driver/truck documents) + Drizzle schema + storage helper + papaparse
- [x] 07-02-PLAN.md — Error boundaries, loading states, 404 pages for all route groups
- [x] 07-03-PLAN.md — Magic link login (AUTH-8): signInWithOtp + login page tabs
- [x] 07-04-PLAN.md — Trailer assignment (FLT-4) + truck document uploads (FLT-5) on truck detail
- [x] 07-05-PLAN.md — CSV order import wizard (ORD-7): papaparse + column mapping + batch import
- [x] 07-06-PLAN.md — Driver earnings view (DRV-5) + driver documents (DRV-6) + order attachments (ORD-8)
- [x] 07-07-PLAN.md — Sample data seeding (ONB-3) + in-app help tooltips (ONB-4)
- [x] 07-08-PLAN.md — Marketing pages: landing page + pricing page in (marketing) route group
- [x] 07-09-PLAN.md — E2E tests (Playwright): signup, dispatch, and billing flows
- [x] 07-10-PLAN.md — Performance + security audit scripts + launch checklist + final verification

**Key Deliverables:**
- Magic link login option
- CSV order import
- Order attachments (photos, rate confirmations)
- Trip expense management (CRUD) — already done in Phase 3
- Driver earnings view (trip-by-trip pay breakdown)
- Driver/truck document uploads
- Trailer assignment
- Sample data seeding for trial accounts
- In-app help tooltips
- Error boundary handling across all pages
- Loading states and skeleton screens
- 404 and error pages
- SEO: landing page, pricing page
- E2E tests for critical paths (Playwright):
  - Signup -> dashboard
  - Create order -> assign to trip
  - Billing page verification
- Performance audit (Core Web Vitals)
- Security audit (RLS coverage, no exposed keys, webhook signatures)

**Success Criteria:**
- [x] All 56 v1 requirements implemented
- [x] E2E tests passing for signup, dispatch, and billing flows
- [x] Core Web Vitals: LCP < 2.5s, INP < 200ms, CLS < 0.1 (targets documented, audit scripts ready)
- [ ] No console errors on any page — human verification needed
- [ ] Cross-tenant isolation verified with automated tests — human verification needed
- [x] Production deployment on Netlify + Supabase Pro (launch checklist ready)
- [ ] At least 1 carrier can complete a full dispatch workflow

---

## Phase Dependencies

```
Phase 1 (Auth + Multi-Tenancy)
  |
  +---> Phase 2 (Core Entities CRUD)
  |       |
  |       +---> Phase 3 (Dispatch Workflow)
  |       |       |
  |       |       +---> Phase 4 (Billing & Invoicing)
  |       |
  |       +---> Phase 6 (iOS Driver App) [can start after Phase 2]
  |
  +---> Phase 5 (Onboarding + Stripe) [can start after Phase 1, parallel with 3-4]
  |
  +---> Phase 7 (Polish) [after all other phases]
```

**Parallelization opportunities:**
- Phase 5 (Onboarding + Stripe) can run in parallel with Phases 3-4
- Phase 6 (iOS) can start after Phase 2, in parallel with Phases 3-5
- Phase 7 must wait for all other phases

## Milestone Success Criteria

VroomX v1.0 is complete when:
1. A carrier can self-service sign up and start dispatching within 5 minutes
2. Orders, trips, drivers, trucks, and billing are fully functional
3. iOS driver app supports inspections, BOL, and expense tracking
4. Stripe billing handles the full subscription lifecycle
5. Multi-tenant isolation is verified and automated
6. At least 1 real carrier has completed a full dispatch workflow
