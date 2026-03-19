import type { DispatcherPayType, PayFrequency } from '@/types'

// ============================================================================
// Input Types
// ============================================================================

/** Financial data from an order attributed to a dispatcher */
export interface DispatcherOrderFinancials {
  revenue: number
  brokerFee: number
  localFee: number
}

/** Dispatcher pay configuration */
export interface DispatcherPayConfig {
  payType: DispatcherPayType
  payRate: number
  payFrequency: PayFrequency
}

// ============================================================================
// Output Type
// ============================================================================

/** Computed payroll result for a dispatcher period */
export interface DispatcherPayResult {
  baseAmount: number
  performanceAmount: number
  totalAmount: number
  orderCount: number
  totalOrderRevenue: number
}

// ============================================================================
// Calculation
// ============================================================================

/**
 * Calculates dispatcher pay for a payroll period.
 *
 * Pure function — no side effects, no database calls.
 *
 * Pay models:
 * - fixed_salary: baseAmount = payRate (the configured salary for the period)
 * - performance_revenue: % of Clean Gross (revenue - brokerFee - localFee) per order
 */
export function calculateDispatcherPay(
  config: DispatcherPayConfig,
  orders: DispatcherOrderFinancials[],
): DispatcherPayResult {
  const orderCount = orders.length

  // Compute Clean Gross per order and sum
  const totalOrderRevenue = orders.reduce((sum, o) => {
    const cleanGross = o.revenue - o.brokerFee - o.localFee
    return sum + cleanGross
  }, 0)

  let baseAmount = 0
  let performanceAmount = 0

  switch (config.payType) {
    case 'fixed_salary': {
      baseAmount = config.payRate
      break
    }

    case 'performance_revenue': {
      performanceAmount = orders.reduce((sum, o) => {
        const cleanGross = o.revenue - o.brokerFee - o.localFee
        return sum + cleanGross * (config.payRate / 100)
      }, 0)
      break
    }
  }

  const totalAmount = baseAmount + performanceAmount

  return {
    baseAmount,
    performanceAmount,
    totalAmount,
    orderCount,
    totalOrderRevenue,
  }
}
