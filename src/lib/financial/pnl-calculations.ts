// ============================================================================
// P&L Calculation Engine — Pure Functions
// Matches Horizon Star LLC production spreadsheet layout
// ============================================================================

// ============================================================================
// Input Types
// ============================================================================

export interface PnLInput {
  // Revenue line items (from orders)
  totalRevenue: number
  totalBrokerFees: number
  totalLocalFees: number

  // Driver pay (from trips)
  totalDriverPay: number

  // Direct trip costs (from trip_expenses by category)
  fuelCosts: number
  tollCosts: number
  maintenanceCosts: number
  lodgingCosts: number
  miscCosts: number

  // Carrier pay
  totalCarrierPay: number

  // Fixed business expenses (prorated from business_expenses table)
  fixedExpensesByCategory: Record<string, number>
  totalFixedExpenses: number

  // Volume metrics
  truckCount: number
  completedTripCount: number
  carsHauled: number
  totalMiles: number
  orderCount: number
}

// ============================================================================
// Output Types
// ============================================================================

export interface PnLOutput {
  // Revenue Waterfall
  revenue: number
  brokerFees: number
  localFees: number
  cleanGross: number
  driverPay: number
  truckGross: number
  grossProfitMargin: number // percentage

  // Operating Expenses
  fixedCosts: number
  fixedCostsByCategory: Record<string, number>
  directTripCosts: number
  fuelCosts: number
  tollCosts: number
  maintenanceCosts: number
  lodgingCosts: number
  miscCosts: number
  carrierPay: number
  totalOperatingExpenses: number

  // Bottom Line
  netProfitBeforeTax: number
  netMargin: number // percentage

  // Break-even Analysis
  breakEvenRevenue: number | null
}

export interface UnitMetrics {
  // Per-Truck
  revenuePerTruck: number | null
  truckGrossPerTruck: number | null
  fixedCostPerTruck: number | null
  netProfitPerTruck: number | null

  // Per-Trip
  revenuePerTrip: number | null
  truckGrossPerTrip: number | null
  appc: number | null // avg pay per car
  overheadPerTrip: number | null
  directCostPerTrip: number | null
  netProfitPerTrip: number | null

  // Per-Mile
  rpm: number | null
  truckGrossPerMile: number | null
  fixedCostPerMile: number | null
  fuelCostPerMile: number | null
  netProfitPerMile: number | null

  // Volume
  trucksInService: number
  tripCount: number
  carsHauled: number
  totalMiles: number
}

// ============================================================================
// Calculations
// ============================================================================

/**
 * Calculates full P&L statement from aggregated input data.
 * Matches the Horizon Star LLC spreadsheet "Operational Statement" layout.
 *
 * Pure function — no side effects.
 */
export function calculatePnL(input: PnLInput): PnLOutput {
  // Revenue Waterfall
  const revenue = input.totalRevenue
  const brokerFees = input.totalBrokerFees
  const localFees = input.totalLocalFees
  const cleanGross = revenue - brokerFees - localFees
  const driverPay = input.totalDriverPay
  const truckGross = cleanGross - driverPay
  const grossProfitMargin = revenue > 0 ? (truckGross / revenue) * 100 : 0

  // Operating Expenses
  const fixedCosts = input.totalFixedExpenses
  const directTripCosts = input.fuelCosts + input.tollCosts + input.maintenanceCosts + input.lodgingCosts + input.miscCosts
  const carrierPay = input.totalCarrierPay
  const totalOperatingExpenses = fixedCosts + directTripCosts + carrierPay

  // Bottom Line
  const netProfitBeforeTax = truckGross - totalOperatingExpenses
  const netMargin = revenue > 0 ? (netProfitBeforeTax / revenue) * 100 : 0

  // Break-even: fixed costs / (truck gross margin ratio)
  const grossMarginRatio = revenue > 0 ? truckGross / revenue : 0
  const breakEvenRevenue = grossMarginRatio > 0 ? fixedCosts / grossMarginRatio : null

  return {
    revenue,
    brokerFees,
    localFees,
    cleanGross,
    driverPay,
    truckGross,
    grossProfitMargin,
    fixedCosts,
    fixedCostsByCategory: { ...input.fixedExpensesByCategory },
    directTripCosts,
    fuelCosts: input.fuelCosts,
    tollCosts: input.tollCosts,
    maintenanceCosts: input.maintenanceCosts,
    lodgingCosts: input.lodgingCosts,
    miscCosts: input.miscCosts,
    carrierPay,
    totalOperatingExpenses,
    netProfitBeforeTax,
    netMargin,
    breakEvenRevenue,
  }
}

/**
 * Calculates per-truck, per-trip, and per-mile unit metrics.
 *
 * Pure function — no side effects.
 */
export function calculateUnitMetrics(input: PnLInput, pnl: PnLOutput): UnitMetrics {
  const { truckCount, completedTripCount, carsHauled, totalMiles } = input

  const hasTrucks = truckCount > 0
  const hasTrips = completedTripCount > 0
  const hasMiles = totalMiles > 0

  return {
    // Per-Truck
    revenuePerTruck: hasTrucks ? pnl.revenue / truckCount : null,
    truckGrossPerTruck: hasTrucks ? pnl.truckGross / truckCount : null,
    fixedCostPerTruck: hasTrucks ? pnl.fixedCosts / truckCount : null,
    netProfitPerTruck: hasTrucks ? pnl.netProfitBeforeTax / truckCount : null,

    // Per-Trip
    revenuePerTrip: hasTrips ? pnl.revenue / completedTripCount : null,
    truckGrossPerTrip: hasTrips ? pnl.truckGross / completedTripCount : null,
    appc: carsHauled > 0 ? pnl.revenue / carsHauled : null,
    overheadPerTrip: hasTrips ? pnl.fixedCosts / completedTripCount : null,
    directCostPerTrip: hasTrips ? pnl.directTripCosts / completedTripCount : null,
    netProfitPerTrip: hasTrips ? pnl.netProfitBeforeTax / completedTripCount : null,

    // Per-Mile
    rpm: hasMiles ? pnl.revenue / totalMiles : null,
    truckGrossPerMile: hasMiles ? pnl.truckGross / totalMiles : null,
    fixedCostPerMile: hasMiles ? pnl.fixedCosts / totalMiles : null,
    fuelCostPerMile: hasMiles ? pnl.fuelCosts / totalMiles : null,
    netProfitPerMile: hasMiles ? pnl.netProfitBeforeTax / totalMiles : null,

    // Volume
    trucksInService: truckCount,
    tripCount: completedTripCount,
    carsHauled,
    totalMiles,
  }
}
