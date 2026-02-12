# VroomX SaaS TMS — Project State

**Last Updated:** 2026-02-12

## Current Status

| Item | Status |
|------|--------|
| **Milestone** | v1.0 — MVP Launch |
| **Current Phase** | Phase 5 (Onboarding + Stripe Polish) -- In Progress |
| **Next Action** | Execute 05-04-PLAN.md |
| **Blockers** | None |

Phase 5 in progress: 3/5 plans done. Dunning flow and billing portal ready. Next: onboarding wizard or settings page.

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
| 03-05 | Done | 2026-02-12 | Trip detail page: financial card, order assign/unassign, expense CRUD, status workflow |
| 03-06 | Done | 2026-02-12 | Order-side trip assignment: AssignToTrip component, trip relation in order queries |
| 04-01 | Done | 2026-02-12 | DB foundation for billing: payment_status enum, payments table, types, Zod validation |
| 04-02 | Done | 2026-02-12 | Invoice PDF template, Resend client, email template, PDF download + send API routes |
| 04-03 | Done | 2026-02-12 | Payment server actions, receivables/aging queries, Realtime payment hooks |
| 04-04 | Done | 2026-02-12 | Order detail billing section: PaymentRecorder, InvoiceButton, broker email in queries |
| 04-05 | Done | 2026-02-12 | Billing page: receivables table, aging analysis, batch actions, collection rate, broker receivables |
| 05-01 | Done | 2026-02-12 | DB foundation: invites table, tenant dunning/onboarding columns, tier enforcement triggers |
| 05-02 | Done | 2026-02-12 | Tier enforcement: checkTierLimit + isAccountSuspended in tier.ts, limit checks in createTruck/createDriver |
| 05-03 | Done | 2026-02-12 | Stripe dunning flow (14-day grace period) + Billing Portal Server Action |

## Phase Status

| Phase | Name | Status | Plans |
|-------|------|--------|-------|
| 1 | Project Setup + Auth + Multi-Tenancy | Complete | 8/8 |
| 2 | Data Model + Core Entities | Complete | 6/6 |
| 3 | Dispatch Workflow | Complete | 6/6 |
| 4 | Billing & Invoicing | Complete | 5/5 |
| 5 | Onboarding + Stripe Polish | In Progress | 3/5 |
| 6 | iOS Driver App | Not Started | 0/? |
| 7 | Polish & Launch Prep | Not Started | 0/? |

