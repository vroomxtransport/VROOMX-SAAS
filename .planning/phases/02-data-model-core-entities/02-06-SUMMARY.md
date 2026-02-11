---
phase: 02-data-model-core-entities
plan: 06
subsystem: ui
tags: [order-detail, status-workflow, realtime, supabase, tanstack-query, next-link]

# Dependency graph
requires:
  - phase: 02-01
    provides: Database schema, shared infrastructure, Zod validations, TanStack Query setup
  - phase: 02-02
    provides: Brokers CRUD with detail page pattern
  - phase: 02-03
    provides: Drivers CRUD
  - phase: 02-04
    provides: Trucks CRUD
  - phase: 02-05
    provides: Orders CRUD with wizard form, card grid, hooks
provides:
  - Order detail page at /orders/[id]
  - Status workflow (advance/rollback/cancel) with server actions
  - Visual status timeline component
  - Cross-entity navigation links to brokers and drivers
  - Realtime subscription on order detail page
affects: [dispatch-workflow, billing-invoicing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Targeted Realtime subscription filtered by entity ID for detail pages"
    - "Status workflow pattern: linear progression with rollback and cancellation"
    - "Cross-entity navigation via next/link for related entities"

key-files:
  created:
    - src/app/(dashboard)/orders/[id]/page.tsx
    - src/app/(dashboard)/orders/_components/order-detail.tsx
    - src/app/(dashboard)/orders/_components/order-timeline.tsx
    - src/app/(dashboard)/orders/_components/order-status-actions.tsx
  modified:
    - src/app/actions/orders.ts
    - src/hooks/use-orders.ts
    - src/app/(dashboard)/orders/_components/order-list.tsx

key-decisions:
  - "Targeted Realtime filter (id=eq.X) on useOrder hook for detail page updates"
  - "Card click navigates to detail page instead of opening edit drawer"
  - "Status rollback clears timestamp fields (actual_pickup_date, actual_delivery_date)"

patterns-established:
  - "Order status workflow: new -> assigned -> picked_up -> delivered -> invoiced -> paid"
  - "Cancellation allowed only before delivery (new, assigned, picked_up)"
  - "AlertDialog with textarea for required-reason workflows"

# Metrics
duration: 4min
completed: 2026-02-11
---

# Phase 2 Plan 6: Order Detail + Status Workflow + Realtime Summary

**Order detail page with visual status timeline, status workflow enforcement (advance/rollback/cancel), cross-entity links to brokers/drivers, and Supabase Realtime on detail view**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-11T23:36:45Z
- **Completed:** 2026-02-11T23:41:18Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Order detail page at /orders/[id] with vehicle info, route, financial summary, assignments, notes, and metadata
- Status workflow with advance (new->assigned->...->paid), rollback (one step back), and cancel (with required reason)
- Visual horizontal timeline showing 6-step order progression with completion indicators
- Cross-entity navigation: broker names link to /brokers/[id], driver names link to /drivers/[id]
- Realtime subscription on useOrder hook for live updates on detail page
- All 4 entity list hooks already had Realtime from prior plans (verified)

## Task Commits

Each task was committed atomically:

1. **Task 1: Order detail page with status workflow and cross-entity navigation** - `0d91cdf` (feat)
2. **Task 2: Realtime subscription for order detail hook** - `2c2b6e7` (feat)

## Files Created/Modified
- `src/app/(dashboard)/orders/[id]/page.tsx` - Order detail page with loading/error/not-found states
- `src/app/(dashboard)/orders/_components/order-detail.tsx` - Full order detail view with all sections
- `src/app/(dashboard)/orders/_components/order-timeline.tsx` - Visual horizontal status timeline
- `src/app/(dashboard)/orders/_components/order-status-actions.tsx` - Status advance/rollback/cancel buttons
- `src/app/actions/orders.ts` - Added updateOrderStatus and rollbackOrderStatus server actions
- `src/hooks/use-orders.ts` - Added targeted Realtime subscription to useOrder hook
- `src/app/(dashboard)/orders/_components/order-list.tsx` - Card click now navigates to detail page

## Decisions Made
- **Targeted Realtime filter on useOrder:** Instead of invalidating all order queries on any change, the detail page subscribes to changes for its specific order ID (`filter: id=eq.${id}`). More efficient than broad invalidation.
- **Card click navigates to detail page:** Updated order-list to navigate to /orders/[id] on card click instead of opening the edit drawer. Edit is still accessible from the detail page.
- **Status rollback clears timestamp fields:** Rolling back from picked_up clears actual_pickup_date; rolling back from delivered clears actual_delivery_date. Keeps data consistent with status.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added Realtime subscription to useOrder (singular) hook**
- **Found during:** Task 2 (Realtime subscriptions)
- **Issue:** All 4 entity list hooks already had Realtime from prior plans, but the individual order detail hook (useOrder) did not. Without it, the detail page would not show real-time updates.
- **Fix:** Added targeted postgres_changes subscription filtered by order ID to the useOrder hook
- **Files modified:** src/hooks/use-orders.ts
- **Verification:** TypeScript compiles clean, subscription creates and cleans up properly
- **Committed in:** 2c2b6e7

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for real-time updates on the detail page. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 2 is now complete: all 6 plans executed
- All 4 entities (brokers, drivers, trucks, orders) have full CRUD with list, detail, and form views
- Order status workflow is enforced with advance/rollback/cancel
- Realtime subscriptions active on all entity list views and order detail view
- Cross-entity navigation links connect orders to brokers and drivers
- Ready for Phase 3 (Dispatch Workflow) which will build on order status transitions

---
*Phase: 02-data-model-core-entities*
*Completed: 2026-02-11*
