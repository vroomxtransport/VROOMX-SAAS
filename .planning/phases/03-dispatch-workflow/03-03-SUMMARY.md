---
phase: 03-dispatch-workflow
plan: 03
subsystem: api
tags: [server-actions, tanstack-query, realtime, supabase, trip-crud, order-assignment, financial-recalculation]

# Dependency graph
requires:
  - phase: 03-01
    provides: "trips/trip_expenses tables, Trip/TripExpense types, Zod schemas, sidebar navigation"
  - phase: 03-02
    provides: "calculateTripFinancials pure function for financial calculations"
  - phase: 02-01
    provides: "orders table, Order types, server action patterns, query patterns, hook patterns"
provides:
  - "Trip CRUD server actions (create, update, delete)"
  - "Trip status workflow with auto-sync of order statuses"
  - "Order assignment/unassignment with dual-trip financial recalculation"
  - "recalculateTripFinancials with route summary (origin/destination states)"
  - "Trip expense CRUD server actions with auto financial recalculation"
  - "fetchTrips/fetchTrip query functions with driver/truck joins and filters"
  - "fetchTripExpenses query function"
  - "useTrips/useTrip hooks with Realtime subscriptions"
  - "useTripExpenses hook with Realtime"
  - "useUnassignedOrders hook for assignment UI"
