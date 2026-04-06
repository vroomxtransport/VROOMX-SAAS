import type { SupabaseClient } from '@supabase/supabase-js'
import type { DateRange } from '@/types/filters'
import { getDateBounds } from '@/lib/queries/financials'
import { format, startOfWeek } from 'date-fns'
import type {
  ReportConfig,
  MetricDefinition,
  DimensionDefinition,
  ReportResult,
} from './report-config'

// ============================================================================
// Table Name Mapping
// ============================================================================

const DATA_SOURCE_TABLE: Record<string, string> = {
  orders: 'orders',
  trips: 'trips',
  drivers: 'drivers',
  trucks: 'trucks',
  brokers: 'brokers',
  expenses: 'business_expenses',
}

// Date column per data source (for date range filtering)
const DATE_COLUMN: Record<string, string | null> = {
  orders: 'created_at',
  trips: 'start_date',
  expenses: 'effective_from',
  drivers: null,
  trucks: null,
  brokers: null,
}

// Columns needed for computed metrics
const COMPUTED_DEPS: Record<string, string[]> = {
  order_clean_gross: ['revenue', 'broker_fee', 'local_fee'],
  order_net_after_fees: ['revenue', 'broker_fee', 'local_fee', 'carrier_pay'],
}

// ============================================================================
// Date Formatting
// ============================================================================

function formatDateForGranularity(
  value: string | null,
  granularity?: 'day' | 'week' | 'month' | 'quarter' | 'year'
): string {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (isNaN(date.getTime())) return String(value)

  switch (granularity) {
    case 'day':
      return format(date, 'yyyy-MM-dd')
    case 'week':
      return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    case 'month':
      return format(date, 'yyyy-MM')
    case 'quarter': {
      const q = Math.ceil((date.getMonth() + 1) / 3)
      return `Q${q} ${date.getFullYear()}`
    }
    case 'year':
      return format(date, 'yyyy')
    default:
      return String(value)
  }
}

// ============================================================================
// Aggregation
// ============================================================================

function aggregateValues(
  values: number[],
  fn: 'sum' | 'avg' | 'count' | 'min' | 'max'
): number | null {
  if (fn === 'count') return values.length

  const valid = values.filter((v) => !isNaN(v))
  if (valid.length === 0) return null

  switch (fn) {
    case 'sum':
      return valid.reduce((a, b) => a + b, 0)
    case 'avg':
      return valid.reduce((a, b) => a + b, 0) / valid.length
    case 'min':
      return Math.min(...valid)
    case 'max':
      return Math.max(...valid)
  }
}

// ============================================================================
// Main Engine
// ============================================================================

