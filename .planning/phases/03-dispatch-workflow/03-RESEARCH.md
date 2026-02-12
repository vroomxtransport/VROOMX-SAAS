# Phase 3: Dispatch Workflow - Research

**Researched:** 2026-02-12
**Domain:** Trip management, order assignment, financial calculations, dispatch board UI
**Confidence:** HIGH

## Summary

Phase 3 builds the core value proposition of the TMS: a dispatcher can create trips (truck + driver + date range), assign orders to trips, and view trip-level financial summaries. This phase introduces one new database table (`trips`) plus a new `trip_expenses` table, adds a `trip_id` foreign key to the existing `orders` table, and extends the existing order status workflow with auto-sync behavior when orders are assigned to trips.

The standard approach is to follow the established vertical slice pattern from Phase 2 (schema -> actions -> queries -> hooks -> UI) while adding a new financial calculation module. The Horizon Star TMS provides battle-tested financial logic that should be reimplemented in TypeScript as a pure function. The key architectural decision -- denormalized financial summaries on the trip record -- is already documented in the project's ARCHITECTURE.md and matches the Horizon Star pattern.

**Primary recommendation:** Build trips as a vertical slice following the Phase 2 entity pattern, with financial calculations as a pure TypeScript module that recalculates and denormalizes onto the trip record whenever orders/expenses change. The dispatch board is a table/list view (not cards), departing from the card grid pattern used for entities.

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | App Router, Server Actions, routing | Already in project |
| Supabase JS | 2.95.3 | Database, Auth, Realtime | Already in project |
| TanStack Query | 5.90.21 | Client-side data fetching and caching | Already in project |
| React Hook Form | 7.71.1 | Form state management | Already in project |
| Zod | 4.3.6 | Schema validation | Already in project |
| Drizzle ORM | 0.45.1 | Schema definition, type inference | Already in project |
| shadcn/ui | (radix-ui 1.4.3) | Dialog, Select, Badge, Button, Input | Already in project |
| Zustand | 5.0.11 | UI state (sidebar, modals) | Already in project |
| Lucide React | 0.563.0 | Icons | Already in project |
| date-fns | 4.1.0 | Date formatting and manipulation | Already in project |

### No New Dependencies Required

Phase 3 requires NO new npm packages. All functionality can be built with the existing stack:

- **Trip creation modal:** shadcn/ui `Dialog` component (already installed)
- **Type-ahead search:** Can be built with shadcn `Select` + `Input` filter (already established pattern)
- **Table/list view:** Custom table component with Tailwind (no data table library needed for MVP)
- **Financial calculations:** Pure TypeScript functions (no library needed)
- **Currency formatting:** `Intl.NumberFormat` (already used in order-detail.tsx and order-card.tsx)
- **Date formatting:** `date-fns` (already installed) or `Intl.DateTimeFormat` (already used)

**Confidence: HIGH** -- Verified against existing package.json and codebase patterns.

## Architecture Patterns

### Recommended Project Structure

```
src/
  app/(dashboard)/
    dispatch/                    # NEW: Dispatch board (trips-focused view)
      page.tsx                   # Dispatch board page
      _components/
        dispatch-board.tsx       # Main board component (trip list with filters)
        trip-row.tsx             # Individual trip row in the table
        trip-filters.tsx         # Filter bar (status, driver, truck, date range)
        new-trip-dialog.tsx      # Modal dialog for trip creation
    trips/                       # NEW: Trip detail + management
      [id]/
        page.tsx                 # Trip detail page (wrapper)
      _components/
        trip-detail.tsx          # Trip detail view
        trip-financial-card.tsx  # Financial summary card (6 numbers)
        trip-orders.tsx          # Orders assigned to this trip
        trip-expenses.tsx        # Expense management section
        trip-status-actions.tsx  # Status workflow buttons
        assign-order-dialog.tsx  # "Add Order" dialog with search
    orders/
      _components/
        assign-to-trip.tsx       # NEW: "Assign to Trip" component on order detail
  app/actions/
    trips.ts                     # NEW: Trip CRUD + financial recalculation
    trip-expenses.ts             # NEW: Trip expense CRUD
  db/
    schema.ts                    # ADD: trips table, trip_expenses table, trip_status enum
  hooks/
    use-trips.ts                 # NEW: useTrips, useTrip hooks
    use-trip-expenses.ts         # NEW: useTripExpenses hook
    use-unassigned-orders.ts     # NEW: useUnassignedOrders hook
  lib/
    queries/
      trips.ts                  # NEW: fetchTrips, fetchTrip queries
      trip-expenses.ts           # NEW: fetchTripExpenses query
    validations/
      trip.ts                   # NEW: Trip Zod schema
      trip-expense.ts           # NEW: Trip expense Zod schema
    financial/
      trip-calculations.ts       # NEW: Pure financial calculation functions
  types/
    index.ts                     # ADD: TripStatus, ExpenseCategory types + labels + colors
    database.ts                  # ADD: Trip, TripExpense interfaces
  components/shared/
    status-badge.tsx             # MODIFY: Add 'trip' type support
```

