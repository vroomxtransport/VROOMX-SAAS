/**
 * Per-order driver pay calculation.
 *
 * Replaces the old manual `carrier_pay` form input with an auto-computed
 * value derived from the assigned driver's pay configuration and the
 * order's revenue / distance / vehicle count.
 *
 * Formulas mirror the per-order branch of
 * `src/lib/financial/trip-calculations.ts::calculateDriverPay` — extracted
 * here so server actions can call the math on a single order at create /
 * update time and store the result in the `carrier_pay` column.
 *
 * Naming note: the existing DriverPayType enum value
 * `percentage_of_carrier_pay` is a misnomer — the formula actually uses
 * `cleanGross = revenue - brokerFee - localFee`, not any `carrier_pay`
 * value. The enum name is preserved here for compatibility; renaming it
 * is a follow-up.
 */

import type { DriverPayType } from '@/types'

export interface OrderLike {
  revenue: number
  brokerFee: number
  localFee: number
  distanceMiles: number | null
  driverPayRateOverride: number | null
  /** Number of vehicles on this order. Used by the per_car pay type. */
  vehicleCount: number
}

export interface DriverLike {
  payType: DriverPayType
  payRate: number
}

/**
 * Compute the stored driver pay for a single order.
 *
 * Returns 0 if no driver is assigned (caller should write 0 to the
 * `carrier_pay` column in that case — the field now represents "driver
 * pay for this order", not a user-entered value).
 *
 * For `percentage_of_carrier_pay` and `dispatch_fee_percent`, a non-null
 * `driverPayRateOverride` on the order wins over the driver's default
 * rate. For `per_car`, `per_mile`, and `daily_salary` the override is
 * ignored (matching the behavior of `trip-calculations.ts`).
 *
 * `daily_salary` drivers always return 0 because their pay is tracked
 * per day via local_runs, not per order.
 */
export function computeOrderDriverPay(
  driver: DriverLike | null | undefined,
  o: OrderLike
): number {
  if (!driver) return 0

  const cleanGross = o.revenue - o.brokerFee - o.localFee

  switch (driver.payType) {
    case 'percentage_of_carrier_pay': {
      const rate = o.driverPayRateOverride ?? driver.payRate
      return cleanGross * (rate / 100)
    }
    case 'dispatch_fee_percent': {
      // Owner-operator model: company keeps the dispatch fee %, driver
      // gets the remainder of clean gross.
      const rate = o.driverPayRateOverride ?? driver.payRate
      return cleanGross * (1 - rate / 100)
    }
    case 'per_car':
      return driver.payRate * o.vehicleCount
    case 'per_mile':
      return driver.payRate * (o.distanceMiles ?? 0)
    case 'daily_salary':
      return 0
    default:
      // Exhaustiveness check — if a new DriverPayType is added, TS will
      // force this case to be handled.
      return 0
  }
}
