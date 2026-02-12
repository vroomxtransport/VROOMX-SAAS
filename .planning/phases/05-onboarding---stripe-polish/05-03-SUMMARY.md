---
phase: 05-onboarding---stripe-polish
plan: 03
subsystem: payments
tags: [stripe, webhooks, dunning, grace-period, billing-portal, server-actions]

# Dependency graph
requires:
  - phase: 01-project-setup
    provides: Stripe webhook route, webhook-handlers.ts, stripe config with lazy-loaded client
  - phase: 05-onboarding---stripe-polish
    plan: 01
    provides: tenant dunning columns (grace_period_ends_at, is_suspended)
provides:
  - handleInvoicePaid webhook handler (clears grace period and suspension)
  - handlePaymentFailedWithGrace webhook handler (14-day grace period)
  - invoice.paid webhook case in route switch
  - createPortalSession Stripe Billing Portal helper
  - createBillingPortalSession Server Action with auth and redirect
affects:
  - 05-04 (settings page will use createBillingPortalSession for "Manage Subscription" button)
  - 05-05 (dunning UI may show grace period status based on tenant fields)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dunning flow: grace period on payment failure, clearing on success"
    - "Stripe Billing Portal integration via Server Action with redirect"
    - "Next.js NEXT_REDIRECT digest pattern in try/catch"

key-files:
  created:
    - src/lib/stripe/billing-portal.ts
    - src/app/actions/billing.ts
  modified:
    - src/lib/stripe/webhook-handlers.ts
    - src/app/api/webhooks/stripe/route.ts

key-decisions:
  - "handlePaymentFailedWithGrace replaces handlePaymentFailed in route but old function preserved"
  - "Grace period only set on first failure; subsequent failures do not reset the 14-day timer"
  - "handleInvoicePaid sets subscription_status to active (covers both renewal and retry scenarios)"
  - "Billing portal returns to /settings page after session"

patterns-established:
  - "Dunning flow: grace period set once, cleared on any successful payment"
  - "Server Action redirect with NEXT_REDIRECT digest re-throw pattern"

# Metrics
duration: 2min
completed: 2026-02-12
---

# Phase 5 Plan 03: Stripe Dunning + Billing Portal Summary

**Webhook dunning flow with 14-day grace period on payment failure, auto-clear on success, and Stripe Billing Portal Server Action**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-12T09:23:33Z
- **Completed:** 2026-02-12T09:25:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended webhook handlers with dunning flow: invoice.paid clears grace period and suspension, invoice.payment_failed sets 14-day grace period
- Grace period is only set on first payment failure; subsequent failures during grace period do not reset the timer
- Created Stripe Billing Portal helper and Server Action with auth checks, tenant lookup, and redirect
- All existing webhook handlers (checkout, subscription updated/deleted) remain unchanged with idempotency intact

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend webhook handlers with dunning flow** - `73c93ad` (feat)
2. **Task 2: Create Stripe Billing Portal Server Action and helper** - `876c5cf` (feat)

## Files Created/Modified
- `src/lib/stripe/webhook-handlers.ts` - Added handleInvoicePaid and handlePaymentFailedWithGrace functions
- `src/app/api/webhooks/stripe/route.ts` - Added invoice.paid case, replaced handlePaymentFailed with handlePaymentFailedWithGrace
- `src/lib/stripe/billing-portal.ts` - Helper for creating Stripe Billing Portal sessions via lazy-loaded stripe client
- `src/app/actions/billing.ts` - Server Action: auth check, tenant stripe_customer_id lookup, portal session creation, redirect

## Decisions Made
- handlePaymentFailedWithGrace replaces handlePaymentFailed in the webhook route switch, but the original handlePaymentFailed function is preserved in webhook-handlers.ts for reference
- Grace period is only set on the first payment failure (checks `!tenant.grace_period_ends_at`); subsequent failures during grace period do not reset the 14-day timer
- handleInvoicePaid sets subscription_status to 'active' which covers both initial payment success, renewal success, and manual retry success
- Billing portal Server Action returns to `/settings` page after Stripe portal session completes

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Stripe Billing Portal uses the existing STRIPE_SECRET_KEY environment variable.

## Next Phase Readiness
- Dunning flow is production-ready: failed payments set 14-day grace period, successful payments clear it
- Billing Portal Server Action ready for "Manage Subscription" button on Settings page (Plan 04/05)
- All TypeScript compilation passes cleanly
- Existing webhook functionality preserved and extended

---
*Phase: 05-onboarding---stripe-polish*
*Completed: 2026-02-12*