### Pattern 1: Vertical Slice (Established)

**What:** Each entity follows the same file structure: schema -> validation -> actions -> queries -> hooks -> UI components.
**When to use:** For the trips entity (same pattern as orders, drivers, trucks, brokers).
**Confidence: HIGH** -- Directly observed in Phase 2 code.

```typescript
// The established pattern from Phase 2:
// 1. db/schema.ts         - Drizzle table definition + type exports
// 2. types/database.ts    - Snake_case TypeScript interface
// 3. types/index.ts       - Type unions, const arrays, labels, colors
// 4. lib/validations/     - Zod schema with z.input<> for forms
// 5. lib/queries/         - Supabase fetch functions with filters
// 6. hooks/               - TanStack Query hooks + Realtime
// 7. app/actions/         - Server Actions (create, update, delete)
// 8. app/(dashboard)/     - Page + _components/ folder
```

### Pattern 2: Financial Calculation as Pure Functions

**What:** Financial calculations live in a dedicated TypeScript module (`lib/financial/trip-calculations.ts`) as pure functions. They are called from Server Actions whenever data changes, and results are denormalized onto the trip record.
**When to use:** Whenever an order is assigned/unassigned from a trip, or an expense is added/removed/modified.
**Source:** ARCHITECTURE.md Section 6, Horizon Star `getTripFin()` function.
**Confidence: HIGH** -- Documented in project architecture and verified against Horizon Star reference.

```typescript
// lib/financial/trip-calculations.ts
// Source: Horizon Star getTripFin() (lines 10073-10132 in index.html)
// Reimplemented as pure TypeScript function

interface OrderFinancials {
  revenue: number
  brokerFee: number
}

interface DriverConfig {
  driverType: 'company' | 'owner_operator'
  payType: 'percentage_of_carrier_pay' | 'dispatch_fee_percent' | 'per_car'
  payRate: number  // percentage (0-100) or flat amount for per_car
}

interface TripExpenseItem {
  amount: number
  category: string
}

interface TripFinancials {
  revenue: number        // Sum of all order revenues
  brokerFees: number     // Sum of all order broker fees
  carrierPay: number     // Manually entered at trip level
  driverPay: number      // Calculated from driver config
  expenses: number       // Sum of trip expenses
  netProfit: number      // Revenue - Broker Fees - Driver Pay - Expenses - Carrier Pay
}

export function calculateTripFinancials(
  orders: OrderFinancials[],
  driver: DriverConfig,
  expenses: TripExpenseItem[],
  carrierPay: number // Manually entered at trip level
): TripFinancials {
  const revenue = orders.reduce((sum, o) => sum + o.revenue, 0)
  const brokerFees = orders.reduce((sum, o) => sum + o.brokerFee, 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  // Driver pay calculation depends on driver type and pay model
  let driverPay: number

  if (driver.driverType === 'owner_operator') {
    if (driver.payType === 'dispatch_fee_percent') {
      // Owner-operator: company keeps dispatch fee %, driver gets the rest
      // Per context: percentage of revenue AFTER broker fees
      const revenueAfterFees = revenue - brokerFees
      driverPay = revenueAfterFees * (1 - driver.payRate / 100) // Driver gets remainder
      // Note: netProfit for company = dispatch fee = revenueAfterFees * (payRate/100)
    } else if (driver.payType === 'per_car') {
      // Per-car flat rate (e.g., $50/car)
      driverPay = driver.payRate * orders.length
    } else {
      driverPay = 0
    }
  } else {
    // Company driver: percentage of revenue AFTER broker fees
    const revenueAfterFees = revenue - brokerFees
    driverPay = revenueAfterFees * (driver.payRate / 100)
  }

  const netProfit = revenue - brokerFees - driverPay - totalExpenses - carrierPay

  return { revenue, brokerFees, carrierPay, driverPay, expenses: totalExpenses, netProfit }
}
```

