import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Types
// ============================================================================

export type TruckExpenseSourceTable =
  | 'trip_expenses'
  | 'business_expenses'
  | 'fuel_entries'
  | 'maintenance_records'

export type TruckExpenseSourceBadge = 'manual' | 'samsara' | 'quickbooks' | 'efs' | 'msfuelcard'

/**
 * Normalized category — flattens the three distinct per-table enums into one
 * UI-facing vocabulary. Each source row's native category maps to one of these
 * via {@link normalizeCategory}.
 */
export type NormalizedExpenseCategory =
  | 'fuel'
  | 'tolls'
  | 'repairs'
  | 'lodging'
  | 'maintenance'
  | 'insurance'
  | 'truck_lease'
  | 'registration'
  | 'dispatch'
  | 'parking'
  | 'rent'
  | 'telematics'
  | 'salary'
  | 'office_supplies'
  | 'software'
  | 'professional_services'
  | 'misc'

/**
 * QuickBooks sync state for an expense row, derived from the
 * quickbooks_entity_map table in the post-Wave-5 schema:
 *
 *   - `n/a`     → no QB integration connected (UI should hide the badge)
 *   - `pending` → integration connected but no entity_map row yet
 *   - `synced`  → entity_map row with qb_id NOT NULL
 *   - `error`   → entity_map row with qb_id NULL + sync_error set
 */
export type QBSyncStatus = 'n/a' | 'pending' | 'synced' | 'error'

export interface TruckExpenseEntry {
  /** Composite key `${sourceTable}:${sourceId}` — guarantees React list-key uniqueness across source tables. */
  id: string
  sourceTable: TruckExpenseSourceTable
  sourceId: string
  truckId: string
  scope: 'trip' | 'truck' | 'business_allocated'
  category: NormalizedExpenseCategory
  amount: number
  /** ISO date string `YYYY-MM-DD`. Sorted descending by this field in {@link getTruckExpenses}. */
  occurredAt: string
  description: string
  metadata: Record<string, unknown>
  /** `false` for integration-sourced rows (future waves). Manual entries are editable. */
  editable: boolean
  sourceBadge: TruckExpenseSourceBadge
  /** Wave 5: QB push status — populated by {@link getTruckExpenses} via a parallel query. */
  qbSyncStatus: QBSyncStatus
  qbSyncError: string | null
}

export interface ExpenseSummary {
  fuel: number
  tolls: number
  repairs: number
  lodging: number
  maintenance: number
  insurance: number
  truck_lease: number
  registration: number
  fixed_other: number
  other: number
  total: number
}

