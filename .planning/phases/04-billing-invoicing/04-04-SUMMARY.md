---
phase: 04-billing-invoicing
plan: 04
subsystem: ui
tags: [react, shadcn, react-hook-form, sonner, supabase-realtime, payments, invoicing]

# Dependency graph
requires:
  - phase: 04-02
    provides: Invoice PDF generation and email send API routes
  - phase: 04-03
    provides: Payment server actions, usePaymentsByOrder Realtime hook
provides:
  - PaymentRecorder component with status badge, balance progress, payment history, and recording form
  - InvoiceButton component with send/resend invoice and PDF download
  - Billing section integrated into order detail page for picked_up/delivered/invoiced/paid statuses
  - Broker email included in order queries for invoice delivery check
affects: [04-billing-invoicing, 05-onboarding]

# Tech tracking
tech-stack:
  added: [sonner]
  patterns: [toast notifications via sonner Toaster in root layout, conditional billing section rendering by order status]

key-files:
  created:
    - src/app/(dashboard)/orders/_components/payment-recorder.tsx
    - src/app/(dashboard)/orders/_components/invoice-button.tsx
  modified:
    - src/app/(dashboard)/orders/_components/order-detail.tsx
    - src/lib/queries/orders.ts
    - src/app/layout.tsx

key-decisions:
  - "Sonner installed for toast notifications (first toast library in project)"
  - "Toaster added to root layout.tsx for global availability"
  - "Invoice number displayed as INV-{orderId first 8 chars} for compact display"
  - "Billing section conditionally rendered for picked_up/delivered/invoiced/paid statuses"

patterns-established:
  - "Toast pattern: import { toast } from 'sonner', use toast.success/toast.error for user feedback"
  - "Conditional section rendering: status array check for showing billing-relevant UI"

# Metrics
duration: 4min
completed: 2026-02-12
---

# Phase 4 Plan 04: Order Detail Billing Section Summary

**PaymentRecorder and InvoiceButton components wired into order detail page with Realtime payment history, Zod-validated recording form, and invoice send/download via sonner toast feedback**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-12T08:20:16Z
- **Completed:** 2026-02-12T08:24:18Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- PaymentRecorder component: payment status badge with color coding, balance progress bar, scrollable payment history with Realtime updates, and a record payment form with react-hook-form + Zod validation
- InvoiceButton component: send invoice via POST API, resend support for already-invoiced orders, PDF download in new tab, disabled state with tooltip when broker email missing
- Billing section in order detail page conditionally rendered for orders in picked_up/delivered/invoiced/paid statuses
- Broker email added to order query selects for invoice delivery eligibility check
- Sonner toast library installed and Toaster provider added to root layout for project-wide notifications

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PaymentRecorder and InvoiceButton components** - `d3cb36a` (feat)
2. **Task 2: Integrate billing components into order detail page** - `26dbddb` (feat)

## Files Created/Modified
- `src/app/(dashboard)/orders/_components/payment-recorder.tsx` - Payment status display, balance progress, payment history list, record payment form
- `src/app/(dashboard)/orders/_components/invoice-button.tsx` - Send/resend invoice button, PDF download, broker email tooltip
- `src/app/(dashboard)/orders/_components/order-detail.tsx` - Added billing section with PaymentRecorder and InvoiceButton
- `src/lib/queries/orders.ts` - Added broker email to OrderWithRelations type and both select queries
- `src/app/layout.tsx` - Added sonner Toaster to root layout

## Decisions Made
- Installed sonner as the toast notification library (first in project) -- lightweight, good React 19 support
- Added Toaster to root layout.tsx (not dashboard layout) for global availability across auth and dashboard pages
- Invoice number in InvoiceButton displayed as `INV-{orderId.slice(0,8)}` for compact display while using full UUID per locked decision
- Billing section uses status array check pattern: `(['picked_up', 'delivered', 'invoiced', 'paid'] as OrderStatus[]).includes(status)`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed sonner toast library and added Toaster provider**
- **Found during:** Task 1 (PaymentRecorder component)
- **Issue:** Plan specified using sonner for toast feedback, but sonner was not installed and no Toaster provider existed
- **Fix:** Ran `npm install sonner`, added `<Toaster position="top-right" richColors />` to root layout
- **Files modified:** package.json, package-lock.json, src/app/layout.tsx
- **Verification:** TypeScript compiles, sonner import resolves
- **Committed in:** d3cb36a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for toast notifications in PaymentRecorder and InvoiceButton. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in `src/app/(dashboard)/billing/` (batch-actions and aging-table modules not yet created -- Plan 05 scope). Not related to this plan's changes. Our files compile cleanly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All billing UI components are wired to the order detail page
- PaymentRecorder connects to recordPayment server action (Plan 03) with auto-status transitions
- InvoiceButton connects to invoice API routes (Plan 02) for PDF generation and email sending
- Ready for Plan 05: Billing dashboard with receivables table, aging analysis, and batch actions

---
*Phase: 04-billing-invoicing*
*Completed: 2026-02-12*