### Pattern 3: Denormalized Financial Columns on Trip Record

**What:** After calculating financials, the results are written to denormalized columns on the `trips` table. This makes the dispatch board fast (no JOINs/aggregations at read time).
**When to use:** Every time `recalculateTripFinancials()` is called.
**Source:** ARCHITECTURE.md Section 6, Anti-Pattern 6.
**Confidence: HIGH** -- Explicitly documented as the project's architecture decision.

```typescript
// Server Action pattern for recalculation
// Called after: assign order, unassign order, add/edit/delete expense
export async function recalculateTripFinancials(tripId: string) {
  const supabase = await createClient()

  // 1. Fetch trip with driver's pay config
  const { data: trip } = await supabase
    .from('trips')
    .select('*, driver:drivers(driver_type, pay_type, pay_rate)')
    .eq('id', tripId)
    .single()

  // 2. Fetch orders assigned to this trip
  const { data: orders } = await supabase
    .from('orders')
    .select('revenue, broker_fee')
    .eq('trip_id', tripId)

  // 3. Fetch expenses for this trip
  const { data: expenses } = await supabase
    .from('trip_expenses')
    .select('amount, category')
    .eq('trip_id', tripId)

  // 4. Calculate
  const financials = calculateTripFinancials(
    orders || [],
    trip.driver,
    expenses || [],
    parseFloat(trip.carrier_pay || '0')
  )

  // 5. Denormalize onto trip record
  await supabase
    .from('trips')
    .update({
      total_revenue: financials.revenue,
      total_broker_fees: financials.brokerFees,
      driver_pay: financials.driverPay,
      total_expenses: financials.expenses,
      net_profit: financials.netProfit,
      order_count: orders?.length || 0,
    })
    .eq('id', tripId)

  revalidatePath(`/trips/${tripId}`)
  revalidatePath('/dispatch')
}
```

### Pattern 4: Order-Trip Assignment with Auto-Status Sync

**What:** When an order is assigned to a trip, the order's status automatically transitions. When a trip status changes, all its orders' statuses update accordingly.
**When to use:** Per the CONTEXT.md implementation decisions.
**Confidence: HIGH** -- Directly specified in user decisions.

```typescript
// Status sync rules from CONTEXT.md:
// Order assigned to trip -> order status = 'assigned'
// Trip IN_PROGRESS       -> orders become 'in_transit' (not in current enum)
// Trip COMPLETED         -> orders become 'delivered'
// Individual order status can still be updated independently

// IMPORTANT: The current order status enum is:
// 'new' | 'assigned' | 'picked_up' | 'delivered' | 'invoiced' | 'paid' | 'cancelled'
//
// The context says "Trip IN_PROGRESS -> orders become IN_TRANSIT"
// but the existing enum has 'picked_up', not 'in_transit'.
// Decision: Map trip IN_PROGRESS -> orders 'picked_up' (semantically equivalent
// in auto transport: picked_up means the truck is moving with the vehicle)
```

### Pattern 5: Dispatch Board as Table/List View (NOT Card Grid)

**What:** The dispatch board uses a table/list layout, departing from the card grid used for entities. Each row shows: truck unit #, driver name, capacity (e.g., 7/9), route summary, status badge, date range.
**When to use:** The `/dispatch` page.
**Confidence: HIGH** -- Explicitly decided by user: "trips-focused table/list view, NOT a kanban or split-pane."

```typescript
// Table structure for dispatch board
// Grouped by status sections: Planned, In Progress, At Terminal, Completed
// Each section is a collapsible group with its rows

// Trip row data:
// | Truck (unit #) | Driver | Capacity | Route Summary | Status | Date Range |
// | T-101         | John D. | 7/9     | FL -> NY      | Planned | Jan 5 - Jan 8 |
```