/** Inclusive date range in ISO `YYYY-MM-DD` format. */
export interface LedgerDateRange {
  from: string
  to: string
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch every expense touching a single truck across all source tables, within
 * the given date range. Runs the four source queries in parallel and merges
 * the results into a single normalized ledger sorted by occurred_at DESC.
 *
 * Tenant isolation is enforced by RLS on each source table — consistent with
 * the rest of `src/lib/queries/*`.
 *
 * @param supabase  An authenticated Supabase client (from `authorize().ctx`)
 * @param truckId   UUID of the truck
 * @param dateRange Inclusive ISO date range
 */
export async function getTruckExpenses(
  supabase: SupabaseClient,
  truckId: string,
  dateRange: LedgerDateRange,
): Promise<TruckExpenseEntry[]> {
  // Run the five parallel queries in one shot: the four source adapters
  // plus a single quickbooks_entity_map fetch for this tenant. The QB
  // status merge happens client-side after all five resolve, so the
  // ledger renders with QB state on first paint — no N+1.
  const [tripExp, bizExp, fuelExp, maintExp, qbMap, qbConnected] =
    await Promise.all([
      fetchTripExpensesForTruck(supabase, truckId, dateRange),
      fetchBusinessExpensesForTruck(supabase, truckId, dateRange),
      fetchFuelEntriesForTruck(supabase, truckId, dateRange),
      fetchMaintenanceRecordsForTruck(supabase, truckId, dateRange),
      fetchQBExpenseStatus(supabase),
      isQBConnected(supabase),
    ])

  const merged = [...tripExp, ...bizExp, ...fuelExp, ...maintExp]
  applyQBStatus(merged, qbMap, qbConnected)

  return merged.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
}

// ---------------------------------------------------------------------------
// QB sync status merge
// ---------------------------------------------------------------------------

/**
 * Maps a `TruckExpenseSourceTable` to the matching QB entity_type subtype
 * stored in `quickbooks_entity_map`. Must stay in sync with
 * `sourceToEntityType` in src/lib/quickbooks/sync.ts — the sync writes
 * these values and the ledger reads them.
 */
function sourceTableToEntityType(table: TruckExpenseSourceTable): string {
  switch (table) {
    case 'trip_expenses':
      return 'expense_trip'
    case 'business_expenses':
      return 'expense_business'
    case 'fuel_entries':
      return 'expense_fuel'
    case 'maintenance_records':
      return 'expense_maintenance'
  }
}

/**
 * Fetch every QB expense entity_map row for this tenant. Scoped via RLS;
 * no explicit `.eq('tenant_id', ...)` needed because this is the query
 * layer pattern. Each row's entity_type tells us which source table it
 * points at (expense_trip / expense_business / expense_fuel /
 * expense_maintenance).
 *
 * The returned map is keyed by `${entity_type}:${vroomx_id}` — the
 * entity_type is part of the key so a UUID that somehow appeared in two
 * different source tables (UUID collisions are astronomically unlikely
 * but the key-disambiguation is free) wouldn't let one subtype's status
 * paint another's ledger row.
 */
async function fetchQBExpenseStatus(
  supabase: SupabaseClient,
): Promise<Map<string, { qbId: string | null; syncError: string | null }>> {
  const { data, error } = await supabase
    .from('quickbooks_entity_map')
    .select('vroomx_id, qb_id, sync_error, entity_type')
    .in('entity_type', [
      'expense_trip',
      'expense_business',
      'expense_fuel',
      'expense_maintenance',
    ])

  if (error) {
    // Swallow — QB status is an adornment, not core ledger data.
    return new Map()
  }

  const map = new Map<string, { qbId: string | null; syncError: string | null }>()
  for (const row of data ?? []) {
    const key = `${row.entity_type as string}:${row.vroomx_id as string}`
    map.set(key, {
      qbId: row.qb_id as string | null,
      syncError: row.sync_error as string | null,
    })
  }
  return map
}

/**
 * Whether the tenant has an active QuickBooks integration. When false,
 * the ledger renders a `n/a` QB status for every row instead of a
 * confusing `pending` that will never resolve.
 */
async function isQBConnected(supabase: SupabaseClient): Promise<boolean> {
  // `.limit(1)` before `.maybeSingle()` is defense-in-depth — the
  // quickbooks_integrations table already has a UNIQUE (tenant_id)
  // constraint, but if a future RLS regression ever let a second row
  // through we'd rather resolve to "not connected" than crash the whole
  // ledger with "Results contain more than one row".
  const { data, error } = await supabase
    .from('quickbooks_integrations')
    .select('sync_status')
    .limit(1)
    .maybeSingle()

  if (error || !data) return false
  const status = data.sync_status as string
  return status !== 'disconnected' && status !== 'paused'
}

/**
 * Mutate each entry's qbSyncStatus / qbSyncError based on the entity_map
 * lookup. Entries without a map row stay as `pending` (new expenses that
 * the fire-and-forget push hasn't completed yet) when QB is connected,
 * or `n/a` when it isn't.
 */
function applyQBStatus(
  entries: TruckExpenseEntry[],
  map: Map<string, { qbId: string | null; syncError: string | null }>,
  connected: boolean,
): void {
  for (const entry of entries) {
    const key = `${sourceTableToEntityType(entry.sourceTable)}:${entry.sourceId}`
    const hit = map.get(key)
    if (hit) {
      if (hit.qbId) {
        entry.qbSyncStatus = 'synced'
        entry.qbSyncError = null
      } else {
        entry.qbSyncStatus = 'error'
        entry.qbSyncError = hit.syncError
      }
    } else {
      entry.qbSyncStatus = connected ? 'pending' : 'n/a'
      entry.qbSyncError = null
    }
  }
}

/**
 * Fetch the last 12 months of revenue / expenses / profit for one truck,
 * bucketed by month (YYYY-MM). Revenue comes from trips.total_revenue
 * (denormalized). Expenses come from the unified ledger so the numbers
 * match the ledger table exactly.
 *
 * Returns an array of 12 points, oldest first, with zero-filled months.
 */
export async function getTruckMonthlyPnl(
  supabase: SupabaseClient,
  truckId: string,
): Promise<Array<{ month: string; revenue: number; expenses: number; profit: number }>> {
  const now = new Date()
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1))
  const windowStartStr = windowStart.toISOString().slice(0, 10)
  // windowEnd is the last day of the CURRENT month so in-progress-month trips are included.
  const windowEndStr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10)

  // Pre-seed 12 zero-filled month buckets
  const buckets = new Map<string, { month: string; revenue: number; expenses: number; profit: number }>()
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth() + i, 1))
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
    buckets.set(key, { month: label, revenue: 0, expenses: 0, profit: 0 })
  }

  // Revenue from trips. Use overlap (start_date <= windowEnd AND end_date >= windowStart)
  // so a multi-day trip that started BEFORE the 12-month window but delivers
  // inside it still contributes its revenue. Bucketing is always by start_date;
  // boundary-crossing trips therefore put revenue in an earlier bucket which may
  // not exist (is silently dropped) — the overlap fetch is the best we can do
  // without splitting trip revenue across months, and matches the overlap logic
  // in fetchTripExpensesForTruck so expenses and revenue stay in lockstep.
  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('total_revenue, start_date')
    .eq('truck_id', truckId)
    .lte('start_date', windowEndStr)
    .gte('end_date', windowStartStr)
  if (tripsError) throw tripsError

  for (const t of trips ?? []) {
    if (!t.start_date) continue
    const key = (t.start_date as string).slice(0, 7)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.revenue += parseFloat((t.total_revenue as string | null) ?? '0')
    }
  }

  // Expenses from the unified ledger
  const entries = await getTruckExpenses(supabase, truckId, { from: windowStartStr, to: windowEndStr })
  for (const entry of entries) {
    const key = entry.occurredAt.slice(0, 7)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.expenses += entry.amount
    }
  }

  return Array.from(buckets.values()).map((b) => ({
    ...b,
    revenue: Math.round(b.revenue * 100) / 100,
    expenses: Math.round(b.expenses * 100) / 100,
    profit: Math.round((b.revenue - b.expenses) * 100) / 100,
  }))
}

