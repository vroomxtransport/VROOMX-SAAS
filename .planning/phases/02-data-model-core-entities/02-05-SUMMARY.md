---
phase: 02-data-model-core-entities
plan: 05
subsystem: ui, api
tags: [orders, multi-step-wizard, vin-decode, nhtsa, tanstack-query, react-hook-form, supabase, server-actions, zod]

# Dependency graph
requires:
  - phase: 02-01
    provides: "Database schema, Zod validations, shared components, draft store"
  - phase: 02-02
    provides: "Brokers CRUD (useBrokers hook, query builders)"
  - phase: 02-03
    provides: "Drivers CRUD (useDrivers hook, query builders)"
provides:
  - "Orders CRUD with multi-step wizard (Vehicle -> Location -> Pricing)"
  - "NHTSA VIN decoder client and TanStack Query hook"
  - "Order server actions (createOrder, updateOrder, deleteOrder)"
  - "Order query builders with broker/driver joins and comprehensive filtering"
  - "Order card grid with status/broker/driver/search/date-range filters"
  - "Draft auto-save for wizard state persistence"
affects: ["03-dispatch-workflow", "04-billing-invoicing"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-step wizard form with per-step Zod validation"
    - "NHTSA vPIC API integration for VIN decode"
    - "z.input<> type for react-hook-form with z.coerce fields"
    - "FormProvider context for wizard step components"

key-files:
  created:
    - "src/lib/vin-decoder.ts"
    - "src/hooks/use-vin-decode.ts"
    - "src/lib/queries/orders.ts"
    - "src/hooks/use-orders.ts"
    - "src/app/actions/orders.ts"
    - "src/app/(dashboard)/orders/page.tsx"
    - "src/app/(dashboard)/orders/_components/order-card.tsx"
    - "src/app/(dashboard)/orders/_components/order-list.tsx"
    - "src/app/(dashboard)/orders/_components/order-filters.tsx"
    - "src/app/(dashboard)/orders/_components/order-drawer.tsx"
    - "src/app/(dashboard)/orders/_components/order-form.tsx"
    - "src/app/(dashboard)/orders/_components/vehicle-step.tsx"
    - "src/app/(dashboard)/orders/_components/location-step.tsx"
    - "src/app/(dashboard)/orders/_components/pricing-step.tsx"
  modified:
    - "src/lib/validations/order.ts"

key-decisions:
  - "CreateOrderInput type (z.input<>) for react-hook-form compatibility with z.coerce number fields"
  - "NHTSA VIN decode with staleTime: Infinity since VIN data never changes"
  - "Order card opens edit drawer on click (detail page deferred to later phase)"
  - "OrderFilters fetches broker/driver lists inline for dynamic select options"

patterns-established:
  - "Multi-step wizard: FormProvider wrapping step components with per-step validation"
  - "Step navigation: validateCurrentStep() gates advancing, Back/Next/Submit at bottom"
  - "VIN decode: auto-fill on 17-char VIN, manual entry always available as fallback"
  - "Financial summary: real-time margin calculation (revenue - carrierPay - brokerFee)"

# Metrics
duration: 8min
completed: 2026-02-11
---

# Phase 2 Plan 5: Orders CRUD Summary

**Orders CRUD with 3-step wizard (Vehicle/Location/Pricing), NHTSA VIN decode auto-fill, broker/driver assignment, card grid with 4-axis filtering, and draft auto-save**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-11T23:27:22Z
- **Completed:** 2026-02-11T23:35:00Z
- **Tasks:** 2
- **Files created:** 14
- **Files modified:** 1

## Accomplishments
- Complete order data layer: VIN decoder, server actions, query builders with broker/driver joins
- Multi-step creation wizard with VIN decode auto-fill and per-step Zod validation
- Order card grid with comprehensive filtering (status, broker, driver, search)
- Financial margin calculator on pricing step with real-time updates
- Draft auto-save persists wizard state across drawer close/reopen

## Task Commits

Each task was committed atomically:

1. **Task 1: Create VIN decoder, order server actions, and TanStack Query hooks** - `69bafa2` (feat)
2. **Task 2: Create order UI components (list, card, filters, multi-step wizard drawer)** - `6ac6f02` (feat)

## Files Created/Modified
- `src/lib/vin-decoder.ts` - NHTSA vPIC API client for VIN decode
- `src/hooks/use-vin-decode.ts` - TanStack Query hook (enabled at 17 chars, staleTime: Infinity)
- `src/lib/queries/orders.ts` - Supabase query builders with broker/driver joins, comprehensive filters
- `src/hooks/use-orders.ts` - useOrders/useOrder hooks with realtime invalidation
- `src/app/actions/orders.ts` - Server Actions: createOrder, updateOrder, deleteOrder
- `src/app/(dashboard)/orders/page.tsx` - Orders page rendering OrderList
- `src/app/(dashboard)/orders/_components/order-card.tsx` - Card with order number, vehicle, route, status badge, price
- `src/app/(dashboard)/orders/_components/order-list.tsx` - Card grid with loading skeletons, empty state, pagination
- `src/app/(dashboard)/orders/_components/order-filters.tsx` - Status/broker/driver selects and search input
- `src/app/(dashboard)/orders/_components/order-drawer.tsx` - Sheet drawer (max-w-2xl) with discard confirmation
- `src/app/(dashboard)/orders/_components/order-form.tsx` - 3-step wizard with step indicator, per-step validation, draft auto-save
- `src/app/(dashboard)/orders/_components/vehicle-step.tsx` - VIN input with auto-decode, manual year/make/model/type/color
- `src/app/(dashboard)/orders/_components/location-step.tsx` - Pickup and delivery sections with address, city, state, zip, contact, date
- `src/app/(dashboard)/orders/_components/pricing-step.tsx` - Revenue/carrierPay/brokerFee with margin calc, broker/driver selects
- `src/lib/validations/order.ts` - Added CreateOrderInput type for z.input<> compatibility

## Decisions Made
- **CreateOrderInput type (z.input<>)**: Same pattern as 02-03 driver form -- z.coerce.number() fields produce `unknown` input type which conflicts with react-hook-form's generic. Using z.input<> resolves the type mismatch.
- **NHTSA VIN decode with staleTime: Infinity**: VIN data is immutable -- a VIN always maps to the same year/make/model, so no refetch ever needed.
- **Card click opens edit drawer**: Deferred dedicated order detail page to later phase. For MVP, clicking an order card opens the edit wizard.
- **Dynamic filter selects**: OrderFilters fetches all brokers/drivers inline via existing hooks (useBrokers, useDrivers with pageSize: 100) for select dropdown options.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed z.coerce.number() type mismatch with react-hook-form**
- **Found during:** Task 2 (order-form.tsx TypeScript compilation)
- **Issue:** z.coerce.number() in Zod v4 produces `unknown` input type, causing useForm<CreateOrderValues> type error with zodResolver
- **Fix:** Added CreateOrderInput type (z.input<typeof createOrderSchema>) to order validation, used it for useForm generic and step components' useFormContext. Added explicit value casts on number Input fields.
- **Files modified:** src/lib/validations/order.ts, order-form.tsx, vehicle-step.tsx, pricing-step.tsx
- **Verification:** npx tsc --noEmit passes clean
- **Committed in:** 6ac6f02 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Known Zod v4 type issue (same pattern as 02-03). No scope creep.

## Issues Encountered
None beyond the expected z.input<> type fix.

## User Setup Required
None - no external service configuration required. NHTSA VIN decoder API is public and requires no API key.

## Next Phase Readiness
- Orders CRUD complete with all planned functionality
- Ready for Plan 02-06 (final phase 2 plan)
- Dispatch workflow (Phase 3) will build on the order status lifecycle established here
- Billing & Invoicing (Phase 4) will use the financial fields (revenue, carrierPay, brokerFee)

---
*Phase: 02-data-model-core-entities*
*Completed: 2026-02-11*