### Pattern 6: Trip Creation via Modal Dialog

**What:** New trips are created from a modal dialog on the dispatch board, not a drawer or separate page. This keeps the dispatcher in context of the board.
**When to use:** "New Trip" button on the dispatch board.
**Confidence: HIGH** -- Explicitly decided by user.

```typescript
// Use shadcn/ui Dialog component (already installed)
// Required fields: Truck (type-ahead), Driver (type-ahead), Start Date, End Date
// After creation, redirect to trip detail page for order assignment
```

### Anti-Patterns to Avoid

- **Computing financials on read (in SQL views):** ARCHITECTURE.md Anti-Pattern 6 explicitly forbids this. Always compute in TS and denormalize.
- **Allowing trip creation without truck + driver:** These are required fields per user decision. Enforce in Zod schema.
- **Building drag-and-drop for order assignment:** Explicitly deferred. Use select-and-assign pattern instead.
- **Showing financials on the dispatch board:** Explicitly decided as detail page only. Board stays purely operational.
- **Separate expenses table without trip_id reference:** Expenses must be linked to trips for financial rollup.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type-ahead search for truck/driver | Custom autocomplete component | shadcn `Select` with filterable options (existing pattern from OrderFilters) | Consistency with existing filter patterns, no extra deps |
| Currency formatting | Custom formatter | `Intl.NumberFormat` (already used in order-detail.tsx) | Built into JS, already in codebase |
| Date range display | Manual string building | `date-fns format()` or `Intl.DateTimeFormat` | Already installed, handles edge cases |
| Status badge colors | Custom styling per component | Extend existing `StatusBadge` component + types/index.ts color maps | Consistency, single source of truth |
| Pagination | Custom pagination | Existing `Pagination` component | Already built and used by all entities |
| Filter bar | Custom filter layout | Existing `FilterBar` component | Already built, handles search + selects |
| Confirm dialogs | Custom dialogs | Existing `ConfirmDialog` component | Already built with loading state |
| Table component | Full data table library (e.g., TanStack Table) | Simple custom table with Tailwind | MVP doesn't need column sorting/resizing/virtual scroll. Keep it simple. |

**Key insight:** The existing shared component library (`filter-bar`, `status-badge`, `pagination`, `confirm-dialog`, `entity-card`, `empty-state`) covers most UI needs. The only truly new UI pattern is the table/list view for the dispatch board (vs. the card grid used for entities).

## Common Pitfalls

### Pitfall 1: Stale Financial Data After Order Reassignment

**What goes wrong:** An order is moved from Trip A to Trip B, but only Trip B's financials are recalculated. Trip A still shows the old order's revenue.
**Why it happens:** The reassignment action updates the order's `trip_id` but only recalculates the new trip, forgetting the old one.
**How to avoid:** Always recalculate BOTH the source trip (old) and destination trip (new) when reassigning an order. The `assignOrderToTrip` server action must: (1) get old trip_id, (2) update order.trip_id, (3) recalculate old trip, (4) recalculate new trip.
**Warning signs:** Financial totals on trips don't match the sum of their assigned orders.

### Pitfall 2: Race Condition on Concurrent Financial Updates

**What goes wrong:** Two dispatchers assign orders to the same trip simultaneously. Both read the current financial state, compute independently, and write back. The last write wins, losing the first order's contribution.
**Why it happens:** Read-modify-write cycle without locking.
**How to avoid:** Use `recalculateTripFinancials()` which reads ALL current orders fresh before computing. Since it always reads all orders for the trip and recomputes from scratch, concurrent calls will converge to the correct result. The last recalculation to complete will have the correct state.
**Warning signs:** Financial totals are sometimes wrong after rapid assignment operations.

### Pitfall 3: Order Status Enum Mismatch with Trip Status Sync

**What goes wrong:** The context says "Trip IN_PROGRESS -> orders become IN_TRANSIT" but the existing order status enum has no `in_transit` value. Adding it would break existing order status workflows.
**Why it happens:** The order status enum was designed in Phase 2 before trip status sync was decided.
**How to avoid:** Map trip status transitions to existing order statuses: Trip IN_PROGRESS -> orders `picked_up` (semantically correct for auto transport). Do NOT add a new `in_transit` status to the order enum.
**Warning signs:** Schema migration errors or broken status workflows.