## Progress
████████████████████████████████████████████████░░░░░░ 93% (28/30 plans complete across Phases 1-5)

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
| 2026-02-12 | Assign dialog stays open for batch assignment | Dispatcher assigns multiple orders in sequence without closing | 03-05 |
| 2026-02-12 | Capacity warnings are soft amber banners, never block | Per CONTEXT.md: warn on overflow, always allow override | 03-05 |
| 2026-02-12 | Inline carrier pay editing with keyboard shortcuts | Enter to save, Escape to cancel for fast editing | 03-05 |
| 2026-02-12 | Status confirm dialogs mention order auto-sync | User sees "will mark all X orders as Delivered" before completing | 03-05 |
| 2026-02-12 | Trip orders query inline in component (not separate hook) | View-specific query, no reuse needed elsewhere | 03-05 |
| 2026-02-12 | Net profit card uses ring + colored bg for visual emphasis | Green for positive, red for negative profit at a glance | 03-05 |
| 2026-02-12 | Trip search uses local filter on useTrips(pageSize:100) | Simpler than server-side search, leverages existing hook | 03-06 |
| 2026-02-12 | AssignToTrip shown for new/assigned/picked_up statuses only | Non-assignable statuses (delivered, invoiced, paid, cancelled) excluded | 03-06 |
| 2026-02-12 | Trip relation added to both fetchOrder and fetchOrders | Enables trip info display on both detail and list views | 03-06 |
| 2026-02-12 | paymentStatusEnum in top-level Enums section (not Phase 4 section) | Avoids TypeScript use-before-declaration error | 04-01 |
| 2026-02-12 | Payments table follows trips RLS pattern exactly | Consistent tenant isolation across all tables | 04-01 |
| 2026-02-12 | Uint8Array conversion for Response body in PDF route | Node Buffer not accepted by Web Response API in strict TS | 04-02 |
| 2026-02-12 | Invoice number INV-{orderId} using full UUID | Per locked decision; simple and unique per order | 04-02 |
| 2026-02-12 | Conditional status updates on invoice send (idempotent re-send) | Only advance from unpaid/delivered; preserve original invoice_date | 04-02 |
| 2026-02-12 | Supabase broker relation cast via unknown for type safety | Array vs object return from .select() with joins | 04-03 |
| 2026-02-12 | Collection rate includes paid orders for accurate percentage | Denominator is all invoiced orders, not just outstanding | 04-03 |
| 2026-02-12 | Overdue threshold 30 days from invoice_date | Standard accounts receivable aging convention | 04-03 |
| 2026-02-12 | Sonner for toast notifications in root layout | First toast library in project; global availability | 04-04 |
| 2026-02-12 | Billing section for picked_up/delivered/invoiced/paid statuses | Conditional rendering excludes new/assigned/cancelled orders | 04-04 |
| 2026-02-12 | Broker email in order queries for invoice delivery check | Added to OrderWithRelations type and both select strings | 04-04 |
| 2026-02-12 | INV-{orderId.slice(0,8)} for compact invoice number display | Full UUID per locked decision, truncated for UI readability | 04-04 |
| 2026-02-12 | Server component billing page with client sub-components | Page fetches data server-side, passes to interactive client components | 04-05 |
| 2026-02-12 | Batch send uses individual fetch calls with Promise.allSettled | Allows partial success reporting for invoice sending | 04-05 |
| 2026-02-12 | BrokerReceivables uses TanStack Query client-side | Follows existing hook pattern for independent broker-scoped data | 04-05 |
| 2026-02-12 | Replaced broker detail placeholder with live receivables | Old "Orders from this Broker" placeholder swapped for real data | 04-05 |
| 2026-02-12 | CHECK constraints on invites role and status columns | DB-level validation mirrors TypeScript types | 05-01 |
| 2026-02-12 | RLS SELECT+INSERT for authenticated on invites; service role for updates | Acceptance flow handled server-side without user JWT | 05-01 |
| 2026-02-12 | Trial plan uses starter limits in tier enforcement | Consistent with existing TIER_LIMITS constant | 05-01 |
| 2026-02-12 | InvitableRole excludes owner | Owner is always tenant creator, never invited | 05-01 |
| 2026-02-12 | checkTierLimit reads plan from DB, never JWT | JWT may be stale; DB is source of truth for plan | 05-02 |
| 2026-02-12 | Trial plan maps to starter tier limits | Consistent with DB triggers and TIER_LIMITS constant | 05-02 |
| 2026-02-12 | Enterprise returns limit=-1 (unlimited) | Sentinel value signals unlimited capacity | 05-02 |
| 2026-02-12 | Only create actions get tier checks | Update/delete/status should always work regardless of tier | 05-02 |
| 2026-02-12 | isAccountSuspended lazily marks suspension | Handles case where grace period expired but flag not yet set | 05-02 |
| 2026-02-12 | handlePaymentFailedWithGrace replaces handlePaymentFailed in route | Old function preserved for reference; route uses grace period version | 05-03 |
| 2026-02-12 | Grace period only set on first failure, not reset on subsequent | Prevents timer extension on repeated failures during grace period | 05-03 |
| 2026-02-12 | handleInvoicePaid sets status to active | Covers initial, renewal, and manual retry payment success | 05-03 |
| 2026-02-12 | Billing portal returns to /settings | Natural return point after subscription management | 05-03 |

## Session Continuity

**Last session:** 2026-02-12 09:25 UTC
**Stopped at:** Completed 05-03-PLAN.md
**Resume file:** None

## Context for Next Session

**What was just completed:**
- Phase 5 Plan 03: Stripe Dunning Flow + Billing Portal
- handleInvoicePaid clears grace_period_ends_at and is_suspended on successful payment
- handlePaymentFailedWithGrace sets 14-day grace period (only on first failure)
- invoice.paid webhook case added to route; invoice.payment_failed now uses grace period handler
- createPortalSession helper and createBillingPortalSession Server Action for Stripe Billing Portal
- Server Action fetches stripe_customer_id, creates portal session, redirects user

**Next:** 05-04
