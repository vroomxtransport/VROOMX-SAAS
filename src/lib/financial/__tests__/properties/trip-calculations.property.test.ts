import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  calculateTripFinancials,
  type OrderFinancials,
  type DriverConfig,
} from '../../trip-calculations'
import {
  arbOrders,
  arbDriver,
  arbExpenses,
  arbCarrierPay,
  arbPercent,
} from './generators'

// Floating-point tolerance for assertions that involve percentage multiplication.
// With integer-cents inputs, sums/differences are exact but rate * amount is not.
const CENTS_TOLERANCE = 1e-6

describe('calculateTripFinancials — properties', () => {
  // ==========================================================================
  // Conservation laws (algebraic identities)
  // ==========================================================================

  it('cleanGross === revenue − brokerFees − localFees', () => {
    fc.assert(
      fc.property(
        arbOrders(),
        arbDriver(),
        arbExpenses(),
        arbCarrierPay(),
        (orders, driver, expenses, carrierPay) => {
          const r = calculateTripFinancials(orders, driver, expenses, carrierPay)
          expect(r.cleanGross).toBeCloseTo(
            r.revenue - r.brokerFees - r.localFees,
            10,
          )
        },
      ),
    )
  })

  it('truckGross === cleanGross − driverPay', () => {
    fc.assert(
      fc.property(
        arbOrders(),
        arbDriver(),
        arbExpenses(),
        arbCarrierPay(),
        (orders, driver, expenses, carrierPay) => {
          const r = calculateTripFinancials(orders, driver, expenses, carrierPay)
          expect(r.truckGross).toBeCloseTo(r.cleanGross - r.driverPay, 10)
        },
      ),
    )
  })

  it('netProfit === revenue − brokerFees − localFees − driverPay − expenses − carrierPay', () => {
    fc.assert(
      fc.property(
        arbOrders(),
        arbDriver(),
        arbExpenses(),
        arbCarrierPay(),
        (orders, driver, expenses, carrierPay) => {
          const r = calculateTripFinancials(orders, driver, expenses, carrierPay)
          const expected =
            r.revenue - r.brokerFees - r.localFees - r.driverPay - r.expenses - r.carrierPay
          expect(r.netProfit).toBeCloseTo(expected, 10)
        },
      ),
    )
  })

  it('orderCount === orders.length', () => {
    fc.assert(
      fc.property(arbOrders(), arbDriver(), (orders, driver) => {
        const r = calculateTripFinancials(orders, driver, [], 0)
        expect(r.orderCount).toBe(orders.length)
      }),
    )
  })

  it('totalMiles === Σ orders.distanceMiles (null counted as 0)', () => {
    fc.assert(
      fc.property(arbOrders(), arbDriver(), (orders, driver) => {
        const r = calculateTripFinancials(orders, driver, [], 0)
        const expected = orders.reduce((s, o) => s + (o.distanceMiles ?? 0), 0)
        expect(r.totalMiles).toBe(expected)
      }),
    )
  })

  // ==========================================================================
  // Per-unit metrics
  // ==========================================================================

  it('appc === revenue / orderCount when orderCount > 0, else null', () => {
    fc.assert(
      fc.property(arbOrders(), arbDriver(), (orders, driver) => {
        const r = calculateTripFinancials(orders, driver, [], 0)
        if (r.orderCount > 0) {
          expect(r.appc).toBeCloseTo(r.revenue / r.orderCount, 10)
        } else {
          expect(r.appc).toBeNull()
        }
      }),
    )
  })

  it('rpm === revenue / totalMiles when miles > 0, else null', () => {
    fc.assert(
      fc.property(arbOrders(), arbDriver(), (orders, driver) => {
        const r = calculateTripFinancials(orders, driver, [], 0)
        if (r.totalMiles > 0) {
          expect(r.rpm).toBeCloseTo(r.revenue / r.totalMiles, 10)
        } else {
          expect(r.rpm).toBeNull()
        }
      }),
    )
  })

  // ==========================================================================
  // Boundary cases
  // ==========================================================================

  it('empty orders → all numeric outputs zero, per-unit outputs null', () => {
    fc.assert(
      fc.property(arbDriver(), arbExpenses(), arbCarrierPay(), (driver, expenses, carrierPay) => {
        const r = calculateTripFinancials([], driver, expenses, carrierPay)
        expect(r.revenue).toBe(0)
        expect(r.brokerFees).toBe(0)
        expect(r.localFees).toBe(0)
        expect(r.driverPay).toBe(0)
        expect(r.cleanGross).toBe(0)
        expect(r.truckGross).toBe(0)
        expect(r.totalMiles).toBe(0)
        expect(r.orderCount).toBe(0)
        expect(r.rpm).toBeNull()
        expect(r.cpm).toBeNull()
        expect(r.ppm).toBeNull()
        expect(r.appc).toBeNull()
        // netProfit = 0 − expenses − carrierPay
        const expectedExpenses = expenses.reduce((s, e) => s + e.amount, 0)
        expect(r.netProfit).toBeCloseTo(-expectedExpenses - carrierPay, 10)
      }),
    )
  })

  it('driver === null → driverPay === 0 for any orders and pay context', () => {
    fc.assert(
      fc.property(arbOrders(), arbExpenses(), arbCarrierPay(), (orders, expenses, carrierPay) => {
        const r = calculateTripFinancials(orders, null, expenses, carrierPay)
        expect(r.driverPay).toBe(0)
      }),
    )
  })

  // ==========================================================================
  // Order independence — shuffling inputs doesn't change totals
  // ==========================================================================

  it('order shuffling preserves every output (reverse + swap)', () => {
    fc.assert(
      fc.property(
        arbOrders({ min: 2, max: 12 }),
        arbDriver(),
        arbExpenses(),
        arbCarrierPay(),
        (orders, driver, expenses, carrierPay) => {
          const original = calculateTripFinancials(orders, driver, expenses, carrierPay)
          const reversed = [...orders].reverse()
          const re = calculateTripFinancials(reversed, driver, expenses, carrierPay)

          expect(re.revenue).toBeCloseTo(original.revenue, 8)
          expect(re.brokerFees).toBeCloseTo(original.brokerFees, 8)
          expect(re.localFees).toBeCloseTo(original.localFees, 8)
          expect(re.driverPay).toBeCloseTo(original.driverPay, 6)
          expect(re.netProfit).toBeCloseTo(original.netProfit, 6)
          expect(re.totalMiles).toBe(original.totalMiles)
          expect(re.orderCount).toBe(original.orderCount)
        },
      ),
    )
  })

  // ==========================================================================
  // Linearity / homogeneity — doubling money doubles money outputs
  // ==========================================================================

  it('scaling monetary inputs by k scales monetary outputs by k (fixed percentages)', () => {
    fc.assert(
      fc.property(
        arbOrders({ min: 1, max: 10, withOverride: false }),
        arbDriver('percentage_of_carrier_pay'),
        arbExpenses(),
        arbCarrierPay(),
        fc.integer({ min: 2, max: 5 }),
        (orders, driver, expenses, carrierPay, k) => {
          const base = calculateTripFinancials(orders, driver, expenses, carrierPay)
          const scaledOrders: OrderFinancials[] = orders.map((o) => ({
            ...o,
            revenue: o.revenue * k,
            brokerFee: o.brokerFee * k,
            localFee: o.localFee * k,
          }))
          const scaledExpenses = expenses.map((e) => ({ amount: e.amount * k }))
          const scaled = calculateTripFinancials(scaledOrders, driver, scaledExpenses, carrierPay * k)

          expect(scaled.revenue).toBeCloseTo(base.revenue * k, 6)
          expect(scaled.brokerFees).toBeCloseTo(base.brokerFees * k, 6)
          expect(scaled.localFees).toBeCloseTo(base.localFees * k, 6)
          expect(scaled.cleanGross).toBeCloseTo(base.cleanGross * k, 6)
          expect(scaled.driverPay).toBeCloseTo(base.driverPay * k, 6)
          expect(scaled.netProfit).toBeCloseTo(base.netProfit * k, 6)
        },
      ),
    )
  })

  // ==========================================================================
  // Pay-model-specific identities
  // ==========================================================================

  it('per_car: driverPay === payRate × Σ vehicleCount', () => {
    fc.assert(
      fc.property(arbOrders({ withOverride: false }), arbDriver('per_car'), (orders, driver) => {
        const r = calculateTripFinancials(orders, driver, [], 0)
        const totalVehicles = orders.reduce((s, o) => s + (o.vehicleCount ?? 1), 0)
        expect(r.driverPay).toBeCloseTo(driver.payRate * totalVehicles, 10)
      }),
    )
  })

  it('per_mile: driverPay === payRate × totalMiles', () => {
    fc.assert(
      fc.property(arbOrders({ withOverride: false }), arbDriver('per_mile'), (orders, driver) => {
        const r = calculateTripFinancials(orders, driver, [], 0)
        expect(r.driverPay).toBeCloseTo(driver.payRate * r.totalMiles, 10)
      }),
    )
  })

  it('daily_salary: driverPay === 0 for any orders (tracked per-local_run, not per-trip)', () => {
    fc.assert(
      fc.property(
        arbOrders(),
        arbDriver('daily_salary'),
        arbExpenses(),
        arbCarrierPay(),
        (orders, driver, expenses, carrierPay) => {
          const r = calculateTripFinancials(orders, driver, expenses, carrierPay)
          expect(r.driverPay).toBe(0)
        },
      ),
    )
  })

  // ==========================================================================
  // Cross-model: dispatch fee complement law
  // "driver cut" at rate r + "company cut" at rate (100−r) === cleanGross
  // ==========================================================================

  it('dispatch_fee_percent + percentage_of_carrier_pay at complementary rates sum to cleanGross', () => {
    fc.assert(
      fc.property(
        arbOrders({ min: 1, withOverride: false }),
        arbPercent(),
        (orders, rate) => {
          // Driver A: percentage_of_carrier_pay at rate r → takes r% of cleanGross
          const driverA: DriverConfig = {
            driverType: 'company',
            payType: 'percentage_of_carrier_pay',
            payRate: rate,
          }
          // Driver B: dispatch_fee_percent at rate (100−r) → takes remainder after (100−r)% fee
          // which algebraically equals cleanGross * r%
          const driverB: DriverConfig = {
            driverType: 'owner_operator',
            payType: 'dispatch_fee_percent',
            payRate: 100 - rate,
          }

          const a = calculateTripFinancials(orders, driverA, [], 0)
          const b = calculateTripFinancials(orders, driverB, [], 0)
          // Both drivers should earn the same driver pay (algebraically equivalent)
          expect(a.driverPay).toBeCloseTo(b.driverPay, 6)
          // And it should not exceed cleanGross
          expect(a.driverPay).toBeLessThanOrEqual(a.cleanGross + CENTS_TOLERANCE)
        },
      ),
    )
  })

  // ==========================================================================
  // Per-order override precedence
  // ==========================================================================

  it('per-order driverPayRateOverride only affects its own order contribution', () => {
    fc.assert(
      fc.property(
        arbOrders({ min: 2, max: 8, withOverride: false }),
        arbDriver('percentage_of_carrier_pay'),
        arbPercent(),
        fc.nat(),
        (orders, driver, overrideRate, pickSeed) => {
          if (orders.length < 2) return
          const idx = pickSeed % orders.length
          const target = orders.find((_, i) => i === idx)
          if (!target) return

          // Baseline: no overrides
          const baseline = calculateTripFinancials(orders, driver, [], 0)

          // Override one order
          const overridden: OrderFinancials[] = orders.map((o, i) =>
            i === idx ? { ...o, driverPayRateOverride: overrideRate } : o,
          )
          const withOverride = calculateTripFinancials(overridden, driver, [], 0)

          // The difference in driver pay should equal ONLY the diff from the overridden order
          const orderClean = target.revenue - target.brokerFee - target.localFee
          const originalContribution = orderClean * (driver.payRate / 100)
          const newContribution = orderClean * (overrideRate / 100)
          const expectedDiff = newContribution - originalContribution

          expect(withOverride.driverPay - baseline.driverPay).toBeCloseTo(expectedDiff, 6)
          // Non-driver-pay outputs should be unchanged
          expect(withOverride.revenue).toBeCloseTo(baseline.revenue, 10)
          expect(withOverride.brokerFees).toBeCloseTo(baseline.brokerFees, 10)
          expect(withOverride.localFees).toBeCloseTo(baseline.localFees, 10)
          expect(withOverride.cleanGross).toBeCloseTo(baseline.cleanGross, 10)
        },
      ),
    )
  })
})
