import fc from 'fast-check'
import type {
  OrderFinancials,
  DriverConfig,
  TripExpenseItem,
} from '../../trip-calculations'
import type { KPIInput } from '../../kpi-calculations'
import type { PnLInput } from '../../pnl-calculations'
import type { DriverPayType, DriverType } from '@/types'

// ============================================================================
// Money (integer cents → dollars)
// ============================================================================

/**
 * Generate a non-negative money value with exact cents precision.
 * Generates integer cents in [0, maxDollars * 100], returns dollars.
 * This matches numeric(12,2) DB precision and enables exact equality
 * on sums/differences (.toBe() instead of .toBeCloseTo()).
 */
export function arbMoney(maxDollars = 100_000): fc.Arbitrary<number> {
  return fc
    .integer({ min: 0, max: Math.round(maxDollars * 100) })
    .map((cents) => cents / 100)
}

/** Smaller money range, e.g. fees / expense line items. */
export function arbSmallMoney(maxDollars = 5_000): fc.Arbitrary<number> {
  return arbMoney(maxDollars)
}

// ============================================================================
// Primitives
// ============================================================================

/** Integer percentage in [0, 100]. */
export const arbPercent = (): fc.Arbitrary<number> =>
  fc.integer({ min: 0, max: 100 })

/** Distance miles in [0, 5000], with ~30% probability of null. */
export const arbDistance = (): fc.Arbitrary<number | null> =>
  fc.option(fc.integer({ min: 0, max: 5000 }), { nil: null, freq: 3 })

/** Integer vehicle count in [1, 10]. */
export const arbVehicleCount = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 10 })

/** Integer truck count in [0, 50]. */
export const arbTruckCount = (): fc.Arbitrary<number> =>
  fc.integer({ min: 0, max: 50 })

/** Integer trip / order count in [0, 500]. */
export const arbCount = (max = 500): fc.Arbitrary<number> =>
  fc.integer({ min: 0, max })

// ============================================================================
// Order Financials
// ============================================================================

/**
 * Generate an OrderFinancials with cleanGross >= 0 (fees cannot exceed revenue).
 * Revenue is generated first, then broker + local fees are bounded so their sum
 * <= revenue. Driver pay rate override is optional (~50% null).
 */
export function arbOrder(
  opts: { withMiles?: boolean; withOverride?: boolean } = {},
): fc.Arbitrary<OrderFinancials> {
  const { withMiles = true, withOverride = true } = opts

  return fc
    .integer({ min: 0, max: 10_000_000 }) // revenue in cents (max $100k)
    .chain((revenueCents) =>
      fc
        .integer({ min: 0, max: Math.max(revenueCents, 0) })
        .chain((brokerCents) =>
          fc
            .integer({ min: 0, max: Math.max(revenueCents - brokerCents, 0) })
            .map((localCents) => ({
              revenueCents,
              brokerCents,
              localCents,
            })),
        ),
    )
    .chain(({ revenueCents, brokerCents, localCents }) =>
      fc
        .record({
          distanceMiles: withMiles ? arbDistance() : fc.constant(null),
          vehicleCount: arbVehicleCount(),
          driverPayRateOverride: withOverride
            ? fc.option(arbPercent(), { nil: null, freq: 2 })
            : fc.constant(null),
        })
        .map<OrderFinancials>((rest) => ({
          revenue: revenueCents / 100,
          brokerFee: brokerCents / 100,
          localFee: localCents / 100,
          distanceMiles: rest.distanceMiles,
          driverPayRateOverride: rest.driverPayRateOverride,
          vehicleCount: rest.vehicleCount,
        })),
    )
}

/** Array of orders with configurable size bounds. Default [0, 15]. */
export function arbOrders(
  opts: { min?: number; max?: number; withMiles?: boolean; withOverride?: boolean } = {},
): fc.Arbitrary<OrderFinancials[]> {
  const { min = 0, max = 15, withMiles = true, withOverride = true } = opts
  return fc.array(arbOrder({ withMiles, withOverride }), { minLength: min, maxLength: max })
}

