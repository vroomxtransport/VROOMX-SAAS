---
phase: 04-billing-invoicing
plan: 01
subsystem: database
tags: [postgres, drizzle, zod, billing, payments, rls]

# Dependency graph
requires:
  - phase: 02-data-model
    provides: "orders and tenants tables, Drizzle schema patterns"
  - phase: 03-dispatch-workflow
    provides: "trips table pattern, migration conventions"
provides:
  - "payment_status enum in SQL, Drizzle, and TypeScript"
  - "payments table with RLS and tenant isolation"
  - "Billing columns on orders (payment_status, invoice_date, amount_paid)"
  - "Company info columns on tenants (address, city, state, zip, phone)"
  - "PaymentStatus type union with labels and colors"
  - "recordPaymentSchema Zod validation"
  - "npm: @react-pdf/renderer, resend, @react-email/components"
affects:
  - 04-billing-invoicing (all subsequent plans depend on this foundation)

# Tech tracking
tech-stack:
  added: ["@react-pdf/renderer", "resend", "@react-email/components"]
  patterns: ["payment_status enum across SQL/Drizzle/TS layers"]

key-files:
  created:
    - "supabase/migrations/00004_billing_invoicing.sql"
    - "src/lib/validations/payment.ts"
  modified:
    - "src/db/schema.ts"
    - "src/types/database.ts"
    - "src/types/index.ts"
    - "package.json"

key-decisions:
  - "paymentStatusEnum declared in top-level Enums section (not Phase 4 section) to avoid use-before-declaration"
  - "Payments table follows trips RLS pattern exactly for consistency"

patterns-established:
  - "Payment status enum: unpaid -> invoiced -> partially_paid -> paid"
  - "Denormalized amount_paid on orders (same pattern as trips financial fields)"

# Metrics
duration: 3min
completed: 2026-02-12
---

# Phase 4 Plan 01: Database Foundation Summary

**payment_status enum, payments table with RLS, billing columns on orders/tenants, PaymentStatus types, and Zod payment validation schema**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-12T08:06:44Z
- **Completed:** 2026-02-12T08:09:59Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- SQL migration with payment_status enum, payments table, billing columns on orders, company info on tenants, RLS policies, indexes, triggers, and Realtime grants
- Drizzle schema updated with payments table, paymentStatusEnum, and billing/company columns
- TypeScript interfaces updated: Payment, Order (with payment_status/invoice_date/amount_paid), Tenant (with address/city/state/zip/phone)
- PaymentStatus type union with PAYMENT_STATUS_LABELS and PAYMENT_STATUS_COLORS
- recordPaymentSchema Zod validation ready for form binding
- Installed @react-pdf/renderer, resend, @react-email/components

## Task Commits

Each task was committed atomically:

1. **Task 1: Install npm dependencies and create SQL migration** - `d8d7543` (feat)
2. **Task 2: Update Drizzle schema, TypeScript types, and create payment validation** - `1199c1d` (feat)

## Files Created/Modified
- `supabase/migrations/00004_billing_invoicing.sql` - Payment status enum, payments table, billing columns, RLS, indexes, triggers
- `src/db/schema.ts` - paymentStatusEnum, payments table, billing columns on orders, company info on tenants
- `src/types/database.ts` - Payment interface, billing fields on Order, company fields on Tenant
- `src/types/index.ts` - PaymentStatus type, PAYMENT_STATUSES, labels, colors
- `src/lib/validations/payment.ts` - recordPaymentSchema with Zod validation
- `package.json` - Added @react-pdf/renderer, resend, @react-email/components

## Decisions Made
- paymentStatusEnum declared in top-level Enums section to avoid TypeScript use-before-declaration error (orders table references it before Phase 4 section)
- Payments table follows trips RLS pattern exactly (select/insert/update/delete policies with get_tenant_id())

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] paymentStatusEnum declared after use in orders table**
- **Found during:** Task 2 (Drizzle schema update)
- **Issue:** Plan placed paymentStatusEnum in a "Phase 4 Enums" section after the orders table, causing TypeScript error TS2448 (used before declaration)
- **Fix:** Moved paymentStatusEnum to top-level Enums section alongside all other enums
- **Files modified:** src/db/schema.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** 1199c1d (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for TypeScript compilation. No scope creep.

## Issues Encountered
None beyond the enum placement deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All database tables, types, and validations ready for Wave 2 plans
- 04-02 (Invoice PDF Generation) can use Payment, PaymentStatus types and tenant company info
- 04-03 (Payment Data Layer) can use payments table, recordPaymentSchema, and server action patterns
- 04-04 and 04-05 can build on the foundation established here

---
*Phase: 04-billing-invoicing*
*Completed: 2026-02-12*