/**
 * Roll entries up into a category summary. Any normalized category that
 * doesn't have an explicit bucket on {@link ExpenseSummary} is grouped under
 * `other`, so the returned total always equals the sum of the named buckets.
 */
export function summarizeTruckExpenses(entries: TruckExpenseEntry[]): ExpenseSummary {
  const summary: ExpenseSummary = {
    fuel: 0,
    tolls: 0,
    repairs: 0,
    lodging: 0,
    maintenance: 0,
    insurance: 0,
    truck_lease: 0,
    registration: 0,
    fixed_other: 0,
    other: 0,
    total: 0,
  }

  for (const entry of entries) {
    summary.total += entry.amount
    switch (entry.category) {
      case 'fuel':
        summary.fuel += entry.amount
        break
      case 'tolls':
        summary.tolls += entry.amount
        break
      case 'repairs':
        summary.repairs += entry.amount
        break
      case 'lodging':
        summary.lodging += entry.amount
        break
      case 'maintenance':
        summary.maintenance += entry.amount
        break
      case 'insurance':
        summary.insurance += entry.amount
        break
      case 'truck_lease':
        summary.truck_lease += entry.amount
        break
      case 'registration':
        summary.registration += entry.amount
        break
      case 'dispatch':
      case 'parking':
      case 'rent':
      case 'telematics':
      case 'salary':
      case 'office_supplies':
      case 'software':
      case 'professional_services':
        summary.fixed_other += entry.amount
        break
      case 'misc':
        summary.other += entry.amount
        break
      default: {
        // Exhaustiveness guard — adding a new NormalizedExpenseCategory
        // without a matching arm will fail typecheck here.
        const _exhaustive: never = entry.category
        void _exhaustive
        summary.other += entry.amount
      }
    }
  }

  return roundSummary(summary)
}

