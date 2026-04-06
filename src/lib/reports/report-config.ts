// ============================================================================
// Core Report Configuration Types
// ============================================================================

export type DataSource = 'orders' | 'trips' | 'drivers' | 'trucks' | 'brokers' | 'expenses'

export type ChartType = 'table' | 'bar' | 'line' | 'pie' | 'area'

export type AggregateFunction = 'sum' | 'avg' | 'count' | 'min' | 'max'

export type SortDirection = 'asc' | 'desc'

export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains'

// ============================================================================
// Metric & Dimension Definitions
// ============================================================================

export interface MetricDefinition {
  id: string
  label: string
  description: string
  column: string
  table: DataSource
  aggregate: AggregateFunction
  format: 'currency' | 'number' | 'percent' | 'miles'
  computed?: boolean
}

export interface DimensionDefinition {
  id: string
  label: string
  description: string
  column: string
  table: DataSource
  dateGranularity?: 'day' | 'week' | 'month' | 'quarter' | 'year'
}

export interface FilterConfig {
  dimensionId: string
  operator: FilterOperator
  value: string | string[] | number
}

export interface ReportConfig {
  name: string
  description: string
  dataSource: DataSource
  metrics: string[]
  dimensions: string[]
  filters: FilterConfig[]
  chartType: ChartType
  sortBy?: string
  sortDirection?: SortDirection
  limit?: number
}

export interface SavedReport {
  id: string
  tenant_id: string
  user_id: string
  name: string
  description: string | null
  config: ReportConfig
  is_shared: boolean
  created_at: string
  updated_at: string
}

