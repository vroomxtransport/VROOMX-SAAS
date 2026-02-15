// ============================================================================
// KPI Calculation Engine — Pure Functions
// ============================================================================

export interface KPIInput {
  totalRevenue: number
  totalBrokerFees: number
  totalDriverPay: number
  totalTripExpenses: number
  totalCarrierPay: number
  totalMiles: number
  orderCount: number
  truckCount: number
  completedTripCount: number
}

export interface KPIOutput {
  // Per-Mile Metrics
  rpm: number | null       // Revenue Per Mile
  cpm: number | null       // Cost Per Mile
  ppm: number | null       // Profit Per Mile

  // Per-Order Metrics
  appo: number             // Avg Pay Per Order

  // Margin Metrics
  grossMargin: number      // percentage
  netMargin: number        // percentage
  operatingRatio: number   // percentage

  // Fleet Metrics
  revenuePerTruck: number | null
  profitPerTruck: number | null
  milesPerTruck: number | null

  // Computed
  netProfit: number
  totalExpenses: number
}

export interface ExpenseBreakdownItem {
  category: string
  label: string
  amount: number
  percentage: number
}

/**
 * Calculates all financial KPIs from aggregated raw data.
 * Pure function — no side effects.
 */
export function calculateKPIs(input: KPIInput): KPIOutput {
  const {
    totalRevenue,
    totalBrokerFees,
    totalDriverPay,
    totalTripExpenses,
    totalCarrierPay,
    totalMiles,
    orderCount,
    truckCount,
  } = input

  const totalExpenses = totalBrokerFees + totalDriverPay + totalTripExpenses + totalCarrierPay
  const netProfit = totalRevenue - totalExpenses

  // Per-Mile (null when no miles data)
  const hasMiles = totalMiles > 0
  const rpm = hasMiles ? totalRevenue / totalMiles : null
  const cpm = hasMiles ? totalExpenses / totalMiles : null
  const ppm = hasMiles ? netProfit / totalMiles : null

  // Per-Order
  const appo = orderCount > 0 ? totalRevenue / orderCount : 0

  // Margin Metrics
  const grossMargin = totalRevenue > 0
    ? ((totalRevenue - totalBrokerFees - totalDriverPay) / totalRevenue) * 100
    : 0
  const netMargin = totalRevenue > 0
    ? (netProfit / totalRevenue) * 100
    : 0
  const operatingRatio = totalRevenue > 0
    ? (totalExpenses / totalRevenue) * 100
    : 0

  // Fleet Metrics
  const hasTrucks = truckCount > 0
  const revenuePerTruck = hasTrucks ? totalRevenue / truckCount : null
  const profitPerTruck = hasTrucks ? netProfit / truckCount : null
  const milesPerTruck = hasTrucks && hasMiles ? totalMiles / truckCount : null

  return {
    rpm,
    cpm,
    ppm,
    appo,
    grossMargin,
    netMargin,
    operatingRatio,
    revenuePerTruck,
    profitPerTruck,
    milesPerTruck,
    netProfit,
    totalExpenses,
  }
}

/**
 * Calculates expense breakdown percentages by category.
 */
export function calculateExpenseBreakdown(expenses: {
  driverPay: number
  brokerFees: number
  carrierPay: number
  fuel: number
  tolls: number
  repairs: number
  lodging: number
  misc: number
}): ExpenseBreakdownItem[] {
  const total =
    expenses.driverPay +
    expenses.brokerFees +
    expenses.carrierPay +
    expenses.fuel +
    expenses.tolls +
    expenses.repairs +
    expenses.lodging +
    expenses.misc

  const items: ExpenseBreakdownItem[] = [
    { category: 'driver_pay', label: 'Driver Pay', amount: expenses.driverPay, percentage: 0 },
    { category: 'broker_fees', label: 'Broker Fees', amount: expenses.brokerFees, percentage: 0 },
    { category: 'carrier_pay', label: 'Carrier Pay', amount: expenses.carrierPay, percentage: 0 },
    { category: 'fuel', label: 'Fuel', amount: expenses.fuel, percentage: 0 },
    { category: 'tolls', label: 'Tolls', amount: expenses.tolls, percentage: 0 },
    { category: 'repairs', label: 'Repairs', amount: expenses.repairs, percentage: 0 },
    { category: 'lodging', label: 'Lodging', amount: expenses.lodging, percentage: 0 },
    { category: 'misc', label: 'Misc', amount: expenses.misc, percentage: 0 },
  ]

  if (total > 0) {
    for (const item of items) {
      item.percentage = Math.round((item.amount / total) * 1000) / 10
    }
  }

  return items.filter((i) => i.amount > 0).sort((a, b) => b.amount - a.amount)
}
