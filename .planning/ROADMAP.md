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
- CI/CD via Vercel (auto-deploy on push)

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

## Phase 3: Dispatch Workflow

**Goal:** A dispatcher can create trips, assign orders to trips, and see trip-level financial summaries. The core dispatch workflow — the primary value proposition of the TMS — is functional.

**Requirements:** ORD-4, TRIP-1, TRIP-2, TRIP-3, TRIP-4, TRIP-5, TRIP-6

**Key Deliverables:**
- Database tables: trips (with denormalized financial columns)
- Trip CRUD: create (truck + driver + date range), edit, list, detail view
- Order-to-trip assignment (select orders, assign to trip)
- Trip status workflow: PLANNED -> IN_PROGRESS -> AT_TERMINAL -> COMPLETED
- Trip financial calculations:
  - Total revenue (sum of order revenues)
  - Carrier pay / broker fees
  - Driver pay (% cut for company drivers, dispatch fee % for owner-operators)
  - Trip expenses
  - Net profit
- Dispatch board: filterable list view with trip/order assignment
- Unassigned orders view (orders not yet on a trip)

**Research Flags:** Reference Horizon Star trip financial logic but reimplement in TypeScript (see PROJECT.md Reference Material).

**Success Criteria:**
- [ ] Dispatcher can create a trip and assign multiple orders
- [ ] Trip financial summary auto-calculates on order assignment
- [ ] Company driver pay calculated as % of carrier pay
- [ ] Owner-operator dispatch fee calculated as % of revenue
- [ ] Dispatch board shows trips with order counts and financial totals
- [ ] Unassigned orders are visible and assignable

---

## Phase 4: Billing & Invoicing

**Goal:** A carrier can track payments, view aging analysis, and see which brokers owe money. Basic invoice generation works. The financial backbone of the TMS is complete.

**Requirements:** BIL-1, BIL-2, BIL-3, BIL-4, BIL-5, BIL-6

**Key Deliverables:**
- Order payment status tracking (unpaid -> invoiced -> paid)
- Invoice date and payment date fields on orders
- Broker receivables dashboard (grouped by broker, total owed)
- Aging analysis: current, 1-30, 31-60, 61-90, 90+ day buckets
- Mark payment received with date and amount
- Collection rate tracking (% of invoiced amount collected)
- Basic invoice PDF generation (from order data)
- Email invoice via Resend

**Research Flags:** Aging analysis via security_invoker view (see ARCHITECTURE.md Section 6). Use Resend for email (team familiarity from Horizon Star).

**Success Criteria:**
- [ ] Dispatcher can mark orders as invoiced and track payment dates
- [ ] Aging analysis shows correct bucket totals
- [ ] Broker receivables page shows per-broker totals
- [ ] Invoice PDF generates with correct order details
- [ ] Collection rate metric is accurate

---

## Phase 5: Onboarding + Stripe Polish

**Goal:** The full signup-to-dispatch experience is smooth. Team invites work. Stripe billing is production-ready with webhook handling, dunning, and plan enforcement.

**Requirements:** AUTH-6, SUB-3, SUB-4, SUB-5, ONB-2

**Key Deliverables:**
- Team invite flow (email invite -> accept -> join tenant with role)
- Stripe Billing Portal integration (upgrade/downgrade/cancel)
- Stripe webhook handling (payment_intent.succeeded, customer.subscription.updated/deleted, invoice.payment_failed)
- Webhook idempotency (processed_events table)
- Tier-based limits enforcement:
  - Starter: 5 trucks, 3 users
  - Pro: 20 trucks, 10 users
  - Enterprise: unlimited
- Guided onboarding wizard (add first driver -> truck -> order)
- Usage dashboard (current plan, limits, upgrade CTA)
- Dunning flow (failed payment -> grace period -> account suspension)

**Research Flags:** Stripe webhook idempotency is critical (see PITFALLS.md CRIT-4). Use Vercel API routes for webhooks, not Edge Functions (see PITFALLS.md MOD-2).

**Success Criteria:**
- [ ] Team member can be invited and join with correct role
- [ ] Stripe Billing Portal works for plan changes
- [ ] Webhook events processed correctly (idempotent)
- [ ] Tier limits enforced (Starter user cannot add 6th truck)
- [ ] Onboarding wizard guides new user through first setup
- [ ] Failed payment triggers grace period, not immediate lockout

---

## Phase 6: iOS Driver App

**Goal:** Drivers have a functional iOS app to view trips, update order statuses, run vehicle inspections, and generate BOLs. The app connects to the same multi-tenant Supabase backend.

**Requirements:** APP-1, APP-2, APP-3, APP-4, APP-5, APP-6, APP-7

**Key Deliverables:**
- Fresh SwiftUI project (separate from Horizon Star driver app)
- Supabase Swift SDK integration (Auth + DB + Storage + Realtime)
- Driver login (email/password + PIN quick-access)
- Trip list view (assigned trips, real-time status)
- Trip detail view (orders, route info, financial summary)
- Order status updates (mark picked up, in transit, delivered)
- Vehicle inspection flow:
  - Photo capture (front, back, left, right, interior)
  - Damage marker overlay on vehicle diagram
  - Driver notes
  - Customer signature capture
- BOL generation (PDF from inspection + order data)
- BOL email delivery via Supabase Edge Function
- Per-trip expense tracking (fuel, tolls, repairs, meals)
- Push notifications for trip assignments

**Research Flags:** Multi-tenant iOS auth needs tenant_id in JWT (see PITFALLS.md MOD-10). Use Swift actor for token refresh serialization. Clear all caches on tenant switch.

**Success Criteria:**
- [ ] Driver can log in and see assigned trips
- [ ] Driver can update order status from the field
- [ ] Vehicle inspection captures photos and signature
- [ ] BOL PDF generates correctly and can be emailed
- [ ] Expenses can be added to trips
- [ ] Data syncs in real-time with web dashboard

---

## Phase 7: Polish & Launch Prep

**Goal:** VroomX is production-ready for 1-2 paying carrier customers. All P1/P2 features are shipped, error handling is solid, and the product is deployable.

**Requirements:** AUTH-8, ORD-7, ORD-8, TRIP-7, DRV-5, DRV-6, FLT-4, FLT-5, ONB-3, ONB-4

**Key Deliverables:**
- Magic link login option
- CSV order import
- Order attachments (photos, rate confirmations)
- Trip expense management (CRUD)
- Driver earnings view (trip-by-trip pay breakdown)
- Driver/truck document uploads
- Trailer assignment
- Sample data seeding for trial accounts
- In-app help tooltips
- Error boundary handling across all pages
- Loading states and skeleton screens
- 404 and error pages
- SEO: landing page, pricing page, signup page
- E2E tests for critical paths (Playwright):
  - Signup -> dashboard
  - Create order -> assign to trip -> mark delivered
  - Stripe checkout -> active subscription
- Performance audit (Core Web Vitals)
- Security audit (RLS coverage, no exposed keys, webhook signatures)

**Success Criteria:**
- [ ] All 56 v1 requirements implemented
- [ ] E2E tests passing for signup, dispatch, and billing flows
- [ ] Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1
- [ ] No console errors on any page
- [ ] Cross-tenant isolation verified with automated tests
- [ ] Production deployment on Vercel + Supabase Pro
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