export interface SavedView {
  id: string
  tenant_id: string
  user_id: string
  page_key: string
  name: string
  filters: Record<string, unknown>
  sort_by: string | null
  sort_direction: SortDirection | null
  is_shared: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface ReportResult {
  columns: { key: string; label: string; format: 'currency' | 'number' | 'percent' | 'miles' | 'text' }[]
  rows: Record<string, string | number | null>[]
  totalRows: number
  executedAt: string
}

// ============================================================================
// Data Source Catalog
// ============================================================================

export const DATA_SOURCES: { id: DataSource; label: string; description: string; icon: string }[] = [
  { id: 'orders', label: 'Orders', description: 'Individual vehicle transport orders', icon: 'Car' },
  { id: 'trips', label: 'Trips', description: 'Driver trips with multiple orders', icon: 'Milestone' },
  { id: 'drivers', label: 'Drivers', description: 'Driver roster and performance', icon: 'IdCard' },
  { id: 'trucks', label: 'Trucks', description: 'Fleet vehicles', icon: 'Truck' },
  { id: 'brokers', label: 'Brokers', description: 'Broker relationships', icon: 'Building2' },
  { id: 'expenses', label: 'Expenses', description: 'Business operating expenses', icon: 'Receipt' },
]

// ============================================================================
// Metric Catalog
// ============================================================================

export const METRICS: Record<DataSource, MetricDefinition[]> = {
  orders: [
    { id: 'order_revenue', label: 'Revenue', description: 'Total order revenue', column: 'revenue', table: 'orders', aggregate: 'sum', format: 'currency' },
    { id: 'order_broker_fee', label: 'Broker Fees', description: 'Total broker fees', column: 'broker_fee', table: 'orders', aggregate: 'sum', format: 'currency' },
    { id: 'order_local_fee', label: 'Local Fees', description: 'Total local fees', column: 'local_fee', table: 'orders', aggregate: 'sum', format: 'currency' },
    { id: 'order_carrier_pay', label: 'Carrier Pay', description: 'Total carrier pay', column: 'carrier_pay', table: 'orders', aggregate: 'sum', format: 'currency' },
    { id: 'order_distance', label: 'Distance', description: 'Total distance in miles', column: 'distance_miles', table: 'orders', aggregate: 'sum', format: 'miles' },
    { id: 'order_count', label: 'Order Count', description: 'Number of orders', column: 'id', table: 'orders', aggregate: 'count', format: 'number' },
    { id: 'order_avg_revenue', label: 'Avg Revenue', description: 'Average revenue per order', column: 'revenue', table: 'orders', aggregate: 'avg', format: 'currency' },
    { id: 'order_avg_distance', label: 'Avg Distance', description: 'Average distance per order', column: 'distance_miles', table: 'orders', aggregate: 'avg', format: 'miles' },
    { id: 'order_clean_gross', label: 'Clean Gross', description: 'Revenue minus broker and local fees', column: 'revenue', table: 'orders', aggregate: 'sum', format: 'currency', computed: true },
    { id: 'order_net_after_fees', label: 'Net After Fees', description: 'Revenue minus all deductions', column: 'revenue', table: 'orders', aggregate: 'sum', format: 'currency', computed: true },
    { id: 'order_min_revenue', label: 'Min Revenue', description: 'Lowest order revenue', column: 'revenue', table: 'orders', aggregate: 'min', format: 'currency' },
    { id: 'order_max_revenue', label: 'Max Revenue', description: 'Highest order revenue', column: 'revenue', table: 'orders', aggregate: 'max', format: 'currency' },
    { id: 'order_avg_broker_fee', label: 'Avg Broker Fee', description: 'Average broker fee per order', column: 'broker_fee', table: 'orders', aggregate: 'avg', format: 'currency' },
  ],
  trips: [
    { id: 'trip_revenue', label: 'Revenue', description: 'Total trip revenue', column: 'total_revenue', table: 'trips', aggregate: 'sum', format: 'currency' },
    { id: 'trip_broker_fees', label: 'Broker Fees', description: 'Total broker fees on trips', column: 'total_broker_fees', table: 'trips', aggregate: 'sum', format: 'currency' },
    { id: 'trip_local_fees', label: 'Local Fees', description: 'Total local fees on trips', column: 'total_local_fees', table: 'trips', aggregate: 'sum', format: 'currency' },
    { id: 'trip_driver_pay', label: 'Driver Pay', description: 'Total driver pay', column: 'driver_pay', table: 'trips', aggregate: 'sum', format: 'currency' },
    { id: 'trip_expenses', label: 'Expenses', description: 'Total trip expenses', column: 'total_expenses', table: 'trips', aggregate: 'sum', format: 'currency' },
    { id: 'trip_carrier_pay', label: 'Carrier Pay', description: 'Total carrier pay', column: 'carrier_pay', table: 'trips', aggregate: 'sum', format: 'currency' },
    { id: 'trip_net_profit', label: 'Net Profit', description: 'Net profit after all costs', column: 'net_profit', table: 'trips', aggregate: 'sum', format: 'currency' },
    { id: 'trip_miles', label: 'Miles', description: 'Total trip miles', column: 'total_miles', table: 'trips', aggregate: 'sum', format: 'miles' },
    { id: 'trip_count', label: 'Trip Count', description: 'Number of trips', column: 'id', table: 'trips', aggregate: 'count', format: 'number' },
    { id: 'trip_order_count', label: 'Avg Orders/Trip', description: 'Average orders per trip', column: 'order_count', table: 'trips', aggregate: 'avg', format: 'number' },
    { id: 'trip_avg_revenue', label: 'Avg Revenue', description: 'Average revenue per trip', column: 'total_revenue', table: 'trips', aggregate: 'avg', format: 'currency' },
    { id: 'trip_avg_miles', label: 'Avg Miles', description: 'Average miles per trip', column: 'total_miles', table: 'trips', aggregate: 'avg', format: 'miles' },
  ],
  drivers: [
    { id: 'driver_count', label: 'Driver Count', description: 'Number of drivers', column: 'id', table: 'drivers', aggregate: 'count', format: 'number' },
    { id: 'driver_avg_pay_rate', label: 'Avg Pay Rate', description: 'Average driver pay rate', column: 'pay_rate', table: 'drivers', aggregate: 'avg', format: 'currency' },
  ],
  trucks: [
    { id: 'truck_count', label: 'Truck Count', description: 'Number of trucks', column: 'id', table: 'trucks', aggregate: 'count', format: 'number' },
  ],
  brokers: [
    { id: 'broker_count', label: 'Broker Count', description: 'Number of brokers', column: 'id', table: 'brokers', aggregate: 'count', format: 'number' },
  ],
  expenses: [
    { id: 'expense_count', label: 'Expense Count', description: 'Number of expenses', column: 'id', table: 'expenses', aggregate: 'count', format: 'number' },
    { id: 'expense_total', label: 'Total Amount', description: 'Total expense amount', column: 'amount', table: 'expenses', aggregate: 'sum', format: 'currency' },
    { id: 'expense_avg', label: 'Avg Amount', description: 'Average expense amount', column: 'amount', table: 'expenses', aggregate: 'avg', format: 'currency' },
    { id: 'expense_max', label: 'Max Amount', description: 'Largest expense', column: 'amount', table: 'expenses', aggregate: 'max', format: 'currency' },
    { id: 'expense_min', label: 'Min Amount', description: 'Smallest expense', column: 'amount', table: 'expenses', aggregate: 'min', format: 'currency' },
  ],
}

// ============================================================================
// Dimension Catalog
// ============================================================================

export const DIMENSIONS: Record<DataSource, DimensionDefinition[]> = {
  orders: [
    { id: 'order_status', label: 'Order Status', description: 'Current order status', column: 'status', table: 'orders' },
    { id: 'order_payment_status', label: 'Payment Status', description: 'Payment status', column: 'payment_status', table: 'orders' },
    { id: 'order_payment_type', label: 'Payment Type', description: 'Payment type (COD, BILL, etc.)', column: 'payment_type', table: 'orders' },
    { id: 'order_pickup_state', label: 'Pickup State', description: 'Origin state', column: 'pickup_state', table: 'orders' },
    { id: 'order_delivery_state', label: 'Delivery State', description: 'Destination state', column: 'delivery_state', table: 'orders' },
    { id: 'order_pickup_city', label: 'Pickup City', description: 'Origin city', column: 'pickup_city', table: 'orders' },
    { id: 'order_delivery_city', label: 'Delivery City', description: 'Destination city', column: 'delivery_city', table: 'orders' },
    { id: 'order_created_month', label: 'Created Month', description: 'Month order was created', column: 'created_at', table: 'orders', dateGranularity: 'month' },
    { id: 'order_created_week', label: 'Created Week', description: 'Week order was created', column: 'created_at', table: 'orders', dateGranularity: 'week' },
    { id: 'order_created_quarter', label: 'Created Quarter', description: 'Quarter order was created', column: 'created_at', table: 'orders', dateGranularity: 'quarter' },
    { id: 'order_created_year', label: 'Created Year', description: 'Year order was created', column: 'created_at', table: 'orders', dateGranularity: 'year' },
    { id: 'order_delivery_month', label: 'Delivery Month', description: 'Month of scheduled delivery', column: 'delivery_date', table: 'orders', dateGranularity: 'month' },
    { id: 'order_vehicle_type', label: 'Vehicle Type', description: 'Type of vehicle transported', column: 'vehicle_type', table: 'orders' },
  ],
  trips: [
    { id: 'trip_status', label: 'Trip Status', description: 'Current trip status', column: 'status', table: 'trips' },
    { id: 'trip_start_month', label: 'Start Month', description: 'Month trip started', column: 'start_date', table: 'trips', dateGranularity: 'month' },
    { id: 'trip_start_week', label: 'Start Week', description: 'Week trip started', column: 'start_date', table: 'trips', dateGranularity: 'week' },
    { id: 'trip_start_quarter', label: 'Start Quarter', description: 'Quarter trip started', column: 'start_date', table: 'trips', dateGranularity: 'quarter' },
    { id: 'trip_start_year', label: 'Start Year', description: 'Year trip started', column: 'start_date', table: 'trips', dateGranularity: 'year' },
    { id: 'trip_end_month', label: 'End Month', description: 'Month trip ended', column: 'end_date', table: 'trips', dateGranularity: 'month' },
  ],
  drivers: [
    { id: 'driver_type', label: 'Driver Type', description: 'Company, owner-operator, or local', column: 'driver_type', table: 'drivers' },
    { id: 'driver_status', label: 'Driver Status', description: 'Active or inactive', column: 'driver_status', table: 'drivers' },
    { id: 'driver_pay_type', label: 'Pay Type', description: 'Driver pay model', column: 'pay_type', table: 'drivers' },
  ],
  trucks: [
    { id: 'truck_status', label: 'Truck Status', description: 'Active, inactive, or maintenance', column: 'truck_status', table: 'trucks' },
    { id: 'truck_type', label: 'Truck Type', description: 'Truck capacity type', column: 'truck_type', table: 'trucks' },
    { id: 'truck_make', label: 'Make', description: 'Vehicle manufacturer', column: 'make', table: 'trucks' },
    { id: 'truck_year', label: 'Year', description: 'Model year', column: 'year', table: 'trucks' },
  ],
  brokers: [
    { id: 'broker_payment_terms', label: 'Payment Terms', description: 'Broker payment terms', column: 'payment_terms', table: 'brokers' },
    { id: 'broker_state', label: 'State', description: 'Broker state', column: 'state', table: 'brokers' },
    { id: 'broker_city', label: 'City', description: 'Broker city', column: 'city', table: 'brokers' },
  ],
  expenses: [
    { id: 'expense_category', label: 'Category', description: 'Expense category', column: 'category', table: 'expenses' },
    { id: 'expense_recurrence', label: 'Recurrence', description: 'Monthly, quarterly, annual, or one-time', column: 'recurrence', table: 'expenses' },
    { id: 'expense_effective_month', label: 'Effective Month', description: 'Month expense is effective', column: 'effective_from', table: 'expenses', dateGranularity: 'month' },
    { id: 'expense_effective_year', label: 'Effective Year', description: 'Year expense is effective', column: 'effective_from', table: 'expenses', dateGranularity: 'year' },
  ],
}

// ============================================================================
// Chart Type Catalog
// ============================================================================

export const CHART_TYPES: {
  id: ChartType
  label: string
  description: string
  icon: string
  minDimensions: number
  maxDimensions: number
  minMetrics: number
  maxMetrics: number
}[] = [
  { id: 'table', label: 'Table', description: 'Sortable data table', icon: 'Table2', minDimensions: 0, maxDimensions: 5, minMetrics: 1, maxMetrics: 10 },
  { id: 'bar', label: 'Bar Chart', description: 'Compare values across categories', icon: 'BarChart3', minDimensions: 1, maxDimensions: 1, minMetrics: 1, maxMetrics: 3 },
  { id: 'line', label: 'Line Chart', description: 'Trends over time', icon: 'TrendingUp', minDimensions: 1, maxDimensions: 1, minMetrics: 1, maxMetrics: 3 },
  { id: 'pie', label: 'Pie Chart', description: 'Distribution breakdown', icon: 'PieChart', minDimensions: 1, maxDimensions: 1, minMetrics: 1, maxMetrics: 1 },
  { id: 'area', label: 'Area Chart', description: 'Filled trend visualization', icon: 'Activity', minDimensions: 1, maxDimensions: 1, minMetrics: 1, maxMetrics: 3 },
]

// ============================================================================
// Helper Functions
// ============================================================================

export function getMetricsForSource(source: DataSource): MetricDefinition[] {
  return METRICS[source]
}

export function getDimensionsForSource(source: DataSource): DimensionDefinition[] {
  return DIMENSIONS[source]
}

export function getMetricById(id: string): MetricDefinition | undefined {
  for (const source of Object.values(METRICS)) {
    const found = source.find((m) => m.id === id)
    if (found) return found
  }
  return undefined
}

export function getDimensionById(id: string): DimensionDefinition | undefined {
  for (const source of Object.values(DIMENSIONS)) {
    const found = source.find((d) => d.id === id)
    if (found) return found
  }
  return undefined
}

export function validateReportConfig(config: ReportConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!config.name || config.name.trim().length === 0) {
    errors.push('Report name is required')
  }