// ============================================================================
// Source adapters — one per source table
// ============================================================================

async function fetchTripExpensesForTruck(
  supabase: SupabaseClient,
  truckId: string,
  range: LedgerDateRange,
): Promise<TruckExpenseEntry[]> {
  // trip_expenses has no truck_id column — filter by trip_id where the
  // trip belongs to this truck. Two-step keeps the query simple and reliable.
  //
  // Bound the trips query to the period so a high-mileage fleet doesn't
  // return thousands of historical trip IDs and hit Supabase's .in() array
  // limit, silently dropping trip expenses. Overlap: a trip contributes an
  // expense in the period iff start_date <= range.to AND end_date >= range.from.
  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('id')
    .eq('truck_id', truckId)
    .lte('start_date', range.to)
    .gte('end_date', range.from)

  if (tripsError) throw tripsError
  const tripIds = (trips ?? []).map((t) => t.id as string).filter(Boolean)
  if (tripIds.length === 0) return []

  const { data, error } = await supabase
    .from('trip_expenses')
    .select('id, trip_id, category, custom_label, amount, notes, expense_date, created_at')
    .in('trip_id', tripIds)
    .gte('expense_date', range.from)
    .lte('expense_date', range.to)

  if (error) throw error

  return (data ?? []).map((row) => {
    const occurredAt = (row.expense_date as string | null) ?? (row.created_at as string).slice(0, 10)
    return {
      id: `trip_expenses:${row.id}`,
      sourceTable: 'trip_expenses' as const,
      sourceId: row.id as string,
      truckId,
      scope: 'trip' as const,
      category: normalizeTripExpenseCategory(row.category as string),
      amount: parseMoney(row.amount),
      occurredAt,
      description: (row.custom_label as string | null) ?? categoryLabel(row.category as string),
      metadata: {
        trip_id: row.trip_id,
        notes: row.notes,
      },
      editable: true,
      sourceBadge: 'manual' as const,
      qbSyncStatus: 'pending' as const,
      qbSyncError: null,
    }
  })
}