### Pitfall 4: Missing Capacity Calculation for Truck Type

**What goes wrong:** The dispatch board shows capacity as "X/Y" (e.g., 7/9) but there's no field on the truck for capacity, only `truck_type` (7_car, 8_car, etc.).
**Why it happens:** Capacity is implied by truck type but not stored as a number.
**How to avoid:** Derive capacity from `truck_type` using a lookup map: `{ '7_car': 7, '8_car': 8, '9_car': 9, 'flatbed': 4, 'enclosed': 6 }`. Count assigned orders on the trip as current load. Display as "currentLoad / capacity".
**Warning signs:** Capacity shows as "undefined" or NaN on the dispatch board.

### Pitfall 5: Driver Pay Type Schema Gap -- per_car Not in Enum

**What goes wrong:** The context specifies "Per-car flat rate (e.g., $50/car) -- common for owner-operators" as a driver pay model. But the existing `driver_pay_type` enum is `['percentage_of_carrier_pay', 'dispatch_fee_percent', 'per_mile']` -- no `per_car` option.
**Why it happens:** Phase 2 defined the driver schema before the dispatch workflow decisions were made.
**How to avoid:** Add `per_car` to the `driver_pay_type` enum in the Phase 3 migration. Update the driver form, driver types, and driver pay labels. The existing `pay_rate` field can store the per-car dollar amount (e.g., 50.00). Update: `DRIVER_PAY_TYPE_LABELS.per_car = 'Per Car'`.
**Warning signs:** Cannot select per-car pay type when creating/editing a driver.

### Pitfall 6: Trip Number Auto-Generation Concurrency

**What goes wrong:** Two trips created simultaneously by the same tenant get the same trip number (e.g., both get TRIP-000001).
**Why it happens:** Same pattern as the existing `generate_order_number()` trigger -- the MAX + 1 approach has a race window.
**How to avoid:** Follow the same approach as orders (the existing race window is acceptable for MVP scale). Use a DB trigger with the same `MAX + COALESCE + 1` pattern, which is atomic within a single transaction. At scale, switch to a sequence or `advisory_lock`. The existing order number generator has this same characteristic and hasn't been an issue.
**Warning signs:** Duplicate trip numbers appearing in the system.

### Pitfall 7: Forgetting to Revalidate Both Dispatch and Trip Paths

**What goes wrong:** After an action (assign order, change trip status), the dispatch board updates but the trip detail page still shows stale data, or vice versa.
**Why it happens:** `revalidatePath()` is only called for one path.
**How to avoid:** Always revalidate all affected paths: `/dispatch`, `/trips/[id]`, `/orders/[id]`, and `/orders`. Use `queryClient.invalidateQueries()` for client-side TanStack Query cache too.
**Warning signs:** UI inconsistency between pages until manual refresh.

## Code Examples

### Database Schema: Trips Table

```typescript
// Source: ARCHITECTURE.md Section 5, adapted for CONTEXT.md decisions
// db/schema.ts additions

export const tripStatusEnum = pgEnum('trip_status', [
  'planned', 'in_progress', 'at_terminal', 'completed',
])

export const expenseCategoryEnum = pgEnum('expense_category', [
  'fuel', 'tolls', 'repairs', 'lodging', 'misc',
])

export const trips = pgTable('trips', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  tripNumber: text('trip_number'),
  driverId: uuid('driver_id').notNull().references(() => drivers.id),
  truckId: uuid('truck_id').notNull().references(() => trucks.id),
  status: tripStatusEnum('status').notNull().default('planned'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  // Manually entered financials
  carrierPay: numeric('carrier_pay', { precision: 12, scale: 2 }).default('0'),
  // Denormalized financial summary (computed on write)
  totalRevenue: numeric('total_revenue', { precision: 12, scale: 2 }).default('0'),
  totalBrokerFees: numeric('total_broker_fees', { precision: 12, scale: 2 }).default('0'),
  driverPay: numeric('driver_pay', { precision: 12, scale: 2 }).default('0'),
  totalExpenses: numeric('total_expenses', { precision: 12, scale: 2 }).default('0'),
  netProfit: numeric('net_profit', { precision: 12, scale: 2 }).default('0'),
  orderCount: integer('order_count').default(0),
  // Metadata
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_trips_tenant_id').on(table.tenantId),
  index('idx_trips_tenant_status').on(table.tenantId, table.status),
  index('idx_trips_tenant_driver').on(table.tenantId, table.driverId),
  index('idx_trips_tenant_truck').on(table.tenantId, table.truckId),
  index('idx_trips_tenant_dates').on(table.tenantId, table.startDate, table.endDate),
])

export const tripExpenses = pgTable('trip_expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  category: expenseCategoryEnum('category').notNull().default('misc'),
  customLabel: text('custom_label'),  // For custom expense items
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  notes: text('notes'),
  expenseDate: date('expense_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_trip_expenses_tenant_id').on(table.tenantId),
  index('idx_trip_expenses_trip_id').on(table.tripId),
])
```

