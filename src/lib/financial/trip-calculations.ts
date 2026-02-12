import type { DriverPayType, DriverType } from '@/types'

// ============================================================================
// Input Types
// ============================================================================

/** Financial data extracted from an order for trip calculations */
export interface OrderFinancials {
  revenue: number
  brokerFee: number
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
  carrierPay: number
  driverPay: number
  expenses: number
  netProfit: number
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
 * - Company driver (percentage_of_carrier_pay): % of (revenue - brokerFees)
 * - Owner-operator (dispatch_fee_percent): driver gets remainder after company's dispatch fee %
 * - Per-car flat rate (per_car): payRate * number of orders
 * - No driver / unknown: driverPay = 0
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

  // Sum expenses
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  // Calculate driver pay based on pay model
  const driverPay = calculateDriverPay(orders, driver, revenue, brokerFees)

  // Net profit: revenue minus all costs
  const netProfit = revenue - brokerFees - driverPay - totalExpenses - carrierPay

  return {
    revenue,
    brokerFees,
    carrierPay,
    driverPay,
    expenses: totalExpenses,
    netProfit,
  }
}

/**
 * Calculates driver pay based on the driver's pay model.
 *
 * Returns 0 if no driver is assigned or pay type is unrecognized.
 */
function calculateDriverPay(
  orders: OrderFinancials[],
  driver: DriverConfig | null,
  revenue: number,
  brokerFees: number
): number {
  if (!driver) return 0

  const revenueAfterFees = revenue - brokerFees

  switch (driver.payType) {
    case 'percentage_of_carrier_pay': {
      // Company driver: percentage of revenue after broker fees
      return revenueAfterFees * (driver.payRate / 100)
    }

    case 'dispatch_fee_percent': {
      // Owner-operator: company keeps dispatch fee %, driver gets remainder
      const dispatchFee = revenueAfterFees * (driver.payRate / 100)
      return revenueAfterFees - dispatchFee
    }

    case 'per_car': {
      // Flat rate per car (order)
      return driver.payRate * orders.length
    }

    default: {
      // per_mile or unknown -- not yet implemented, return 0
      return 0
    }
  }
}