  if (config.metrics.length === 0) {
    errors.push('Select at least one metric')
  }

  const sourceMetrics = METRICS[config.dataSource]
  const sourceDimensions = DIMENSIONS[config.dataSource]

  for (const metricId of config.metrics) {
    if (!sourceMetrics.find((m) => m.id === metricId)) {
      errors.push(`Metric "${metricId}" is not available for ${config.dataSource}`)
    }
  }

  for (const dimId of config.dimensions) {
    if (!sourceDimensions.find((d) => d.id === dimId)) {
      errors.push(`Dimension "${dimId}" is not available for ${config.dataSource}`)
    }
  }

  const chartDef = CHART_TYPES.find((c) => c.id === config.chartType)
  if (!chartDef) {
    errors.push(`Unknown chart type "${config.chartType}"`)
  } else {
    if (config.metrics.length < chartDef.minMetrics) {
      errors.push(`${chartDef.label} requires at least ${chartDef.minMetrics} metric(s)`)
    }
    if (config.metrics.length > chartDef.maxMetrics) {
      errors.push(`${chartDef.label} supports at most ${chartDef.maxMetrics} metric(s)`)
    }
    if (config.dimensions.length < chartDef.minDimensions) {
      errors.push(`${chartDef.label} requires at least ${chartDef.minDimensions} dimension(s)`)
    }
    if (config.dimensions.length > chartDef.maxDimensions) {
      errors.push(`${chartDef.label} supports at most ${chartDef.maxDimensions} dimension(s)`)
    }
  }