### SQL Migration: Add trip_id to Orders + Trips Table

```sql
-- Migration: 00003_trips_and_dispatch.sql
-- Key points:
-- 1. Add trip_id FK to orders table
-- 2. Create trips table with denormalized financial columns
-- 3. Create trip_expenses table
-- 4. Add per_car to driver_pay_type enum
-- 5. RLS policies following established (SELECT ...) wrapper pattern
-- 6. Auto-generate trip numbers (same pattern as order numbers)
-- 7. Composite indexes for dispatch board queries
-- 8. Grant Realtime access

ALTER TABLE public.orders ADD COLUMN trip_id UUID REFERENCES public.trips(id);
CREATE INDEX idx_orders_tenant_trip ON public.orders(tenant_id, trip_id);

-- Add per_car to driver_pay_type enum
ALTER TYPE public.driver_pay_type ADD VALUE 'per_car';
```

### Server Action: Assign Order to Trip

```typescript
// Source: CONTEXT.md "Order-to-trip assignment" decisions
// app/actions/trips.ts

export async function assignOrderToTrip(orderId: string, tripId: string) {
  const supabase = await createClient()

  // 1. Get current order to find old trip_id
  const { data: order } = await supabase
    .from('orders')
    .select('trip_id, status')
    .eq('id', orderId)
    .single()

  const oldTripId = order?.trip_id

  // 2. Update order: set trip_id and auto-sync status to 'assigned'
  await supabase
    .from('orders')
    .update({
      trip_id: tripId,
      status: 'assigned',
    })
    .eq('id', orderId)

  // 3. Recalculate old trip (if was assigned to one)
  if (oldTripId) {
    await recalculateTripFinancials(oldTripId)
  }

  // 4. Recalculate new trip
  await recalculateTripFinancials(tripId)

  revalidatePath('/dispatch')
  revalidatePath(`/trips/${tripId}`)
  if (oldTripId) revalidatePath(`/trips/${oldTripId}`)
  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')

  return { success: true }
}
```

### TanStack Query Hook: useTrips

```typescript
// Source: Existing useOrders pattern from hooks/use-orders.ts
// hooks/use-trips.ts

export function useTrips(filters: TripFilters = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['trips', filters],
    queryFn: () => fetchTrips(supabase, filters),
    staleTime: 30_000,
  })

  // Realtime: subscribe to both trips AND orders changes
  // (order assignment affects trip display)
  useEffect(() => {
    const channel = supabase
      .channel('dispatch-board')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'trips' },
        () => queryClient.invalidateQueries({ queryKey: ['trips'] })
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => queryClient.invalidateQueries({ queryKey: ['trips'] })
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, queryClient])

  return query
}
```

### Capacity Lookup Map

```typescript
// Source: CONTEXT.md "Medium density" row spec (capacity e.g., 7/9)
// types/index.ts or lib/utils

export const TRUCK_CAPACITY: Record<TruckType, number> = {
  '7_car': 7,
  '8_car': 8,
  '9_car': 9,
  'flatbed': 4,
  'enclosed': 6,
}
```

### Trip Query with Relations