async function fetchBusinessExpensesForTruck(
  supabase: SupabaseClient,
  truckId: string,
  range: LedgerDateRange,
): Promise<TruckExpenseEntry[]> {
  // Fetch truck-assigned rows whose effective window overlaps the period.
  // Overlap: effective_from <= range.to AND (effective_to IS NULL OR effective_to >= range.from)
  const { data, error } = await supabase
    .from('business_expenses')
    .select('id, name, category, recurrence, amount, effective_from, effective_to, notes')
    .eq('truck_id', truckId)
    .lte('effective_from', range.to)
    .or(`effective_to.is.null,effective_to.gte.${range.from}`)

  if (error) throw error

  const periodStart = new Date(range.from)
  const periodEnd = new Date(range.to)

  const entries: TruckExpenseEntry[] = []

  for (const row of data ?? []) {
    const fullAmount = parseMoney(row.amount)
    const expenseStart = new Date(row.effective_from as string)
    const expenseEnd = row.effective_to ? new Date(row.effective_to as string) : null

    // Clip the expense's window to the period
    const overlapStart = expenseStart > periodStart ? expenseStart : periodStart
    const overlapEnd = expenseEnd && expenseEnd < periodEnd ? expenseEnd : periodEnd
    const overlapMonths = monthsBetween(overlapStart, overlapEnd)
    if (overlapMonths <= 0) continue

    let prorated: number
    switch (row.recurrence as string) {
      case 'monthly':
        prorated = fullAmount * overlapMonths
        break
      case 'quarterly':
        prorated = (fullAmount / 3) * overlapMonths
        break
      case 'annual':
        prorated = (fullAmount / 12) * overlapMonths
        break
      case 'one_time':
        // Only include if the effective_from actually lands in the period
        if (expenseStart >= periodStart && expenseStart <= periodEnd) {
          prorated = fullAmount
        } else {
          prorated = 0
        }
        break
      default:
        prorated = 0
    }

    if (prorated <= 0) continue

    const occurredAt = (row.effective_from as string).slice(0, 10)
    entries.push({
      id: `business_expenses:${row.id}`,
      sourceTable: 'business_expenses' as const,
      sourceId: row.id as string,
      truckId,
      scope: 'business_allocated' as const,
      category: normalizeBusinessExpenseCategory(row.category as string),
      amount: Math.round(prorated * 100) / 100,
      occurredAt,
      description: (row.name as string) ?? categoryLabel(row.category as string),
      metadata: {
        recurrence: row.recurrence,
        effective_from: row.effective_from,
        effective_to: row.effective_to,
        notes: row.notes,
        prorated: true,
        full_amount: fullAmount,
        overlap_months: overlapMonths,
      },
      editable: true,
      sourceBadge: 'manual' as const,
      qbSyncStatus: 'pending' as const,
      qbSyncError: null,
    })
  }

  return entries
}

async function fetchFuelEntriesForTruck(
  supabase: SupabaseClient,
  truckId: string,
  range: LedgerDateRange,
): Promise<TruckExpenseEntry[]> {
  const { data, error } = await supabase
    .from('fuel_entries')
    .select('id, date, gallons, cost_per_gallon, total_cost, odometer, location, state, notes, source, source_external_id')
    .eq('truck_id', truckId)
    .gte('date', range.from)
    .lte('date', range.to)

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: `fuel_entries:${row.id}`,
    sourceTable: 'fuel_entries' as const,
    sourceId: row.id as string,
    truckId,
    scope: 'truck' as const,
    category: 'fuel' as const,
    amount: parseMoney(row.total_cost),
    occurredAt: row.date as string,
    description: (row.location as string | null) ?? 'Fuel purchase',
    metadata: {
      gallons: parseMoney(row.gallons),
      cost_per_gallon: parseMoney(row.cost_per_gallon),
      odometer: row.odometer,
      state: row.state,
      notes: row.notes,
      source_external_id: row.source_external_id,
    },
    // Integration-sourced rows are not editable in the ledger — edits
    // should flow back through the integration, not through the manual
    // add-expense form.
    editable: (row.source as string | null) == null || row.source === 'manual',
    sourceBadge: normalizeSourceBadge(row.source as string | null),
    qbSyncStatus: 'pending' as const,
    qbSyncError: null,
  }))
}