export async function executeReport(
  supabase: SupabaseClient,
  config: ReportConfig,
  metrics: MetricDefinition[],
  dimensions: DimensionDefinition[],
  dateRange?: DateRange,
  /** When using service-role client (e.g. cron), pass tenant_id explicitly for isolation */
  tenantId?: string
): Promise<ReportResult> {
  const emptyResult: ReportResult = {
    columns: [],
    rows: [],
    totalRows: 0,
    executedAt: new Date().toISOString(),
  }

  try {
    const tableName = DATA_SOURCE_TABLE[config.dataSource]
    if (!tableName) return emptyResult

    // Build select columns from metrics and dimensions
    const selectCols = new Set<string>(['id'])

    for (const m of metrics) {
      selectCols.add(m.column)
      // Add dependency columns for computed metrics
      const deps = COMPUTED_DEPS[m.id]
      if (deps) deps.forEach((d) => selectCols.add(d))
    }

    for (const d of dimensions) {
      selectCols.add(d.column)
    }

    const selectString = Array.from(selectCols).join(', ')

    // Build query
    let query = supabase.from(tableName).select(selectString)

    // Tenant isolation — mandatory when using service-role client (cron context)
    if (tenantId) {
      query = query.eq('tenant_id', tenantId)
    }

    // Apply date range filter
    const dateCol = DATE_COLUMN[config.dataSource]
    if (dateCol) {
      const { startDate, endDate } = getDateBounds(dateRange)
      query = query.gte(dateCol, format(startDate, 'yyyy-MM-dd'))
      query = query.lte(dateCol, format(endDate, 'yyyy-MM-dd'))
    }

    // Apply user filters
    for (const filter of config.filters) {
      const dim = dimensions.find((d) => d.id === filter.dimensionId)
      if (!dim) continue

      const col = dim.column
      const val = filter.value

      switch (filter.operator) {
        case 'eq':
          query = query.eq(col, val)
          break
        case 'neq':
          query = query.neq(col, val)
          break
        case 'gt':
          query = query.gt(col, val)
          break
        case 'gte':
          query = query.gte(col, val)
          break
        case 'lt':
          query = query.lt(col, val)
          break
        case 'lte':
          query = query.lte(col, val)
          break
        case 'in':
          query = query.in(col, Array.isArray(val) ? val : [val])
          break
        case 'contains': {
          const escaped = String(val).replace(/%/g, '\\%').replace(/_/g, '\\_')
          query = query.ilike(col, `%${escaped}%`)
          break
        }
      }
    }

    // Exclude cancelled orders
    if (config.dataSource === 'orders') {
      query = query.neq('status', 'cancelled')
    }

    // Safety cap
    query = query.limit(10000)

    const { data: rows, error } = await query

    if (error) {
      console.error('[report-query-engine]', error)
      return emptyResult
    }

    if (!rows || rows.length === 0) {
      // Return empty with correct column headers
      const resultColumns = [
        ...dimensions.map((d) => ({ key: d.id, label: d.label, format: 'text' as const })),
        ...metrics.map((m) => ({ key: m.id, label: m.label, format: m.format })),
      ]
      return { ...emptyResult, columns: resultColumns }
    }

    // Group rows by dimension values
    type RawRow = Record<string, string | number | null>
    const groups = new Map<string, RawRow[]>()

    for (const row of rows as unknown as RawRow[]) {
      const keyParts: string[] = []
      for (const dim of dimensions) {
        const rawVal = String(row[dim.column] ?? '') || null
        const formatted = dim.dateGranularity
          ? formatDateForGranularity(rawVal, dim.dateGranularity)
          : (rawVal ?? 'Unknown')
        keyParts.push(formatted)
      }
      const groupKey = keyParts.length > 0 ? keyParts.join('|') : '__total__'

      if (!groups.has(groupKey)) {
        groups.set(groupKey, [])
      }
      groups.get(groupKey)!.push(row)
    }

    // Compute metrics per group
    const resultRows: Record<string, string | number | null>[] = []

    for (const [groupKey, bucket] of groups) {
      const resultRow: Record<string, string | number | null> = {}

      // Add dimension values
      if (groupKey !== '__total__') {
        const dimValues = groupKey.split('|')
        dimensions.forEach((dim, i) => {
          resultRow[dim.id] = dimValues[i] ?? null
        })
      } else {
        dimensions.forEach((dim) => {
          resultRow[dim.id] = 'Total'
        })
      }

      // Compute each metric
      for (const metric of metrics) {
        let value: number | null

        if (metric.id === 'order_clean_gross') {
          const rev = bucket.reduce((s, r) => s + parseFloat(String(r['revenue'] ?? '0')), 0)
          const bf = bucket.reduce((s, r) => s + parseFloat(String(r['broker_fee'] ?? '0')), 0)
          const lf = bucket.reduce((s, r) => s + parseFloat(String(r['local_fee'] ?? '0')), 0)
          value = rev - bf - lf
        } else if (metric.id === 'order_net_after_fees') {
          const rev = bucket.reduce((s, r) => s + parseFloat(String(r['revenue'] ?? '0')), 0)
          const bf = bucket.reduce((s, r) => s + parseFloat(String(r['broker_fee'] ?? '0')), 0)
          const lf = bucket.reduce((s, r) => s + parseFloat(String(r['local_fee'] ?? '0')), 0)
          const cp = bucket.reduce((s, r) => s + parseFloat(String(r['carrier_pay'] ?? '0')), 0)
          value = rev - bf - lf - cp
        } else {
          const rawValues = bucket.map((r) => parseFloat(String(r[metric.column] ?? '0')))
          value = aggregateValues(rawValues, metric.aggregate)
        }

        resultRow[metric.id] = value !== null ? Math.round(value * 100) / 100 : null
      }

      resultRows.push(resultRow)
    }

    // Sort
    if (config.sortBy) {
      const dir = config.sortDirection === 'asc' ? 1 : -1
      resultRows.sort((a, b) => {
        const aVal = a[config.sortBy!]
        const bVal = b[config.sortBy!]
        if (aVal === null && bVal === null) return 0
        if (aVal === null) return 1
        if (bVal === null) return -1
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * dir
        }
        return String(aVal).localeCompare(String(bVal)) * dir
      })
    }

    const totalRows = resultRows.length
    const limitedRows = config.limit ? resultRows.slice(0, config.limit) : resultRows

    // Build column definitions
    const resultColumns = [
      ...dimensions.map((d) => ({ key: d.id, label: d.label, format: 'text' as const })),
      ...metrics.map((m) => ({ key: m.id, label: m.label, format: m.format })),
    ]

    return {
      columns: resultColumns,
      rows: limitedRows,
      totalRows,
      executedAt: new Date().toISOString(),
    }
  } catch (err) {
    console.error('[report-query-engine] unexpected error:', err)
    return emptyResult
  }
}
