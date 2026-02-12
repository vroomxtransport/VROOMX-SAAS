---
phase: 04-billing-invoicing
plan: 02
subsystem: invoicing
tags: [react-pdf, resend, react-email, pdf, email, api-routes]

# Dependency graph
requires:
  - phase: 04-billing-invoicing
    plan: 01
    provides: "payment_status enum, billing columns on orders, tenant company info columns"
provides:
  - "InvoiceDocument component for PDF generation via @react-pdf/renderer"
  - "Resend client singleton for email delivery"
  - "InvoiceEmail React Email template for invoice notifications"
  - "GET /api/invoices/[orderId]/pdf route returning PDF buffer"
  - "POST /api/invoices/[orderId]/send route generating PDF, emailing, and updating order status"
affects:
  - 04-04 (order detail page will use invoice send/download buttons)
  - 04-05 (billing page will use batch send invoice functionality)

# Tech tracking
tech-stack:
  added: []
  patterns: ["renderToBuffer in API route handler", "Resend email with PDF attachment", "React Email inline-styled template"]

key-files:
  created:
    - "src/lib/resend/client.ts"
    - "src/lib/pdf/invoice-template.tsx"
    - "src/components/email/invoice-email.tsx"
    - "src/app/api/invoices/[orderId]/pdf/route.ts"
    - "src/app/api/invoices/[orderId]/send/route.ts"
  modified: []

key-decisions:
  - "Uint8Array conversion for Response body (Buffer not accepted by Web Response API)"
  - "Invoice number format INV-{orderId} using full UUID per locked decision"
  - "Conditional status updates: only advance if currently unpaid/delivered"

patterns-established:
  - "API route handler for binary response (PDF) with renderToBuffer"
  - "Resend email send with react template and Buffer attachment"
  - "Conditional order status update preserving idempotency on re-send"

# Metrics
duration: 3min
completed: 2026-02-12
---

# Phase 4 Plan 02: Invoice PDF Generation & Email Delivery Summary

**React-PDF invoice template with company header/bill-to/line-items/footer, Resend client singleton, React Email notification template, and two API route handlers for PDF download and invoice email sending with order status updates**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-12T08:14:05Z
- **Completed:** 2026-02-12T08:16:41Z
- **Tasks:** 2
- **Files created:** 5

## Accomplishments
- Invoice PDF template renders company header (tenant name, address, city/state/zip, phone), bill-to section (broker name/email), line items table (vehicle year/make/model, pickup->delivery route, carrier pay), VIN row when available, total due, and thank-you footer
- Resend client singleton exports `resend` instance using RESEND_API_KEY env var
- React Email invoice notification with preview text, heading, order reference, bold amount due, and tenant footer using inline styles for cross-client compatibility
- GET /api/invoices/[orderId]/pdf returns PDF buffer with Content-Type application/pdf and inline disposition
- POST /api/invoices/[orderId]/send generates PDF, emails to broker via Resend with PDF attachment, and conditionally updates order payment_status to 'invoiced', sets invoice_date (only if not already set), and advances order status from 'delivered' to 'invoiced'

## Task Commits

Each task was committed atomically:

1. **Task 1: Create invoice PDF template and Resend client** - `9eb62d8` (feat)
2. **Task 2: Create API route handlers for PDF generation and invoice sending** - `7ccf6f7` (feat)

## Files Created
- `src/lib/resend/client.ts` - Resend client singleton with env var
- `src/lib/pdf/invoice-template.tsx` - InvoiceDocument component with company header, bill-to, line items, total, footer
- `src/components/email/invoice-email.tsx` - InvoiceEmail component with inline styles for email client compatibility
- `src/app/api/invoices/[orderId]/pdf/route.ts` - GET handler: auth check, fetch order+tenant, renderToBuffer, return PDF Response
- `src/app/api/invoices/[orderId]/send/route.ts` - POST handler: auth check, fetch order+tenant, generate PDF, send via Resend, update order status

## Decisions Made
- Used `Uint8Array(pdfBuffer)` for Response body since Node Buffer is not directly accepted by the Web Response API in strict TypeScript
- Invoice number format is `INV-{orderId}` using the full order UUID, per the locked decision in the plan
- Status updates are conditional: payment_status only changes from 'unpaid' to 'invoiced', invoice_date only set if null (preserves original on re-send), order status only advances from 'delivered' to 'invoiced'
- Resend from-email uses RESEND_FROM_EMAIL env var with fallback to onboarding@resend.dev for development

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Buffer type incompatible with Web Response API**
- **Found during:** Task 2 (PDF route handler)
- **Issue:** `renderToBuffer` returns a Node.js Buffer which TypeScript rejects as `BodyInit` for `new Response()`
- **Fix:** Wrapped in `new Uint8Array(pdfBuffer)` to convert to a type accepted by the Web Response constructor
- **Files modified:** src/app/api/invoices/[orderId]/pdf/route.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** 7ccf6f7 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minimal - standard type conversion fix for Node.js Buffer in Web API context.

## Issues Encountered
None beyond the Buffer type deviation documented above.

## User Setup Required
- Set `RESEND_API_KEY` environment variable for email delivery
- Optionally set `RESEND_FROM_EMAIL` for custom sender address (requires Resend domain verification)
- Default fallback uses `onboarding@resend.dev` for development

## Next Phase Readiness
- Invoice PDF template and email template ready for use by order detail page (Plan 04)
- API routes ready for integration with "Send Invoice" and "Download PDF" buttons
- Billing page (Plan 05) can use the send route for batch invoice sending
- Payment data layer (Plan 03) can proceed independently (no dependency on this plan)

---
*Phase: 04-billing-invoicing*
*Completed: 2026-02-12*
