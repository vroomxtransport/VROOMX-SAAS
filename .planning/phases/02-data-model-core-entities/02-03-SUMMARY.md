---
phase: 02-data-model-core-entities
plan: 03
subsystem: ui, api
tags: [tanstack-query, react-hook-form, zod, supabase, server-actions, shadcn-ui, driver-management]

# Dependency graph
requires:
  - phase: 02-data-model-core-entities
    provides: "drivers table with RLS, driverSchema validation, shared UI components, QueryProvider, draft store"
provides:
  - "4 driver server actions: createDriver, updateDriver, deleteDriver, updateDriverStatus"
  - "Supabase query builders with status/type/search filtering"
  - "TanStack Query hooks: useDrivers (list) and useDriver (single)"
  - "Driver card grid list with status/type/search filters at /drivers"
  - "Driver detail page with pay configuration display at /drivers/[id]"
  - "Driver form with 3 pay types and dynamic rate label in slide-out drawer"
  - "Realtime invalidation via Supabase postgres_changes subscription"
  - "DriverFormInput type export for Zod v4 + react-hook-form compatibility"
affects: [02-05, 02-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "z.input<> for react-hook-form generic when schema has .default() fields (Zod v4 compat)"
    - "Realtime channel subscription in TanStack Query hook for auto-invalidation"
    - "Dynamic form label based on watched field value (pay type -> rate label)"
    - "Draft auto-save with 500ms debounce in create mode"

key-files:
  created:
    - src/app/actions/drivers.ts
    - src/hooks/use-drivers.ts
    - src/lib/queries/drivers.ts
    - src/app/(dashboard)/drivers/page.tsx
    - src/app/(dashboard)/drivers/[id]/page.tsx
    - src/app/(dashboard)/drivers/_components/driver-card.tsx
    - src/app/(dashboard)/drivers/_components/driver-list.tsx
    - src/app/(dashboard)/drivers/_components/driver-form.tsx
    - src/app/(dashboard)/drivers/_components/driver-drawer.tsx
  modified:
    - src/lib/validations/driver.ts

key-decisions:
  - "Use z.input<typeof schema> for useForm generic to fix Zod v4 + @hookform/resolvers type mismatch with .default() fields"
  - "Pay rate stored as string in DB but parsed to float for display -- preserves decimal precision"
  - "Driver status toggle available on both card (quick action) and detail page (prominent control)"

patterns-established:
  - "Entity CRUD vertical slice: queries -> hooks -> server actions -> card -> form -> drawer -> list -> page -> detail"
  - "Zod v4 form input type: export both z.infer (output) and z.input (form) types from validation files"

# Metrics
duration: 5min
completed: 2026-02-11
---

# Phase 2 Plan 03: Drivers CRUD Summary

**Full driver management with 3 pay types (% carrier pay, dispatch fee %, per mile), card grid with status/type filtering, detail page with pay configuration, and Zod v4-compatible forms**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-11T23:16:45Z
- **Completed:** 2026-02-11T23:22:01Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- 4 server actions (create, update, delete, updateStatus) with Zod validation and tenant isolation
- TanStack Query hooks with Supabase realtime invalidation for automatic list refresh
- Card grid list at /drivers with search, status filter, driver type filter, and pagination
- Driver form with 4 sections (personal info, address, driver details, pay configuration) and draft auto-save
- Detail page at /drivers/[id] with contact info, address, driver details, pay configuration display, and placeholder sections for orders/earnings
- Dynamic pay rate label that changes based on selected pay type (Cut % / Fee % / Rate per mile $)
- Status toggle available as quick action on card and as prominent control on detail page
- Resolved Zod v4 + react-hook-form type mismatch by introducing z.input<> type export pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Driver server actions, query builders, and TanStack Query hooks** - `c3f62e3` (feat)
2. **Task 2: Driver UI components (list, card, drawer, form, detail page)** - `0dbd188` (feat)

## Files Created/Modified
- `src/app/actions/drivers.ts` - 4 server actions with Zod parsing and snake_case field mapping
- `src/hooks/use-drivers.ts` - useDrivers and useDriver TanStack Query hooks with realtime
- `src/lib/queries/drivers.ts` - Supabase query builders with status/type/search filtering
- `src/app/(dashboard)/drivers/page.tsx` - Drivers list page with title and Suspense
- `src/app/(dashboard)/drivers/[id]/page.tsx` - Driver detail with pay config, status toggle, delete
- `src/app/(dashboard)/drivers/_components/driver-card.tsx` - Card with name, badges, contact, pay info
- `src/app/(dashboard)/drivers/_components/driver-list.tsx` - Grid list with filters, pagination, skeletons
- `src/app/(dashboard)/drivers/_components/driver-form.tsx` - 4-section form with dynamic pay rate label
- `src/app/(dashboard)/drivers/_components/driver-drawer.tsx` - Sheet drawer with draft auto-save
- `src/lib/validations/driver.ts` - Added DriverFormInput type export for Zod v4 compat

## Decisions Made
- Used `z.input<typeof schema>` for useForm generic to resolve Zod v4 + @hookform/resolvers type mismatch -- `.default()` fields create input/output type divergence that react-hook-form cannot resolve with `z.infer`
- Pay rate stored as string in database (Drizzle numeric type) but parsed to float for UI display -- preserves decimal precision for financial calculations
- Status toggle placed on both card (Switch component for quick toggle) and detail page (prominent bordered control) -- dispatchers need fast status changes from list view

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zod v4 + react-hook-form type mismatch**
- **Found during:** Task 2 (Driver form component)
- **Issue:** `z.infer<typeof driverSchema>` produces output type where `.default()` fields (driverType, driverStatus, payType, payRate) are required, but zodResolver expects input type where they are optional. TypeScript errors on `useForm<DriverFormValues>` and `FormField` control prop.
- **Fix:** Added `DriverFormInput = z.input<typeof driverSchema>` export to validation file; used `DriverFormInput` for useForm generic, defaultValues type, and submit handler parameter. Used explicit value/onChange/onBlur/name/ref for payRate Input to handle `unknown` input type from `z.coerce.number()`.
- **Files modified:** `src/lib/validations/driver.ts`, `src/app/(dashboard)/drivers/_components/driver-form.tsx`
- **Verification:** `npx tsc --noEmit` passes with zero driver-related errors
- **Committed in:** 0dbd188 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix was necessary for TypeScript compilation. Establishes reusable pattern for all entity forms with Zod v4 .default() fields.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Driver CRUD fully functional -- ready for order assignment (driver_id FK in orders table)
- Pay configuration in place for financial calculations in Phase 4 (Billing & Invoicing)
- `z.input<>` pattern should be applied to truck and broker forms if they have the same Zod v4 type issue
- Pre-existing truck-form.tsx TypeScript errors (from Plan 02-04) need the same z.input<> fix

---
*Phase: 02-data-model-core-entities*
*Completed: 2026-02-11*
