// ============================================================================
// Alert Metric Definitions
// Defines the set of KPI metrics users can create threshold alerts for.
// ============================================================================

export interface AlertMetricDef {
  id: string
  label: string
  description: string
  category: 'revenue' | 'costs' | 'performance' | 'billing'
  unit: 'currency' | 'percent' | 'number' | 'days'
  defaultOperator: 'lt' | 'gt'
  defaultThreshold: number
}

export type AlertOperator = 'gt' | 'lt' | 'gte' | 'lte'

export const ALERT_METRICS: AlertMetricDef[] = [
  {
    id: 'daily_revenue',
    label: 'Daily Revenue',
    description: 'Total revenue today drops below target',
    category: 'revenue',
    unit: 'currency',
    defaultOperator: 'lt',
    defaultThreshold: 5000,
  },
  {
    id: 'weekly_revenue',
    label: 'Weekly Revenue',
    description: 'Total revenue this week drops below target',
    category: 'revenue',
    unit: 'currency',
    defaultOperator: 'lt',
    defaultThreshold: 25000,
  },
  {
    id: 'operating_ratio',
    label: 'Operating Ratio',
    description: 'Operating ratio exceeds target (expenses / revenue × 100)',
    category: 'costs',
    unit: 'percent',
    defaultOperator: 'gt',
    defaultThreshold: 95,
  },
  {
    id: 'net_margin',
    label: 'Net Margin',
    description: 'Net margin drops below target percentage',
    category: 'revenue',
    unit: 'percent',
    defaultOperator: 'lt',
    defaultThreshold: 10,
  },
  {
    id: 'cost_per_mile',
    label: 'Cost Per Mile',
    description: 'Cost per mile exceeds target',
    category: 'costs',
    unit: 'currency',
    defaultOperator: 'gt',
    defaultThreshold: 2.5,
  },
  {
    id: 'on_time_rate',
    label: 'On-Time Delivery Rate',
    description: 'On-time delivery rate drops below target percentage',
    category: 'performance',
    unit: 'percent',
    defaultOperator: 'lt',
    defaultThreshold: 90,
  },
  {
    id: 'ar_aging_60',
    label: 'AR > 60 Days',
    description: 'Number of invoices aging past 60 days exceeds threshold',
    category: 'billing',
    unit: 'number',
    defaultOperator: 'gt',
    defaultThreshold: 5,
  },
  {
    id: 'driver_utilization',
    label: 'Driver Utilization',
    description: 'Fleet driver utilization drops below target percentage',
    category: 'performance',
    unit: 'percent',
    defaultOperator: 'lt',
    defaultThreshold: 70,
  },
]

export const ALERT_METRICS_BY_ID = Object.fromEntries(
  ALERT_METRICS.map((m) => [m.id, m])
) as Record<string, AlertMetricDef>

export const ALERT_METRICS_BY_CATEGORY = ALERT_METRICS.reduce<
  Record<AlertMetricDef['category'], AlertMetricDef[]>
>(
  (acc, metric) => {
    acc[metric.category].push(metric)
    return acc
  },
  { revenue: [], costs: [], performance: [], billing: [] }
)

export const CATEGORY_LABELS: Record<AlertMetricDef['category'], string> = {
  revenue: 'Revenue',
  costs: 'Costs',
  performance: 'Performance',
  billing: 'Billing',
}

export const OPERATOR_LABELS: Record<AlertOperator, string> = {
  gt: 'greater than',
  lt: 'less than',
  gte: 'greater than or equal to',
  lte: 'less than or equal to',
}

export const OPERATOR_SYMBOLS: Record<AlertOperator, string> = {
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
}

/**
 * Format a threshold value with the appropriate unit for display.
 */
export function formatThreshold(value: number, unit: AlertMetricDef['unit']): string {
  if (unit === 'currency') {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  }
  if (unit === 'percent') return `${value}%`
  if (unit === 'days') return `${value}d`
  return String(value)
}

/**
 * Build a human-readable condition string, e.g. "Revenue < $5,000"
 */
export function formatCondition(
  metric: AlertMetricDef,
  operator: AlertOperator,
  threshold: number
): string {
  return `${metric.label} ${OPERATOR_SYMBOLS[operator]} ${formatThreshold(threshold, metric.unit)}`
}
