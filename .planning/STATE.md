# VroomX SaaS TMS — Project State

**Last Updated:** 2026-02-12

## Current Status

| Item | Status |
|------|--------|
| **Milestone** | v1.0 — MVP Launch |
| **Current Phase** | Phase 3 (Dispatch Workflow) -- In Progress |
| **Next Action** | Execute 03-05-PLAN.md (Trip Detail Page) |
| **Blockers** | None |

Phase 3 in progress: 4/6 plans done. Dispatch board UI complete. Next is trip detail page.

## Completed Work

| Phase | Status | Date | Notes |
|-------|--------|------|-------|
| Project Init | Done | 2026-02-11 | PROJECT.md, config, research, requirements, roadmap |
| 01-01 | Done | 2026-02-11 | Next.js 16 scaffold, dependencies, project structure |
| 01-02 | Done | 2026-02-11 | Database schema with RLS, Drizzle setup |
| 01-03 | Done | 2026-02-11 | Supabase client factories, Next.js 16 proxy |
| 01-04 | Done | 2026-02-11 | Login/signup pages with Server Actions |
| 01-05 | Done | 2026-02-11 | Stripe webhooks with subscription lifecycle |
| 01-06 | Done | 2026-02-11 | Auth flow wiring: email confirmation, logout, useActionState |
| 01-07 | Done | 2026-02-11 | Dashboard UI with sidebar, header, role-based navigation |
| 01-08 | Done | 2026-02-11 | Sentry + PostHog observability integration |
| 02-01 | Done | 2026-02-11 | Database foundation + shared infrastructure for 4 entities |
| 02-02 | Done | 2026-02-11 | Brokers CRUD vertical slice: list, form, drawer, detail, server actions |
| 02-03 | Done | 2026-02-11 | Drivers CRUD with pay configuration, status toggle, card grid |
| 02-04 | Done | 2026-02-11 | Trucks CRUD with type classification, 3-way status, fleet management |
| 02-05 | Done | 2026-02-11 | Orders CRUD with 3-step wizard, VIN decode, card grid, 4-axis filtering |
| 02-06 | Done | 2026-02-11 | Order detail + status workflow + cross-entity nav + Realtime |
| 03-01 | Done | 2026-02-12 | DB foundation for dispatch: trips/trip_expenses tables, types, Zod, sidebar |
| 03-02 | Done | 2026-02-12 | TDD financial calculations: 3 driver pay models, 8 test cases, Vitest |
| 03-03 | Done | 2026-02-12 | Trip server actions, queries, hooks with Realtime for dispatch data layer |
| 03-04 | Done | 2026-02-12 | Dispatch board UI: status-grouped trip list, filters, creation modal |

## Phase Status

| Phase | Name | Status | Plans |
|-------|------|--------|-------|
| 1 | Project Setup + Auth + Multi-Tenancy | Complete | 8/8 |
| 2 | Data Model + Core Entities | Complete | 6/6 |
| 3 | Dispatch Workflow | In Progress | 4/6 |
| 4 | Billing & Invoicing | Not Started | 0/? |
| 5 | Onboarding + Stripe Polish | Not Started | 0/? |
| 6 | iOS Driver App | Not Started | 0/? |
| 7 | Polish & Launch Prep | Not Started | 0/? |

## Progress
██████████████████░░ 90% (18/20 plans complete across Phases 1-3)

## Key Decisions Log

