# Phase 2: Data Model + Core Entities - Context

**Gathered:** 2026-02-11
**Status:** Ready for planning

<domain>
## Phase Boundary

CRUD interfaces for orders, drivers, trucks, and brokers — the core data a dispatcher works with daily. All entity management is functional with proper forms, validation, list views, and tenant isolation. Does NOT include dispatch workflow (trip creation/assignment — Phase 3) or billing/invoicing logic (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### List view design
- Card grid layout (not data table)
- Each card shows: Order ID, vehicle (year/make/model), origin → destination, shipper/customer, status badge, price
- Reference: Super Dispatch detail level with Ship.Cars cleaner aesthetic — but our own design, not a copy
- Quick actions on each card: status change + edit (no full action menu)
- Clicking a card opens detail view

### Filtering & sorting
- Claude's discretion — use best practices and reference Horizon Star approach
- Should support filtering by status, date range, driver, broker at minimum

### Form & creation flow
- Slide-out drawer for all entity creation (orders, drivers, trucks, brokers)
- Orders use multi-step wizard inside the drawer: Step 1 Vehicle → Step 2 Pickup/Delivery → Step 3 Pricing & Broker
- Simpler entities (drivers, trucks, brokers) use single-form drawer
- Auto-save drafts — form state persists if drawer closed, shows "Draft" status in list
- Confirmation warning before discarding unsaved changes

### VIN entry
- VIN decode as primary input — auto-fills year, make, model, type
- Manual entry fallback for when VIN is unavailable
- Both options accessible on the vehicle step of order creation

### Order status workflow
- 6 statuses: **New → Assigned → Picked Up → Delivered → Invoiced → Paid**
- Plus **Cancelled** status — can be applied at any point before Delivered, requires a reason (customer cancelled, no driver available, pricing issue, etc.)
- Rollback allowed — any status can go back one step for corrections
- Color-coded status badges on cards and detail views (distinct color per status)

### Driver pay configuration
- Three pay types: **percentage of carrier pay**, **dispatch fee %**, **per mile**
- Default pay type & rate set on driver profile
- Pay calculates at the order level — drivers can be assigned to orders directly without trips
- Supports pay-period-based settlement (not just per-trip) — companies that don't use trips pay drivers by pay periods
- Driver detail page shows assigned orders list + earnings summary (total earned, pending, by period)

### Broker records
- Core fields: name, contact info
- Payment terms: net days (Net 15, Net 30, etc.), payment method preference, factoring company if applicable

### Cross-entity navigation
- Clickable links for related entities — click a broker name on an order to jump to broker detail, click a driver name to see driver page
- No hover popovers — clean link-based navigation

### Claude's Discretion
- Filtering/sorting UI pattern (filter bar vs panel vs hybrid)
- Card spacing, typography, color palette for status badges
- Loading states and skeleton screens
- Pagination approach (infinite scroll vs numbered pages)
- Error handling and validation UX
- Truck status management specifics
- Empty state designs for each entity list

</decisions>

<specifics>
## Specific Ideas

- Order cards reference Super Dispatch's information density and Ship.Cars' clean card aesthetic — but VroomX's own design language
- Driver pay must work independently of trips — many carriers assign orders directly and pay by pay period, not per trip
- VIN decode with manual fallback mirrors industry workflow (drivers often have VIN from rate confirmations)
- Cancellation with required reason provides audit trail for disputes

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-data-model-core-entities*
*Context gathered: 2026-02-11*
