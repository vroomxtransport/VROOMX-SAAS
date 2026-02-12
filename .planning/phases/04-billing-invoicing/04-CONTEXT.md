# Phase 4: Billing & Invoicing - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Track order payments, generate and email invoices, view broker receivables, and analyze aging. The financial backbone of the TMS — carriers see who owes money, how much, and how long overdue. Creating new financial entities or reporting beyond receivables/aging belongs in other phases.

</domain>

<decisions>
## Implementation Decisions

### Receivables dashboard
- New top-level "Billing" page in sidebar navigation
- Table grouped by broker as primary view
- Per-broker row shows: total owed, invoice count, oldest unpaid, paid this month, overdue amount
- Clicking a broker row navigates to the existing broker detail page (add receivables section there)

### Invoice design & delivery
- Order-level invoices (one invoice per order, not per trip)
- Invoice number format: INV-{order_id} (e.g., INV-1234)
- Company info header (name, address, phone) — no logo upload for MVP
- Invoice PDF shows: VINs, pickup/delivery locations, carrier pay, broker info, dates
- One-click "Send Invoice" button on order detail page (emails to broker's contact email)
- Batch send from receivables page — select multiple unpaid orders and send invoices in bulk
- Email delivery via Resend

### Payment tracking flow
- Partial payments supported — record multiple payments against an order, track remaining balance
- Payment statuses: Unpaid → Invoiced → Partially Paid → Paid
- Auto-transition to "Paid" when balance reaches zero
- Inline payment recording on order detail page — enter amount + date, click "Record Payment"
- Batch "Mark Paid" from receivables page — checkbox selection, single date applied to all selected
- Collection rate metric: % of invoiced amount collected

### Aging analysis display
- Lives as a section on the receivables page (below broker table, same scroll)
- Table with bucket columns: Current / 1-30 / 31-60 / 61-90 / 90+ days
- One row per broker with dollar amounts in each bucket
- Color-coded by severity: green (current) → yellow (1-30) → orange (31-60) → red (61-90) → dark red (90+)
- Clicking a bucket cell drills down to show specific overdue orders for that broker/bucket combination

### Claude's Discretion
- Invoice PDF layout and styling details
- Payment recording form field arrangement
- Exact drill-down behavior (inline expand vs filtered view vs modal)
- Aging calculation logic (based on invoice date vs due date)
- Receivables page responsive layout
- Collection rate visualization approach

</decisions>

<specifics>
## Specific Ideas

- Invoice number tied to order ID (INV-{order_id}) for easy cross-referencing
- Receivables and aging on the same page — dispatcher sees full financial picture without switching tabs
- Batch operations are important — both for sending invoices and marking payments
- Partial payments need proper status tracking (Partially Paid as distinct state)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-billing-invoicing*
*Context gathered: 2026-02-12*
