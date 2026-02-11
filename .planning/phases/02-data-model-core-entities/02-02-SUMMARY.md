---
phase: 02-data-model-core-entities
plan: 02
subsystem: ui, api
tags: [tanstack-query, react-hook-form, zod, supabase, server-actions, shadcn-sheet, zustand-drafts]

# Dependency graph
requires:
  - phase: 02-data-model-core-entities/01
    provides: "Brokers table with RLS, brokerSchema Zod validation, shared UI components, QueryProvider, draft store"
provides:
  - "Brokers CRUD vertical slice: list page, detail page, create/edit drawer, server actions"
  - "Reusable CRUD pattern for TanStack Query hooks + Supabase query builders"
  - "Server Action pattern with Zod validation, tenant_id from JWT, revalidatePath"
  - "Drawer form pattern with draft auto-save and unsaved changes warning"
affects: [02-03, 02-04, 02-05]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Server Actions with Zod safeParse + tenant_id from app_metadata", "TanStack Query hooks with Supabase browser client + realtime invalidation", "Sheet drawer with unsaved changes guard via ConfirmDialog", "Draft auto-save via Zustand persist store + form.watch subscription", "URL search params for filter state (shareable/bookmarkable)"]

key-files:
  created:
    - src/lib/queries/brokers.ts
    - src/hooks/use-brokers.ts
    - src/app/actions/brokers.ts
    - src/app/(dashboard)/brokers/page.tsx
    - src/app/(dashboard)/brokers/[id]/page.tsx
    - src/app/(dashboard)/brokers/_components/broker-card.tsx
    - src/app/(dashboard)/brokers/_components/broker-list.tsx
    - src/app/(dashboard)/brokers/_components/broker-form.tsx
    - src/app/(dashboard)/brokers/_components/broker-drawer.tsx
  modified: []

key-decisions:
  - "Broker detail page is client component using useBroker hook (not server component) for consistency with TanStack Query pattern"
  - "URL search params for filter state enables shareable/bookmarkable filtered views"
  - "Draft auto-save uses form.watch subscription with debounce-free writes to Zustand persist"
  - "Unsaved changes detection via onChange/onInput event bubbling on wrapper div for simplicity"

patterns-established:
  - "CRUD vertical slice: query builders -> TanStack hooks -> server actions -> form -> drawer -> list -> detail page"
  - "Server Action error handling: return { error: string | fieldErrors } for inline display"
  - "Drawer form pattern: key prop reset, draft load on mount, draft clear on submit"
  - "Card grid list: FilterBar + card grid (1/2/3 cols) + Pagination + EmptyState"

# Metrics
duration: 4min
completed: 2026-02-11
---

# Phase 2 Plan 02: Brokers CRUD Summary

**Complete broker management vertical slice: card-grid list with search/pagination, slide-out drawer form with Zod validation and draft auto-save, detail page with edit/delete, 3 server actions with tenant isolation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-11T23:15:21Z
- **Completed:** 2026-02-11T23:19:22Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Full Brokers CRUD with card-grid list page, slide-out drawer create/edit form, and detail page with all broker info
- Server Actions (createBroker, updateBroker, deleteBroker) with Zod validation and tenant_id from JWT app_metadata
- TanStack Query hooks (useBrokers, useBroker) with Supabase browser client and realtime cache invalidation
- Draft auto-save via Zustand persist store -- form state survives drawer close/reopen
- Unsaved changes warning via ConfirmDialog when closing drawer with dirty form
- Empty state, loading skeletons, error handling, search filter, and pagination all wired
- Established the complete CRUD vertical slice pattern that Plans 03 (Drivers) and 04 (Trucks) will replicate

## Task Commits

Each task was committed atomically:

1. **Task 1: Broker server actions and TanStack Query hooks** - `946b8ad` (feat)
2. **Task 2: Broker UI components (list, card, drawer, form, detail page)** - `93b4f61` (feat)

## Files Created/Modified
- `src/lib/queries/brokers.ts` - Supabase query builders: fetchBrokers (search/paginate/sort), fetchBroker (by id)
- `src/hooks/use-brokers.ts` - TanStack Query hooks with realtime invalidation for list and detail
- `src/app/actions/brokers.ts` - Server Actions: createBroker, updateBroker, deleteBroker with Zod + tenant_id
- `src/app/(dashboard)/brokers/page.tsx` - Brokers list page (server component wrapping client BrokerList)
- `src/app/(dashboard)/brokers/[id]/page.tsx` - Broker detail page with contact info, payment terms, notes, orders placeholder
- `src/app/(dashboard)/brokers/_components/broker-card.tsx` - Card component using shared EntityCard with name, email, phone, payment terms badge
- `src/app/(dashboard)/brokers/_components/broker-list.tsx` - Card grid with search filter, pagination, empty state, loading skeletons
- `src/app/(dashboard)/brokers/_components/broker-form.tsx` - react-hook-form + zodResolver with draft auto-save and field validation
- `src/app/(dashboard)/brokers/_components/broker-drawer.tsx` - Sheet drawer with unsaved changes warning

## Decisions Made
- Broker detail page uses client component with useBroker hook (TanStack Query) rather than server component -- consistent with the established data fetching pattern and enables edit/delete actions without page navigation
- URL search params for filter state -- enables shareable and bookmarkable filtered views
- Draft auto-save writes on every form.watch change without debounce -- Zustand persist batches writes automatically and draft data is small
- Unsaved changes detection uses onChange/onInput bubbling on a wrapper div -- simpler than exposing form.formState.isDirty through component boundaries

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Brokers CRUD fully functional and ready for use
- The CRUD vertical slice pattern is established and documented for replication in Plans 03 (Drivers) and 04 (Trucks)
- Key files to reference: query builders in `src/lib/queries/`, hooks in `src/hooks/`, server actions in `src/app/actions/`, UI components in `src/app/(dashboard)/brokers/_components/`
- SQL migration (00002) still needs to be applied to Supabase instance for live data to flow

---
*Phase: 02-data-model-core-entities*
*Completed: 2026-02-11*