async function fetchMaintenanceRecordsForTruck(
  supabase: SupabaseClient,
  truckId: string,
  range: LedgerDateRange,
): Promise<TruckExpenseEntry[]> {
  const { data, error } = await supabase
    .from('maintenance_records')
    .select('id, maintenance_type, status, description, vendor, cost, scheduled_date, completed_date, odometer, notes')
    .eq('truck_id', truckId)
    .eq('status', 'completed')
    .gte('completed_date', `${range.from}T00:00:00.000Z`)
    .lte('completed_date', `${range.to}T23:59:59.999Z`)

  if (error) throw error

  return (data ?? []).map((row) => {
    const completed = row.completed_date as string | null
    const occurredAt = completed ? completed.slice(0, 10) : range.to
    return {
      id: `maintenance_records:${row.id}`,
      sourceTable: 'maintenance_records' as const,
      sourceId: row.id as string,
      truckId,
      scope: 'truck' as const,
      category: 'maintenance' as const,
      amount: parseMoney(row.cost),
      occurredAt,
      description:
        (row.description as string | null) ??
        maintenanceTypeLabel(row.maintenance_type as string),
      metadata: {
        maintenance_type: row.maintenance_type,
        vendor: row.vendor,
        odometer: row.odometer,
        scheduled_date: row.scheduled_date,
        notes: row.notes,
      },
      editable: true,
      sourceBadge: 'manual' as const,
      qbSyncStatus: 'pending' as const,
      qbSyncError: null,
    }
  })
}

// ============================================================================
// Helpers — pure, exported for direct unit testing
// ============================================================================

export function normalizeTripExpenseCategory(category: string): NormalizedExpenseCategory {
  switch (category) {
    case 'fuel':
    case 'tolls':
    case 'repairs':
    case 'lodging':
    case 'misc':
      return category
    default:
      return 'misc'
  }
}

/**
 * Map the raw `fuel_entries.source` column (free-form text) onto the
 * narrower {@link TruckExpenseSourceBadge} union. Unknown values fall back
 * to 'manual' so the badge rendering never crashes on a legacy row.
 */
export function normalizeSourceBadge(source: string | null): TruckExpenseSourceBadge {
  switch (source) {
    case 'samsara':
    case 'quickbooks':
    case 'efs':
    case 'msfuelcard':
      return source
    case null:
    case undefined:
    case '':
    case 'manual':
      return 'manual'
    default:
      return 'manual'
  }
}

export function normalizeBusinessExpenseCategory(category: string): NormalizedExpenseCategory {
  switch (category) {
    case 'insurance':
    case 'truck_lease':
    case 'registration':
    case 'dispatch':
    case 'parking':
    case 'rent':
    case 'telematics':
    case 'salary':
    case 'office_supplies':
    case 'software':
    case 'professional_services':
      return category
    case 'tolls_fixed':
      return 'tolls'
    default:
      return 'misc'
  }
}

/** Inclusive-month counter: same-month dates count as 1. Uses UTC methods so
 *  timezone offsets on `new Date('YYYY-MM-DD')` (which parses as UTC midnight)
 *  don't cause off-by-one arithmetic in local timezones west of UTC. */
export function monthsBetween(start: Date, end: Date): number {
  if (end < start) return 0
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1
  return Math.max(months, 0)
}

function parseMoney(value: unknown): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  return Number.isFinite(n) ? n : 0
}

function categoryLabel(category: string): string {
  return category
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function maintenanceTypeLabel(type: string): string {
  switch (type) {
    case 'preventive':
      return 'Preventive maintenance'
    case 'repair':
      return 'Repair'
    case 'inspection':
      return 'Inspection'
    case 'tire':
      return 'Tire service'
    case 'oil_change':
      return 'Oil change'
    default:
      return 'Maintenance'
  }
}

function roundSummary(s: ExpenseSummary): ExpenseSummary {
  const r = (n: number) => Math.round(n * 100) / 100
  return {
    fuel: r(s.fuel),
    tolls: r(s.tolls),
    repairs: r(s.repairs),
    lodging: r(s.lodging),
    maintenance: r(s.maintenance),
    insurance: r(s.insurance),
    truck_lease: r(s.truck_lease),
    registration: r(s.registration),
    fixed_other: r(s.fixed_other),
    other: r(s.other),
    total: r(s.total),
  }
}
