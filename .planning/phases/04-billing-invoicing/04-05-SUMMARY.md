---
phase: 04-billing-invoicing
plan: 05
subsystem: ui
tags: [billing, receivables, aging, batch-actions, collection-rate, shadcn-table, sidebar]

# Dependency graph
requires:
  - phase: 04-02
    provides: Invoice PDF generation and email sending API route
  - phase: 04-03
    provides: Payment server actions, receivables/aging queries, collection rate query
provides:
  - Billing page at /billing with receivables, aging analysis, and collection rate
  - Batch send invoices and batch mark paid UI
  - Broker detail receivables section
  - Updated sidebar navigation (Billing replaces Invoices)
affects: [05-onboarding, 07-polish]

# Tech tracking
tech-stack:
  added: [shadcn/ui table, shadcn/ui checkbox]
  patterns: [server-component page with client sub-components, batch action toolbar with progress tracking]

key-files:
  created:
    - src/app/(dashboard)/billing/page.tsx
    - src/app/(dashboard)/billing/_components/receivables-table.tsx
    - src/app/(dashboard)/billing/_components/aging-table.tsx
    - src/app/(dashboard)/billing/_components/batch-actions.tsx
    - src/app/(dashboard)/billing/_components/collection-rate.tsx
    - src/app/(dashboard)/brokers/_components/broker-receivables.tsx
    - src/components/ui/table.tsx
    - src/components/ui/checkbox.tsx
  modified:
    - src/components/layout/sidebar.tsx
    - src/app/(dashboard)/brokers/[id]/page.tsx

key-decisions:
  - "Server component billing page with client sub-components for interactivity"
  - "Batch send uses individual fetch calls with Promise.allSettled for partial failure handling"
  - "Mark paid popover with date picker defaults to today"
  - "BrokerReceivables uses TanStack Query client-side for independent data fetching"
  - "Replaced broker detail placeholder orders section with receivables component"

patterns-established:
  - "Batch action toolbar: selection count + action buttons + clear, shown conditionally"
  - "Color-coded aging buckets: green/yellow/orange/red/dark-red for time severity"
  - "Expandable table rows with per-row and per-group checkbox selection"

# Metrics
duration: 4min
completed: 2026-02-12
---

# Phase 4 Plan 5: Billing Page & Broker Receivables Summary

**Billing dashboard with broker-grouped receivables table, color-coded aging analysis, batch invoice send/mark-paid, and collection rate metric card**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-12T08:21:20Z
- **Completed:** 2026-02-12T08:25:46Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Built full billing page at /billing with server-side data fetching for receivables, aging, and collection rate
- Created broker-grouped receivables table with expandable order rows and multi-level checkbox selection
- Implemented batch actions toolbar for sending invoices (with progress) and marking orders as paid
- Added color-coded aging analysis table with Current/1-30/31-60/61-90/90+ day buckets and totals
- Added broker detail receivables section replacing placeholder orders card
- Updated sidebar navigation from "Invoices" to "Billing"

## Task Commits

Each task was committed atomically:

1. **Task 1: Update sidebar navigation and create billing page shell** - `9afcaa5` (feat)
2. **Task 2: Create receivables table, aging table, and batch actions** - `a95ab9d` (feat)
3. **Task 3: Add receivables section to broker detail page** - `58dcab1` (feat)

## Files Created/Modified
- `src/app/(dashboard)/billing/page.tsx` - Server component billing dashboard with data fetching
- `src/app/(dashboard)/billing/_components/receivables-table.tsx` - Broker-grouped receivables with expandable rows and checkbox selection
- `src/app/(dashboard)/billing/_components/aging-table.tsx` - Color-coded aging analysis by broker with totals row
- `src/app/(dashboard)/billing/_components/batch-actions.tsx` - Batch send invoices and mark paid toolbar with progress tracking
- `src/app/(dashboard)/billing/_components/collection-rate.tsx` - Collection rate metric card with color-coded percentage
- `src/app/(dashboard)/brokers/_components/broker-receivables.tsx` - Broker detail receivables section with TanStack Query
- `src/components/layout/sidebar.tsx` - Changed "Invoices" to "Billing" at /billing
- `src/app/(dashboard)/brokers/[id]/page.tsx` - Added BrokerReceivables section, removed placeholder
- `src/components/ui/table.tsx` - Installed shadcn/ui Table component
- `src/components/ui/checkbox.tsx` - Installed shadcn/ui Checkbox component

## Decisions Made
- **Server component billing page with client sub-components:** Page fetches all three data sources server-side (receivables, aging, collection rate) via Promise.all, then passes data to client components for interactivity
- **Batch send uses individual fetch calls with Promise.allSettled:** Each selected order gets its own POST to /api/invoices/{orderId}/send, allowing partial success reporting
- **Mark paid popover with date picker:** Defaults to today's date, uses shadcn/ui Popover for inline confirmation before executing batchMarkPaid server action
- **BrokerReceivables uses TanStack Query client-side:** Follows existing hook pattern (use-payments.ts) for client-side data fetching with staleTime: 30s
- **Replaced broker detail placeholder with receivables:** The old "Orders from this Broker" placeholder card was swapped for a live receivables table spanning full width

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed shadcn/ui Table and Checkbox components**
- **Found during:** Task 1 (pre-execution infrastructure check)
- **Issue:** Plan references shadcn/ui Table and Checkbox but neither was installed
- **Fix:** Ran `npx shadcn@latest add table checkbox` to install both components
- **Files modified:** src/components/ui/table.tsx, src/components/ui/checkbox.tsx
- **Verification:** TypeScript compiles, components importable
- **Committed in:** 9afcaa5 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary infrastructure for table and checkbox components. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required for this plan. Resend API key was already configured in 04-02.

## Next Phase Readiness
- Phase 4 (Billing & Invoicing) is now complete with all 5 plans done
- Full billing pipeline: DB schema -> invoice generation -> payment tracking -> billing dashboard
- Ready for Phase 5 (Onboarding + Stripe Polish)

---
*Phase: 04-billing-invoicing*
*Completed: 2026-02-12*
