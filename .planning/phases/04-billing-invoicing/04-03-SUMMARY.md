---
phase: 04-billing-invoicing
plan: 03
subsystem: payments
tags: [supabase, tanstack-query, realtime, payments, receivables, aging, server-actions]

# Dependency graph
requires:
  - phase: 04-billing-invoicing
    provides: "payments table, payment_status enum, recordPaymentSchema, Payment type, billing columns on orders"
  - phase: 02-data-model
    provides: "orders table, brokers table, server action patterns, query patterns, hook patterns"
provides:
  - "recordPayment server action with balance validation and auto-status transition"
  - "batchMarkPaid server action for bulk payment processing"
  - "fetchPaymentsByOrder query for order detail"
  - "fetchBrokerReceivables aggregation query grouped by broker"
  - "fetchAgingAnalysis with current/1-30/31-60/61-90/90+ day buckets"
  - "fetchCollectionRate computing invoiced vs collected percentage"
  - "usePaymentsByOrder hook with Realtime subscription"
affects:
  - 04-billing-invoicing (Plan 04 order detail billing section, Plan 05 billing page)

# Tech tracking
tech-stack:
  added: []
  patterns: ["server actions with payment balance validation", "receivables aggregation with broker grouping", "aging bucket computation via differenceInDays"]

key-files:
  created:
    - "src/app/actions/payments.ts"
    - "src/lib/queries/payments.ts"
    - "src/lib/queries/receivables.ts"
    - "src/hooks/use-payments.ts"
  modified: []

key-decisions:
  - "Cast broker relation as unknown before type narrowing to handle Supabase array vs object return"
  - "Collection rate includes paid orders (not just outstanding) for accurate percentage"
  - "Overdue threshold set at 30 days from invoice_date"

patterns-established:
  - "Payment amount validation: check against remaining balance with 0.01 threshold"
  - "Auto-status transition: unpaid -> partially_paid -> paid based on amount_paid vs carrier_pay"
  - "Receivables aggregation: client-side grouping from Supabase select with broker join"
  - "Aging buckets: differenceInDays from invoice_date, 5 buckets (current, 1-30, 31-60, 61-90, 90+)"

# Metrics
duration: 2min
completed: 2026-02-12
---

# Phase 4 Plan 03: Payment Data Layer Summary

**Server actions for recording payments with auto-status transitions, receivables/aging aggregation queries by broker, and Realtime-enabled payment hooks**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-12T08:15:03Z
- **Completed:** 2026-02-12T08:17:26Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- recordPayment server action validates input via Zod, checks balance, inserts payment, updates order amount_paid, and auto-transitions payment_status (unpaid -> partially_paid -> paid)
- batchMarkPaid pays remaining balance on multiple orders with Promise.allSettled for graceful partial failure handling
- fetchBrokerReceivables aggregates outstanding invoices per broker with total owed, invoice count, oldest unpaid, paid this month, and overdue amounts
- fetchAgingAnalysis buckets receivables into current/1-30/31-60/61-90/90+ day columns per broker using differenceInDays
- fetchCollectionRate computes percentage of invoiced carrier pay that has been collected
- usePaymentsByOrder hook with Realtime subscription invalidates both payment and order queries on changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create payment server actions** - `b6349ce` (feat)
2. **Task 2: Create payment queries, receivables queries, and hooks** - `18190c6` (feat)

## Files Created/Modified
- `src/app/actions/payments.ts` - recordPayment and batchMarkPaid server actions with auth, validation, balance checking, and auto-status transitions
- `src/lib/queries/payments.ts` - fetchPaymentsByOrder query for order detail payment list
- `src/lib/queries/receivables.ts` - fetchBrokerReceivables, fetchAgingAnalysis, fetchCollectionRate aggregation queries
- `src/hooks/use-payments.ts` - usePaymentsByOrder TanStack Query hook with Supabase Realtime subscription

## Decisions Made
- Cast Supabase broker relation as `unknown` before type narrowing to handle the array-vs-object return type mismatch from `.select('broker:brokers(...)')` queries
- Collection rate query includes paid orders (payment_status in ['invoiced', 'partially_paid', 'paid']) to compute accurate collection percentage across all invoiced orders
- Overdue threshold set at 30 days from invoice_date for the overdueAmount field in broker receivables

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Supabase relation type casting in receivables queries**
- **Found during:** Task 2 (receivables queries)
- **Issue:** TypeScript error TS2352 when casting `order.broker` to `{ id: string; name: string; email: string | null }` because Supabase returns broker relation as an array type, not a single object
- **Fix:** Cast via `unknown` first, then handle both array and object shapes: `const brokerRaw = order.broker as unknown as ... | ...[] | null; const broker = Array.isArray(brokerRaw) ? brokerRaw[0] ?? null : brokerRaw`
- **Files modified:** src/lib/queries/receivables.ts (lines 105, 182)
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** 18190c6 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for TypeScript compilation. No scope creep.

## Issues Encountered
None beyond the Supabase relation type casting documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All payment data operations ready for UI consumption
- 04-04 (Order Detail Billing Section) can use recordPayment, usePaymentsByOrder
- 04-05 (Billing Page) can use fetchBrokerReceivables, fetchAgingAnalysis, fetchCollectionRate, batchMarkPaid
- Realtime subscription ensures live updates when payments are recorded

---
*Phase: 04-billing-invoicing*
*Completed: 2026-02-12*
