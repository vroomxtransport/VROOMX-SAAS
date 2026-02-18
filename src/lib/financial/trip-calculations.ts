import type { DriverPayType, DriverType } from '@/types'

// ============================================================================
// Input Types
// ============================================================================

/** Financial data extracted from an order for trip calculations */
export interface OrderFinancials {
  revenue: number
  brokerFee: number
  localFee: number
  distanceMiles: number | null
  driverPayRateOverride: number | null
}

/** Driver configuration for pay calculation */
export interface DriverConfig {
  driverType: DriverType
  payType: DriverPayType
  payRate: number
}

/** A single expense line item */
export interface TripExpenseItem {
  amount: number
}

// ============================================================================
// Output Type
// ============================================================================

/** Computed financial summary for a trip */
export interface TripFinancials {
  revenue: number
  brokerFees: number
  localFees: number
  carrierPay: number
  driverPay: number
  expenses: number
  netProfit: number
  // Derived metrics
  cleanGross: number
  truckGross: number
  totalMiles: number
  orderCount: number
  rpm: number | null
  cpm: number | null
  ppm: number | null
  appc: number | null
}

// ============================================================================
// Calculation
// ============================================================================

/**
 * Calculates trip-level financial summary from orders, driver config, expenses,
 * and carrier pay.
 *
 * Pure function -- no side effects, no database calls.
 *
 * Driver pay models:
 * - Company driver (percentage_of_carrier_pay): % of Clean Gross per order
 * - Owner-operator (dispatch_fee_percent): driver gets remainder after dispatch fee % per order
 * - Per-car flat rate (per_car): payRate * number of orders
 * - Per-mile (per_mile): payRate * total distance miles across orders
 * - No driver / unknown: driverPay = 0
 *
 * Per-order driver % override: if order.driverPayRateOverride is set, it takes
 * precedence over the driver's global payRate for that order's contribution.
 */
export function calculateTripFinancials(
  orders: OrderFinancials[],
  driver: DriverConfig | null,
  expenses: TripExpenseItem[],
  carrierPay: number
): TripFinancials {
  // Sum order financials
  const revenue = orders.reduce((sum, o) => sum + o.revenue, 0)
  const brokerFees = orders.reduce((sum, o) => sum + o.brokerFee, 0)
  const localFees = orders.reduce((sum, o) => sum + o.localFee, 0)

  // Sum expenses
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  // Calculate driver pay based on pay model
  const driverPay = calculateDriverPay(orders, driver)

  // Net profit: revenue minus all costs
  const netProfit = revenue - brokerFees - localFees - driverPay - totalExpenses - carrierPay

  // Derived metrics
  const cleanGross = revenue - brokerFees - localFees
  const truckGross = cleanGross - driverPay
  const totalMiles = orders.reduce((sum, o) => sum + (o.distanceMiles ?? 0), 0)
  const orderCount = orders.length
  const totalCosts = brokerFees + localFees + driverPay + totalExpenses + carrierPay

  const hasMiles = totalMiles > 0
  const rpm = hasMiles ? revenue / totalMiles : null
  const cpm = hasMiles ? totalCosts / totalMiles : null
  const ppm = hasMiles ? netProfit / totalMiles : null
  const appc = orderCount > 0 ? revenue / orderCount : null

  return {
    revenue,
    brokerFees,
    localFees,
    carrierPay,
    driverPay,
    expenses: totalExpenses,
    netProfit,
    cleanGross,
    truckGross,
    totalMiles,
    orderCount,
    rpm,
    cpm,
    ppm,
    appc,
  }
}

/**
 * Calculates driver pay based on the driver's pay model.
 *
 * Returns 0 if no driver is assigned or pay type is unrecognized.
 *
 * For percentage-based models, per-order driverPayRateOverride takes precedence
 * over the driver's global rate. Clean Gross = revenue - brokerFee - localFee.
 */
function calculateDriverPay(
  orders: OrderFinancials[],
  driver: DriverConfig | null,
): number {
  if (!driver) return 0

  switch (driver.payType) {
    case 'percentage_of_carrier_pay': {
      // Company driver: percentage of Clean Gross per order
      return orders.reduce((sum, o) => {
        const orderClean = o.revenue - o.brokerFee - o.localFee
        const rate = o.driverPayRateOverride ?? driver.payRate
        return sum + orderClean * (rate / 100)
      }, 0)
    }

    case 'dispatch_fee_percent': {
      // Owner-operator: company keeps dispatch fee %, driver gets remainder
      return orders.reduce((sum, o) => {
        const orderClean = o.revenue - o.brokerFee - o.localFee
        const rate = o.driverPayRateOverride ?? driver.payRate
        const dispatchFee = orderClean * (rate / 100)
        return sum + (orderClean - dispatchFee)
      }, 0)
    }

    case 'per_car': {
      // Flat rate per car (order)
      return driver.payRate * orders.length
    }

    case 'per_mile': {
      // Per-mile: payRate * total distance miles
      const totalMiles = orders.reduce((sum, o) => sum + (o.distanceMiles ?? 0), 0)
      return totalMiles * driver.payRate
    }

    default: {
      return 0
    }
  }
}