  if (config.limit !== undefined && (config.limit < 1 || config.limit > 10000)) {
    errors.push('Limit must be between 1 and 10,000')
  }

  return { valid: errors.length === 0, errors }
}

export function getDefaultReportConfig(source: DataSource): ReportConfig {
  const defaults: Record<DataSource, { metrics: string[]; dimensions: string[]; chartType: ChartType }> = {
    orders: { metrics: ['order_revenue', 'order_count'], dimensions: ['order_created_month'], chartType: 'bar' },
    trips: { metrics: ['trip_revenue', 'trip_net_profit'], dimensions: ['trip_start_month'], chartType: 'bar' },
    drivers: { metrics: ['driver_count'], dimensions: ['driver_type'], chartType: 'pie' },
    trucks: { metrics: ['truck_count'], dimensions: ['truck_status'], chartType: 'pie' },
    brokers: { metrics: ['broker_count'], dimensions: ['broker_payment_terms'], chartType: 'table' },
    expenses: { metrics: ['expense_total'], dimensions: ['expense_category'], chartType: 'bar' },
  }

  const d = defaults[source]
  return {
    name: '',
    description: '',
    dataSource: source,
    metrics: d.metrics,
    dimensions: d.dimensions,
    filters: [],
    chartType: d.chartType,
  }
}