| Date | Decision | Rationale | Plan |
|------|----------|-----------|------|
| 2026-02-11 | Fresh codebase (not Horizon Star fork) | Single-file architecture doesn't scale for SaaS | Init |
| 2026-02-11 | Next.js 15 + Supabase + Stripe + SwiftUI | Validated by research (see STACK.md) | Init |
| 2026-02-11 | RLS-based multi-tenancy (shared schema) | Supabase consensus, simpler migrations | Init |
| 2026-02-11 | Monthly flat tiers (Starter/Pro/Enterprise) | Simple pricing, competitive vs Super Dispatch | Init |
| 2026-02-11 | 14-day free trial (not free tier) | Better conversion, prevents abuse | Init |
| 2026-02-11 | GSD config: auto/thorough/quality/auto-commit | Maximum quality for greenfield SaaS | Init |
| 2026-02-11 | Use src/ directory structure | Better organization for application code | 01-01 |
| 2026-02-11 | PostHog reverse proxy at /ingest/* | Avoid ad blockers blocking analytics | 01-01 |
| 2026-02-11 | shadcn/ui New York style | Cleaner modern aesthetic | 01-01 |
| 2026-02-11 | Tier limits: Starter 5/3, Pro 20/10, Enterprise unlimited | Competitive positioning vs Super Dispatch | 01-01 |
| 2026-02-11 | (SELECT ...) wrapper in RLS policies | Supabase best practice for stable function caching | 01-02 |
| 2026-02-11 | GRANT pattern for JWT hook (not SECURITY DEFINER) | More secure, explicit permissions | 01-02 |
| 2026-02-11 | No INSERT/DELETE policies on tenants | Service role only for proper isolation | 01-02 |
| 2026-02-11 | stripe_events has no authenticated policies | Service role webhook processing only | 01-02 |
| 2026-02-11 | NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY naming | New convention for projects after Nov 2025 | 01-03 |
| 2026-02-11 | getUser() not getSession() in proxy | Server-side token validation | 01-03 |
| 2026-02-11 | Next.js 16 proxy.ts pattern | Replaces middleware.ts in Next.js 16 | 01-03 |
| 2026-02-11 | Three-tier Supabase client pattern | Browser, server, service-role separation | 01-03 |
| 2026-02-11 | Server Actions with form action binding for auth | Simpler than API routes, no client fetch needed | 01-04 |
| 2026-02-11 | Error handling via URL searchParams | Server Actions redirect with ?error=message | 01-04 |
| 2026-02-11 | Signup page as client component | Interactive plan selection requires useState | 01-04 |
| 2026-02-11 | 14-day trial at Stripe Checkout level | trial_period_days in subscription_data | 01-04 |
| 2026-02-11 | Zod validation in Server Actions | Validates inputs before Supabase/Stripe calls | 01-04 |
| 2026-02-11 | Service role client for tenant creation | Bypasses RLS for secure admin operations | 01-04 |
| 2026-02-11 | Bidirectional PRICE_MAP for subscription management | Enables price ID lookups in both directions | 01-05 |
| 2026-02-11 | Service role client in webhook handlers | No user session available in webhook context | 01-05 |
| 2026-02-11 | Handlers throw on DB errors for Stripe retry | Returns 500 status triggers automatic retry | 01-05 |
| 2026-02-11 | Idempotency check before processing webhooks | stripe_events table prevents duplicate event handling | 01-05 |
| 2026-02-11 | Status mapping for subscription states | Maps Stripe's 8+ statuses to tenant enum values | 01-05 |
| 2026-02-11 | React 19 useActionState for auth forms | Modern form state management with built-in loading/error handling | 01-06 |
| 2026-02-11 | Server Actions return error objects for inline display | Better UX than URL searchParams for validation errors | 01-06 |
| 2026-02-11 | Email confirmation handles both PKCE and OTP flows | Supports Supabase's dual auth verification methods | 01-06 |
| 2026-02-11 | Logout revalidates layout cache | Clears protected route state after sign out | 01-06 |
| 2026-02-11 | Zustand for sidebar state | Simpler than Context API for single-piece UI state | 01-07 |
| 2026-02-11 | Role hierarchy levels for navigation | viewer(0) < dispatcher(1) < admin(2) < owner(3) for hasMinRole checks | 01-07 |
| 2026-02-11 | Dashboard layout as Server Component | Performs auth checks and tenant data fetching server-side | 01-07 |
| 2026-02-11 | 8 navigation links with role-based filtering | Progressive visibility based on user role | 01-07 |
| 2026-02-11 | Async searchParams in Next.js 16 | Promise pattern for route params handling | 01-07 |
| 2026-02-11 | Manual Sentry config instead of wizard | Version control and customization | 01-08 |
| 2026-02-11 | PostHog reverse proxy at /ingest | Bypasses ad blockers, better data quality | 01-08 |
| 2026-02-11 | Manual page view tracking | App Router requires custom implementation | 01-08 |
| 2026-02-11 | Lazy-load Stripe client | Prevents build-time env var requirement errors | 01-08 |
| 2026-02-11 | Proxy wrappers for backwards compatibility | Maintains existing import syntax during refactors | 01-08 |
| 2026-02-11 | RLS policies in SQL migration (not Drizzle pgPolicy) | Avoids drizzle-kit push bugs with RLS | 02-01 |
| 2026-02-11 | Order Zod schema split into 3 steps | Supports multi-step wizard form with per-step validation | 02-01 |
| 2026-02-11 | QueryProvider wraps main content only | Keeps dashboard layout as Server Component for auth | 02-01 |
| 2026-02-11 | Numeric fields use string defaults in Drizzle | Preserves decimal precision for financial calculations | 02-01 |
| 2026-02-11 | Broker detail as client component with useBroker | Consistent TanStack Query pattern for all entity detail pages | 02-02 |
| 2026-02-11 | URL search params for filter state | Shareable/bookmarkable filtered views | 02-02 |
| 2026-02-11 | z.input<> for useForm generic with Zod v4 .default() fields | Resolves zodResolver type mismatch between input and output types | 02-03 |
| 2026-02-11 | Status toggle on both card and detail page | Dispatchers need fast status changes from list view | 02-03 |
| 2026-02-11 | Inline Select dropdown for truck 3-way status | Trucks need active/inactive/maintenance vs drivers' 2-way toggle | 02-04 |
| 2026-02-11 | TRUCK_TYPE_LABELS as "7-Car Hauler" format | Clearer fleet context than short "7 Car" labels | 02-04 |
| 2026-02-11 | CreateOrderInput (z.input<>) for multi-step wizard form | z.coerce.number() fields need input type for react-hook-form compatibility | 02-05 |
| 2026-02-11 | NHTSA VIN decode with staleTime: Infinity | VIN data is immutable, no refetch needed | 02-05 |
| 2026-02-11 | Card click navigates to detail page (not edit drawer) | Order detail page provides full context before editing | 02-06 |
| 2026-02-11 | Dynamic filter selects via existing hooks | OrderFilters fetches brokers/drivers inline for dropdown options | 02-05 |
| 2026-02-11 | Targeted Realtime filter on useOrder hook | Subscribes to specific order ID changes for efficient detail page updates | 02-06 |
| 2026-02-11 | Status rollback clears timestamp fields | Keeps actual_pickup_date/actual_delivery_date consistent with status | 02-06 |
| 2026-02-12 | Denormalized financial fields on trips table | Computed by app code, not DB triggers, for flexibility | 03-01 |
| 2026-02-12 | origin_summary/destination_summary TEXT columns on trips | Route display derived from assigned orders | 03-01 |
| 2026-02-12 | Zod import from 'zod' (classic compat path) | Consistent with existing codebase using Zod 4 | 03-01 |
| 2026-02-12 | tripId on orders without Drizzle FK reference | Avoids circular reference; FK constraint in SQL migration | 03-01 |
| 2026-02-12 | Vitest as test runner with tsconfig path aliases | Already in devDeps, just needed vitest.config.ts | 03-02 |
| 2026-02-12 | Four positional args for calculateTripFinancials | Simpler than object arg, matches plan spec | 03-02 |
| 2026-02-12 | Private calculateDriverPay helper function | Clean switch logic encapsulation for pay models | 03-02 |
| 2026-02-12 | recalculateTripFinancials as shared exported helper | Used by both trips.ts and trip-expenses.ts for consistent recalculation | 03-03 |
| 2026-02-12 | Multi-table Realtime in useTrip hook | Single channel subscribes to trips, orders, and expenses for trip detail | 03-03 |
| 2026-02-12 | useUnassignedOrders filters status in [new, assigned] | Only assignable orders shown in assignment UI | 03-03 |
| 2026-02-12 | Database types from @/types/database, unions from @/types | Established import convention for type sources | 03-03 |
| 2026-02-12 | SearchableSelect via Popover + Input filter (no cmdk) | Lighter weight type-ahead combobox without extra dependency | 03-04 |
| 2026-02-12 | Status-grouped sections with Completed collapsed by default | Dispatchers focus on active trips | 03-04 |
| 2026-02-12 | PAGE_SIZE=50 for dispatch board | Primary workspace needs more trips visible than entity pages | 03-04 |
| 2026-02-12 | Date range filters as separate inputs below FilterBar | FilterBar only supports select/search types | 03-04 |
| 2026-02-12 | Capacity color coding: green/amber/red | Quick visual for under/at/over capacity | 03-04 |

## Session Continuity

**Last session:** 2026-02-12 05:58 UTC
**Stopped at:** Completed 03-04-PLAN.md
**Resume file:** None

## Context for Next Session

**What was just completed:**
- Phase 3 Plan 04: Dispatch Board UI
- Dispatch board page at /dispatch with status-grouped trip sections (Planned, In Progress, At Terminal, Completed)
- Trip rows: trip #, truck, driver, capacity (color-coded), route summary, status badge, date range
- Filters: status, driver, truck, date range, search -- all URL-persisted
- Trip creation modal with SearchableSelect type-ahead for truck/driver, redirects to /trips/{id}
- SearchableSelect pattern: Popover + Input filter + scrollable list (reusable for 03-06)

**Next action:** Execute 03-05-PLAN.md (Trip Detail Page)

**Phase 3 progress:** 4/6 plans complete. Dispatch board done, trip detail page next.