// ============================================================================
// Driver
// ============================================================================

const DRIVER_TYPES: readonly DriverType[] = ['company', 'owner_operator', 'local_driver']
const DRIVER_PAY_TYPES: readonly DriverPayType[] = [
  'percentage_of_carrier_pay',
  'dispatch_fee_percent',
  'per_mile',
  'per_car',
  'daily_salary',
]

/** Generate a DriverConfig. If payType is pinned, only payRate + driverType vary. */
export function arbDriver(payType?: DriverPayType): fc.Arbitrary<DriverConfig> {
  return fc.record({
    driverType: fc.constantFrom(...DRIVER_TYPES),
    payType: payType ? fc.constant(payType) : fc.constantFrom(...DRIVER_PAY_TYPES),
    payRate: payType === 'per_mile'
      ? fc.integer({ min: 0, max: 500 }).map((c) => c / 100) // $0.00-$5.00/mi
      : payType === 'per_car'
        ? fc.integer({ min: 0, max: 50_000 }).map((c) => c / 100) // $0-$500/car
        : arbPercent(), // percentage-based
  })
}

// ============================================================================
// Expenses
// ============================================================================

export function arbExpenseItem(): fc.Arbitrary<TripExpenseItem> {
  return fc.record({ amount: arbSmallMoney(2_000) })
}

export function arbExpenses(maxCount = 10): fc.Arbitrary<TripExpenseItem[]> {
  return fc.array(arbExpenseItem(), { minLength: 0, maxLength: maxCount })
}

// ============================================================================
// Carrier pay
// ============================================================================

export function arbCarrierPay(): fc.Arbitrary<number> {
  return arbMoney(50_000)
}

// ============================================================================
// KPI Input
// ============================================================================

export function arbKPIInput(): fc.Arbitrary<KPIInput> {
  return fc.record({
    totalRevenue: arbMoney(1_000_000),
    totalBrokerFees: arbMoney(100_000),
    totalLocalFees: arbMoney(50_000),
    totalDriverPay: arbMoney(500_000),
    totalTripExpenses: arbMoney(100_000),
    totalCarrierPay: arbMoney(500_000),
    totalMiles: fc.integer({ min: 0, max: 1_000_000 }),
    orderCount: arbCount(10_000),
    truckCount: arbTruckCount(),
    completedTripCount: arbCount(1_000),
    totalFixedExpenses: arbMoney(50_000),
    carsHauled: arbCount(10_000),
  })
}

// ============================================================================
// PnL Input
// ============================================================================

export function arbPnLInput(): fc.Arbitrary<PnLInput> {
  return fc.record({
    totalRevenue: arbMoney(1_000_000),
    totalBrokerFees: arbMoney(100_000),
    totalLocalFees: arbMoney(50_000),
    totalDriverPay: arbMoney(500_000),
    fuelCosts: arbMoney(100_000),
    tollCosts: arbMoney(20_000),
    maintenanceCosts: arbMoney(50_000),
    lodgingCosts: arbMoney(20_000),
    miscCosts: arbMoney(20_000),
    totalCarrierPay: arbMoney(500_000),
    fixedExpensesByCategory: fc.constant({}),
    totalFixedExpenses: arbMoney(50_000),
    truckCount: arbTruckCount(),
    completedTripCount: arbCount(1_000),
    carsHauled: arbCount(10_000),
    totalMiles: fc.integer({ min: 0, max: 1_000_000 }),
    orderCount: arbCount(10_000),
  })
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Shuffle an array deterministically given a seed. Used to test order-independence.
 * fast-check provides fc.shuffledSubarray but we want a full shuffle with a hook
 * into the arbitrary itself.
 */
export function arbShuffle<T>(items: T[]): fc.Arbitrary<T[]> {
  return fc.shuffledSubarray(items, { minLength: items.length, maxLength: items.length })
}
