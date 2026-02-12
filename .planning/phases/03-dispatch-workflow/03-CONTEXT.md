# Phase 3: Dispatch Workflow - Context

**Gathered:** 2026-02-11
**Status:** Ready for planning

<domain>
## Phase Boundary

A dispatcher can create trips, assign orders to trips, and see trip-level financial summaries. The core dispatch workflow — the primary value proposition of the TMS — is functional. This phase covers trip-based dispatching only (truck + driver + date range + grouped orders).

</domain>

<decisions>
## Implementation Decisions

### Dispatch board layout
- **Trips board** — the dispatch board is a trips-focused table/list view, NOT a kanban or split-pane
- All trips shown by default with filtering capabilities (status, driver, truck, date range)
- Trips grouped into status sections (Planned, In Progress, At Terminal, Completed) with color-coded status badges on each row
- **Medium density** — each trip row shows: truck (unit #), driver name, capacity (e.g., 7/9), route summary, status badge, date range
- **Financials NOT shown on board** — detail page only. Board stays purely operational
- **Orders are on their own dedicated page** (already built in Phase 2) — NOT a sidebar or tab on the dispatch board. Orders page has full search and filtering (by Order ID, Broker, Vehicle, Status, Driver, etc.)
- Start with all drivers/trucks visible to all dispatchers. Per-dispatcher filtering is a future concern

### Order-to-trip assignment
- **Both directions** — assign from trip detail page ("Add Order" button → search/browse orders) OR from order detail page ("Assign to Trip" dropdown/search)
- **One trip per order, easy reassign** — moving an order to a different trip is a single action. Old trip auto-updates its counts and financials
- **Soft validation warnings** — warn on capacity overflow and geographic mismatches, but always allow override
- **Auto status sync** — when order is assigned to trip → order status becomes ASSIGNED. When trip moves to IN_PROGRESS → orders become IN_TRANSIT. When trip COMPLETED → orders become DELIVERED. Individual order status can still be updated independently if needed (e.g., one order delivered early)

### Trip creation flow
- **Required fields:** Truck + Driver + Date range (start date / end date)
- **Truck selection:** Type-ahead dropdown search by unit number
- **Driver selection:** Type-ahead dropdown search by driver name
- **One truck, one driver** per trip. Simple 1:1 relationship
- **Modal dialog** from the dispatch board — click "New Trip" → modal with form fields. Quick creation, stays in context of the board
- Orders are added AFTER trip creation (from trip detail page)

### Trip financial summary
- **Summary card at top of trip detail page** with 6 key numbers:
  1. Revenue (auto-summed from assigned orders' rates)
  2. Carrier Pay
  3. Broker Fees (auto-summed from orders, per-order only, no trip-level override)
  4. Driver Pay
  5. Expenses
  6. Net Profit
- **Revenue:** Auto-calculated — sum of all assigned orders' rates
- **Broker fees:** Per-order field, trip auto-sums. No trip-level override
- **Driver pay — two models:**
  - Per-car flat rate (e.g., $50/car) — common for owner-operators
  - Percentage of revenue AFTER broker fees and local fees — common for company drivers
  - Each driver's pay model is determined by their driver profile (set in Phase 2)
- **Expenses:** Predefined categories (fuel, tolls, repairs, lodging, misc) PLUS ability to add custom expense line items with label + amount
- **Carrier pay and other costs:** Manually entered at trip level
- **Net profit:** Revenue - Broker Fees - Driver Pay - Expenses - Carrier Pay (auto-calculated)

### Claude's Discretion
- Exact table column widths and responsive breakpoints
- Trip status transition confirmation UX (button vs dropdown)
- Loading states and skeleton screens for financial calculations
- Search/filter component implementation details
- Exact color palette for status badges (follow existing design system)
- Trip numbering/naming scheme (auto-generated trip IDs)

</decisions>

<specifics>
## Specific Ideas

- Reference **Horizon Star TMS** for financial logic and calculation patterns — reimplement in TypeScript
- Orders page should feel like Horizon Star's order list: full search by Order ID/Broker/Vehicle, filters for Status/Dispatcher/Driver/Broker, showing total count (e.g., "Showing 625 of 625")
- Two dispatch models exist in auto transport: trip-based (this phase) and direct-assignment/period-based (deferred). Trip-based carriers calculate financials when trip is done
- Driver pay percentage is based on revenue AFTER broker fees AND local fees (not gross revenue)

</specifics>

<deferred>
## Deferred Ideas

- **Direct-assignment dispatching** (no trips) — some carriers assign orders individually to drivers without grouping into trips, using pay periods (weekly) for payroll calculation. This is a separate dispatch model and warrants its own phase
- **Per-dispatcher driver assignment** — dispatchers managing only their assigned subset of drivers/trucks. Start with "see all" for now
- **Co-driver / team driving** — optional second driver on a trip for long hauls
- **Drag-and-drop assignment** — drag orders onto trip cards on the board. Nice UX but not MVP
- **Trip-level broker fee override** — ability to adjust broker fees at trip level vs per-order only

</deferred>

---

*Phase: 03-dispatch-workflow*
*Context gathered: 2026-02-11*
