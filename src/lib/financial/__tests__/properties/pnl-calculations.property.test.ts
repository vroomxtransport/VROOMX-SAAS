import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { calculatePnL, calculateUnitMetrics } from '../../pnl-calculations'
import { arbPnLInput } from './generators'

describe('calculatePnL — properties', () => {
  // ==========================================================================
  // Conservation laws
  // ==========================================================================

  it('cleanGross === revenue − brokerFees − localFees', () => {
    fc.assert(
      fc.property(arbPnLInput(), (input) => {
        const r = calculatePnL(input)
        expect(r.cleanGross).toBeCloseTo(r.revenue - r.brokerFees - r.localFees, 8)
      }),
    )
  })

  it('truckGross === cleanGross − driverPay', () => {
    fc.assert(
      fc.property(arbPnLInput(), (input) => {
        const r = calculatePnL(input)
        expect(r.truckGross).toBeCloseTo(r.cleanGross - r.driverPay, 8)
      }),
    )
  })

  it('directTripCosts === fuel + tolls + maintenance + lodging + misc', () => {
    fc.assert(
      fc.property(arbPnLInput(), (input) => {
        const r = calculatePnL(input)
        const expected =
          input.fuelCosts + input.tollCosts + input.maintenanceCosts + input.lodgingCosts + input.miscCosts
        expect(r.directTripCosts).toBeCloseTo(expected, 8)
      }),
    )
  })

  it('totalOperatingExpenses === fixedCosts + directTripCosts + carrierPay', () => {
    fc.assert(
      fc.property(arbPnLInput(), (input) => {
        const r = calculatePnL(input)
        expect(r.totalOperatingExpenses).toBeCloseTo(
          r.fixedCosts + r.directTripCosts + r.carrierPay,
          8,
        )
      }),
    )
  })

  it('netProfitBeforeTax === truckGross − totalOperatingExpenses', () => {
    fc.assert(
      fc.property(arbPnLInput(), (input) => {
        const r = calculatePnL(input)
        expect(r.netProfitBeforeTax).toBeCloseTo(r.truckGross - r.totalOperatingExpenses, 8)
      }),
    )
  })

  // ==========================================================================
  // Full chain identity
  // ==========================================================================

  it('netProfitBeforeTax === revenue − brokerFees − localFees − driverPay − fixedCosts − directTripCosts − carrierPay', () => {
    fc.assert(
      fc.property(arbPnLInput(), (input) => {
        const r = calculatePnL(input)
        const expected =
          r.revenue -
          r.brokerFees -
          r.localFees -
          r.driverPay -
          r.fixedCosts -
          r.directTripCosts -
          r.carrierPay
        expect(r.netProfitBeforeTax).toBeCloseTo(expected, 6)
      }),
    )
  })

  // ==========================================================================
  // Margin identities
  // ==========================================================================

  it('netMargin === (netProfitBeforeTax / revenue) × 100 when revenue > 0', () => {
    fc.assert(
      fc.property(arbPnLInput(), (input) => {
        const r = calculatePnL(input)
        if (r.revenue === 0) {
          expect(r.netMargin).toBe(0)
          return
        }
        expect(r.netMargin).toBeCloseTo((r.netProfitBeforeTax / r.revenue) * 100, 6)
      }),
    )
  })

  it('grossProfitMargin === (truckGross / revenue) × 100 when revenue > 0', () => {
    fc.assert(
      fc.property(arbPnLInput(), (input) => {
        const r = calculatePnL(input)
        if (r.revenue === 0) {
          expect(r.grossProfitMargin).toBe(0)
          return
        }
        expect(r.grossProfitMargin).toBeCloseTo((r.truckGross / r.revenue) * 100, 6)
      }),
    )
  })

  // ==========================================================================
  // Break-even consistency
  // ==========================================================================

  it('break-even × margin ratio ≈ fixed costs (when defined)', () => {
    fc.assert(
      fc.property(arbPnLInput(), (input) => {
        const r = calculatePnL(input)
        if (r.breakEvenRevenue === null) return
        if (r.revenue <= 0) return
        const marginRatio = r.truckGross / r.revenue
        expect(r.breakEvenRevenue * marginRatio).toBeCloseTo(r.fixedCosts, 4)
      }),
    )
  })
})

describe('calculateUnitMetrics — properties', () => {
  it('per-truck metrics null iff truckCount === 0', () => {
    fc.assert(
      fc.property(arbPnLInput(), (input) => {
        const pnl = calculatePnL(input)
        const m = calculateUnitMetrics(input, pnl)
        if (input.truckCount === 0) {
          expect(m.revenuePerTruck).toBeNull()
          expect(m.truckGrossPerTruck).toBeNull()
          expect(m.fixedCostPerTruck).toBeNull()
          expect(m.netProfitPerTruck).toBeNull()
        } else {
          expect(m.revenuePerTruck).not.toBeNull()
          expect(m.truckGrossPerTruck).not.toBeNull()
          expect(m.fixedCostPerTruck).not.toBeNull()
          expect(m.netProfitPerTruck).not.toBeNull()
        }
      }),
    )
  })

  it('per-trip metrics null iff completedTripCount === 0', () => {
    fc.assert(
      fc.property(arbPnLInput(), (input) => {
        const pnl = calculatePnL(input)
        const m = calculateUnitMetrics(input, pnl)
        if (input.completedTripCount === 0) {
          expect(m.revenuePerTrip).toBeNull()
          expect(m.truckGrossPerTrip).toBeNull()
          expect(m.overheadPerTrip).toBeNull()
          expect(m.directCostPerTrip).toBeNull()
          expect(m.netProfitPerTrip).toBeNull()
        } else {
          expect(m.revenuePerTrip).not.toBeNull()
          expect(m.truckGrossPerTrip).not.toBeNull()
          expect(m.overheadPerTrip).not.toBeNull()
          expect(m.directCostPerTrip).not.toBeNull()
          expect(m.netProfitPerTrip).not.toBeNull()
        }
      }),
    )
  })

  it('per-mile metrics null iff totalMiles === 0', () => {
    fc.assert(
      fc.property(arbPnLInput(), (input) => {
        const pnl = calculatePnL(input)
        const m = calculateUnitMetrics(input, pnl)
        if (input.totalMiles === 0) {
          expect(m.rpm).toBeNull()
          expect(m.truckGrossPerMile).toBeNull()
          expect(m.fixedCostPerMile).toBeNull()
          expect(m.fuelCostPerMile).toBeNull()
          expect(m.netProfitPerMile).toBeNull()
        } else {
          expect(m.rpm).not.toBeNull()
          expect(m.truckGrossPerMile).not.toBeNull()
          expect(m.fixedCostPerMile).not.toBeNull()
          expect(m.fuelCostPerMile).not.toBeNull()
          expect(m.netProfitPerMile).not.toBeNull()
        }
      }),
    )
  })
})
