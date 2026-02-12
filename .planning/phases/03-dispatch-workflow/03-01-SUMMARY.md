---
phase: 03-dispatch-workflow
plan: 01
subsystem: database
tags: [drizzle, postgres, rls, zod, trips, dispatch, sql-migration]

# Dependency graph
requires:
  - phase: 02-data-model
    provides: "Core entities (orders, drivers, trucks, brokers) with Drizzle schema, RLS, types"
provides:
  - "trips and trip_expenses SQL tables with RLS, indexes, triggers, Realtime"
  - "orders.trip_id FK column for trip assignment"
  - "per_car driver pay type across all layers"
  - "Drizzle schema for trips and trip_expenses"
  - "TripStatus, ExpenseCategory, TRUCK_CAPACITY TypeScript types with labels/colors"
  - "Trip and TripExpense database interfaces"
  - "Trip and trip-expense Zod validation schemas"
  - "Updated sidebar navigation (Orders, Dispatch, Brokers)"
  - "StatusBadge trip type support"
affects: [03-02, 03-03, 03-04, 03-05, 04-billing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Denormalized financial summary columns on trips (computed by app code)"
    - "Denormalized route summary columns (origin_summary, destination_summary) on trips"
    - "Trip number auto-generation trigger (TRIP-XXXXXX format)"

key-files:
  created:
    - "supabase/migrations/00003_trips_and_dispatch.sql"
    - "src/lib/validations/trip.ts"
    - "src/lib/validations/trip-expense.ts"
  modified:
    - "src/db/schema.ts"
    - "src/types/index.ts"
    - "src/types/database.ts"
    - "src/lib/validations/driver.ts"
    - "src/components/layout/sidebar.tsx"
    - "src/components/shared/status-badge.tsx"

key-decisions:
  - "Use denormalized financial fields on trips table (computed by app code, not DB triggers)"
  - "origin_summary and destination_summary TEXT columns for route display"
  - "Import from 'zod' (classic compat path) consistent with existing codebase"
  - "tripId on orders table uses no FK constraint in Drizzle (defined separately in SQL migration)"

patterns-established:
  - "Phase 3 enum pattern: tripStatusEnum and expenseCategoryEnum added to schema.ts"
  - "Trip number auto-generation: same pattern as order numbers (TRIP-XXXXXX)"

# Metrics
duration: 4min
completed: 2026-02-12
---

# Phase 3 Plan 01: Database Foundation for Dispatch Summary

**Trips and trip_expenses SQL migration with RLS, Drizzle schema, TypeScript types, Zod validations, and sidebar navigation update for dispatch workflow**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-12T05:40:08Z
- **Completed:** 2026-02-12T05:44:07Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- SQL migration with trips, trip_expenses tables, trip_id FK on orders, per_car enum extension, full RLS, indexes, triggers, and Realtime
- Drizzle schema, TypeScript types (TripStatus, ExpenseCategory, TRUCK_CAPACITY), and database interfaces for Trip/TripExpense
- Zod validation schemas for trip creation and trip expense forms
- Sidebar navigation updated to Orders, Dispatch, Brokers with correct ordering
- StatusBadge component supports trip status type with proper colors and labels

## Task Commits

Each task was committed atomically:

1. **Task 1: SQL migration for trips, trip_expenses, and orders.trip_id** - `cdba4af` (feat)
2. **Task 2: Drizzle schema, TypeScript types, and Zod validations** - `b8f67e6` (feat)
3. **Task 3: Sidebar navigation and StatusBadge updates** - `4185a48` (feat)

## Files Created/Modified
- `supabase/migrations/00003_trips_and_dispatch.sql` - Trips, trip_expenses tables, RLS, indexes, triggers, Realtime
- `src/db/schema.ts` - Drizzle schema for trips/tripExpenses + tripId on orders + Phase 3 enums
- `src/types/index.ts` - TripStatus, ExpenseCategory, TRUCK_CAPACITY types with labels/colors/arrays
- `src/types/database.ts` - Trip and TripExpense interfaces + trip_id on Order
- `src/lib/validations/trip.ts` - Trip form Zod schema with Input/FormData types
- `src/lib/validations/trip-expense.ts` - Trip expense form Zod schema with Input/FormData types
- `src/lib/validations/driver.ts` - Added per_car to payType enum in driver validation
- `src/components/layout/sidebar.tsx` - Updated nav items: Orders, Dispatch, Brokers
- `src/components/shared/status-badge.tsx` - Added trip type with TRIP_STATUS_COLORS/LABELS

## Decisions Made
- **Zod import path:** Used `from 'zod'` (classic compat) consistent with existing codebase, even though plan specified `zod/v4`. Both resolve to same Zod 4 API.
- **tripId in Drizzle without FK reference:** Added `tripId: uuid('trip_id')` to orders table without `.references(() => trips.id)` to avoid circular reference issues since trips table is defined after orders. The FK constraint exists in the SQL migration.
- **Driver validation updated:** Added `per_car` to driver.ts payType enum to stay consistent with the extended type union (Rule 2 - Missing Critical).
- **TRUCK_CAPACITY lookup:** Added capacity lookup map (`7_car: 7, 8_car: 8, etc.`) for dispatch capacity calculations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated driver validation schema with per_car**
- **Found during:** Task 2 (Zod validations)
- **Issue:** driver.ts validation schema had payType enum without `per_car`, which would reject the new valid value
- **Fix:** Added `'per_car'` to the z.enum array in driver validation
- **Files modified:** src/lib/validations/driver.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** b8f67e6 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for correctness -- driver forms must accept the new per_car pay type. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. SQL migration must be applied to Supabase when deploying.

## Next Phase Readiness
- All schema, types, and validation infrastructure ready for trip CRUD (03-02)
- Sidebar already points to /dispatch route (page not yet created)
- StatusBadge supports trip status for use in trip list/detail views
- No blockers for subsequent Phase 3 plans

---
*Phase: 03-dispatch-workflow*
*Completed: 2026-02-12*