```typescript
// Source: Existing fetchOrders pattern with embedded relations
// lib/queries/trips.ts

export interface TripWithRelations extends Trip {
  driver: Pick<Driver, 'id' | 'first_name' | 'last_name' | 'driver_type' | 'pay_type' | 'pay_rate'> | null
  truck: Pick<Truck, 'id' | 'unit_number' | 'truck_type'> | null
}

export async function fetchTrips(
  supabase: SupabaseClient,
  filters: TripFilters = {}
): Promise<TripsResult> {
  let query = supabase
    .from('trips')
    .select(`
      *,
      driver:drivers(id, first_name, last_name, driver_type, pay_type, pay_rate),
      truck:trucks(id, unit_number, truck_type)
    `, { count: 'exact' })
    .order('start_date', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  // Apply filters: status, driver, truck, date range
  // ...

  return { trips, total }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full data table libraries (TanStack Table) for all lists | Simple table for dispatch, card grid for entities | Current best practice | Avoids over-engineering for MVP; TanStack Table adds complexity not needed yet |
| Compute financials in SQL views | Compute in app code, denormalize to table | Established in ARCHITECTURE.md | Fast dispatch board reads, testable business logic |
| Drag-and-drop dispatch UI | Select-and-assign UI | User decision (CONTEXT.md) | Simpler to build, drag-and-drop deferred |

**Note on driver pay models:** The existing codebase has `per_mile` in the driver pay type enum but the CONTEXT.md specifies `per_car` (per-car flat rate) as the relevant model for owner-operators. The `per_mile` type exists in the schema but may not be actively used. Phase 3 should add `per_car` to the enum. The `per_mile` type can remain for future use.

## Financial Calculation Logic -- Detailed Analysis

### Horizon Star Reference (Verified)

The Horizon Star TMS (`/Users/reepsy/Desktop/OG TMS CLAUDE/index.html`, function `getTripFin()` at lines 10073-10132) implements the following financial model:

**Company Driver:**
```
loadRevenue = sum of all order revenues
brokerFees = sum of all order broker_fees
localFees = sum of all order local_fees (not in VroomX -- omit)
cleanGross = loadRevenue - brokerFees - localFees
driverCut = cleanGross * (cutPercent / 100)
directTripExpenses = brokerFees + localFees + driverCut + totalExpenses
netProfit = loadRevenue - directTripExpenses
```

**Owner-Operator:**
```
loadRevenue = sum of all order revenues
brokerFees = sum of all order broker_fees
cleanGross = loadRevenue - brokerFees
dispatchFee = cleanGross * (dispatchFeePercent / 100)
driverCut = 0 (owner-ops are NOT paid by the company)
netProfit = dispatchFee (dispatch fee IS the company's profit)
// Expenses are the owner's responsibility, not deducted from company profit
```

### VroomX Adaptation

Per CONTEXT.md, VroomX simplifies this:

1. **No local_fees field** -- VroomX orders don't have `local_fee`. Omit from calculations.
2. **Per-car flat rate added** -- New pay model not in Horizon Star. `driverPay = payRate * orderCount`
3. **Carrier pay is manually entered** -- At trip level, not per-order. This is a cost the company pays (e.g., to a sub-carrier). Deducted from net profit.
4. **Driver pay percentage basis** -- Per CONTEXT.md: "percentage of revenue AFTER broker fees and local fees" for company drivers, and "dispatch_fee_percent" for owner-operators. This matches Horizon Star's `cleanGross` basis.

### Financial Summary Card Layout (6 Numbers)

Per CONTEXT.md, the trip detail page financial card shows:

| # | Field | Source | Calculation |
|---|-------|--------|-------------|
| 1 | Revenue | Auto-summed | `SUM(orders.revenue)` |
| 2 | Carrier Pay | Manual entry | User enters at trip level |
| 3 | Broker Fees | Auto-summed | `SUM(orders.broker_fee)` |
| 4 | Driver Pay | Calculated | Based on driver's pay model |
| 5 | Expenses | Sum of items | `SUM(trip_expenses.amount)` |
| 6 | Net Profit | Calculated | `Revenue - Broker Fees - Driver Pay - Expenses - Carrier Pay` |

## Open Questions

### 1. Trip Status -> Order Status Mapping for IN_PROGRESS

**What we know:** The context says "Trip IN_PROGRESS -> orders become IN_TRANSIT" but the order enum has no `in_transit` value. The closest is `picked_up`.
**What's unclear:** Should we add `in_transit` to the order enum, or map to `picked_up`?
**Recommendation:** Map to `picked_up`. The existing enum already has a well-defined workflow, and `picked_up` semantically means "vehicle is on the truck, in transit." Adding a new enum value would require a migration AND changes to the existing order status workflow, order timeline, order status actions, and all status labels/colors. The risk outweighs the benefit for an MVP.

### 2. Capacity Numbers for Flatbed and Enclosed

**What we know:** 7_car, 8_car, 9_car have obvious capacities. Flatbed and enclosed do not.
**What's unclear:** What are realistic capacities for flatbed and enclosed trailers in auto transport?
**Recommendation:** Use `flatbed: 4, enclosed: 6` as reasonable defaults. These can be made configurable per truck in a future phase. For MVP, derive from truck_type.

### 3. Trip Expense Custom Categories

**What we know:** CONTEXT.md specifies predefined categories (fuel, tolls, repairs, lodging, misc) PLUS custom expense line items with label + amount.
**What's unclear:** Should custom categories be stored as a new `category` value or as a separate `custom_label` field?
**Recommendation:** Use the predefined `expense_category` enum for the 5 standard categories, plus a `custom_label` TEXT field for user-specified labels. When `category = 'misc'` and `custom_label` is set, display the custom label. This avoids dynamic enum values while supporting arbitrary expense descriptions.

### 4. Sidebar Navigation Update

**What we know:** The current sidebar has "Loads" and "Routes" as placeholder links (not implemented). Phase 3 introduces "Dispatch" and "Trips" as real pages.
**What's unclear:** Should "Loads" become "Orders" and "Routes" become "Dispatch"? Or add new items?
**Recommendation:** Update the sidebar: rename "Loads" -> "Orders" (already at `/orders`), replace "Routes" -> "Dispatch" (at `/dispatch`). This keeps the nav clean and maps to actual pages. The sidebar currently has links to `/loads` and `/routes` which are not implemented -- these should become the functional `/orders` and `/dispatch` pages.

## Sources

### Primary (HIGH confidence)

- **Existing codebase** -- All patterns, types, components, and architecture verified by direct reading of source files:
  - `src/db/schema.ts` -- Drizzle schema pattern
  - `src/app/actions/orders.ts` -- Server Action pattern
  - `src/hooks/use-orders.ts` -- TanStack Query + Realtime pattern
  - `src/lib/queries/orders.ts` -- Supabase query with relations pattern
  - `src/lib/validations/order.ts` -- Zod validation with z.input<> pattern
  - `src/types/index.ts` -- Type unions, const arrays, labels, colors pattern
  - `src/types/database.ts` -- Snake_case interface pattern
  - `src/components/shared/` -- Reusable component library
  - `src/app/(dashboard)/orders/` -- Complete entity UI pattern
  - `supabase/migrations/00002_core_entities.sql` -- SQL migration pattern

- **ARCHITECTURE.md** (.planning/research/) -- Financial calculation strategy, denormalization pattern, anti-patterns
- **PITFALLS.md** (.planning/research/) -- RLS patterns, concurrent updates
- **Horizon Star TMS** (`/Users/reepsy/Desktop/OG TMS CLAUDE/index.html`) -- Financial calculation logic (`getTripFin()` function, lines 10073-10132)

### Secondary (MEDIUM confidence)

- **CONTEXT.md** (.planning/phases/03-dispatch-workflow/) -- User decisions constraining implementation

### Tertiary (LOW confidence)

- Truck capacity numbers for flatbed/enclosed (estimated, not verified with industry data)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already installed and verified in package.json
- Architecture: HIGH -- All patterns verified against existing codebase and ARCHITECTURE.md
- Financial calculations: HIGH -- Verified against Horizon Star source code
- UI patterns: HIGH -- Verified against existing Phase 2 UI components
- Pitfalls: HIGH -- Derived from codebase analysis and ARCHITECTURE.md anti-patterns
- Truck capacity defaults: LOW -- Estimated values for flatbed/enclosed

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (stable -- no fast-moving dependencies)