affects: [03-04, 03-05, 03-06, 04-billing-invoicing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "recalculateTripFinancials as shared exported helper used by both trips.ts and trip-expenses.ts"
    - "Dual-trip recalculation on order reassignment (old trip + new trip)"
    - "Trip status to order status auto-sync via TRIP_TO_ORDER_STATUS mapping"
    - "Route summary computation from order pickup/delivery states"
    - "Multi-table Realtime subscriptions in single channel (trips + orders + expenses)"

key-files:
  created:
    - src/app/actions/trips.ts
    - src/app/actions/trip-expenses.ts
    - src/lib/queries/trips.ts
    - src/lib/queries/trip-expenses.ts
    - src/hooks/use-trips.ts
    - src/hooks/use-trip-expenses.ts
    - src/hooks/use-unassigned-orders.ts
  modified: []

key-decisions:
  - "calculateTripFinancials takes 4 positional args (orders, driver, expenses, carrierPay) matching 03-02 API"
  - "Route summary uses unique state abbreviations from orders (not cities)"
  - "useTrip subscribes to 3 Realtime channels: trip by id, orders by trip_id, expenses by trip_id"
  - "useUnassignedOrders filters trip_id IS NULL with status in ['new', 'assigned']"
  - "Database types imported from @/types/database, union types from @/types"

patterns-established:
  - "Shared recalculation helper: export from one server action file, import in another"
  - "Multi-table Realtime: single channel subscribing to multiple postgres_changes events"
  - "Inline queryFn in hooks for simple queries (useUnassignedOrders) vs extracted fetch functions for complex queries"

# Metrics
duration: 4min
completed: 2026-02-12
---

# Phase 3 Plan 3: Trip Server Actions + Queries + Hooks Summary

**Trip CRUD, status workflow with order auto-sync, order assignment with dual-trip financial recalculation, expense CRUD, and TanStack Query hooks with multi-table Realtime subscriptions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-12T05:47:26Z
- **Completed:** 2026-02-12T05:51:30Z
- **Tasks:** 2
- **Files created:** 7

## Accomplishments
- Complete trip data layer: 7 exported server actions (createTrip, updateTrip, deleteTrip, updateTripStatus, assignOrderToTrip, unassignOrderFromTrip, recalculateTripFinancials) + 3 expense actions
- Trip status workflow auto-syncs order statuses: in_progress->picked_up, completed->delivered, planned->assigned
- Financial recalculation integrates with calculateTripFinancials from 03-02, computing revenue, broker fees, driver pay, expenses, net profit
- Route summary derived from assigned orders' pickup/delivery states
- 5 query/hook files providing reactive data with Realtime subscriptions across trips, orders, and expenses tables

## Task Commits

Each task was committed atomically:

1. **Task 1: Trip server actions with financial recalculation and order assignment** - `ff071d4` (feat)
2. **Task 2: Trip queries and TanStack Query hooks with Realtime** - `41e1518` (feat)

## Files Created/Modified
- `src/app/actions/trips.ts` - Trip CRUD, status workflow, order assignment, recalculateTripFinancials (411 lines)
- `src/app/actions/trip-expenses.ts` - Trip expense CRUD with auto financial recalculation (129 lines)
- `src/lib/queries/trips.ts` - fetchTrips with driver/truck joins + filters, fetchTrip (87 lines)
- `src/lib/queries/trip-expenses.ts` - fetchTripExpenses ordered by date (24 lines)
- `src/hooks/use-trips.ts` - useTrips + useTrip hooks with multi-table Realtime (119 lines)
- `src/hooks/use-trip-expenses.ts` - useTripExpenses hook with Realtime (45 lines)
- `src/hooks/use-unassigned-orders.ts` - useUnassignedOrders hook for assignment UI (62 lines)

## Decisions Made
- **calculateTripFinancials API alignment:** Adapted to 03-02's 4-positional-arg API: `(orders, driver, expenses, carrierPay)` with `OrderFinancials` interface (`revenue`, `brokerFee`). Return properties use `revenue`/`brokerFees`/`expenses`/`netProfit` (not prefixed with "total").
- **Separate rawOrders from orderFinancials:** Route summary needs pickup/delivery states, but calculateTripFinancials only accepts `{revenue, brokerFee}`. Split into rawOrders (with state fields) and orderFinancials (financial fields only).
- **Database types from @/types/database:** Trip, Driver, Truck interfaces imported from `@/types/database` (not `@/types` which only has union types and constants).
- **Multi-table Realtime in useTrip:** Single channel subscribes to trips (by id), orders (by trip_id), and trip_expenses (by trip_id) for comprehensive reactivity on the trip detail page.
- **useUnassignedOrders status filter:** Filters for `['new', 'assigned']` status -- orders that are assignable to trips. Excludes picked_up/delivered/invoiced/paid/cancelled.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed calculateTripFinancials call signature to match 03-02 API**
- **Found during:** Task 1 (recalculateTripFinancials implementation)
- **Issue:** Initially called with single object arg `{orders, expenses, carrierPay, driver}`, but 03-02 implemented it with 4 positional args `(orders, driver, expenses, carrierPay)`. Return properties also differed: `totalRevenue` vs `revenue`, `totalBrokerFees` vs `brokerFees`, `totalExpenses` vs `expenses`.
- **Fix:** Updated to 4 positional args, separated rawOrders (with state fields) from orderFinancials (revenue+brokerFee only), corrected all property access on return value.
- **Files modified:** src/app/actions/trips.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** ff071d4 (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed Trip/Driver/Truck import path**
- **Found during:** Task 2 (trips query file)
- **Issue:** `import type { Trip, Driver, Truck, TripStatus } from '@/types'` failed -- database interfaces are in `@/types/database`, not re-exported from `@/types`.
- **Fix:** Split import: database types from `@/types/database`, union types from `@/types`.
- **Files modified:** src/lib/queries/trips.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 41e1518 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None -- plan executed smoothly after API alignment with 03-02.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete data layer ready for UI: all server actions, queries, and hooks for trips, expenses, and unassigned orders
- 03-04 (Trip List / Dispatch Board) can now use useTrips hook to render trip table
- 03-05 (Trip Detail Page) can use useTrip, useTripExpenses hooks and all server actions
- 03-06 (Order Assignment UI) can use useUnassignedOrders and assignOrderToTrip/unassignOrderFromTrip
- No blockers

---
*Phase: 03-dispatch-workflow*
*Completed: 2026-02-12*
