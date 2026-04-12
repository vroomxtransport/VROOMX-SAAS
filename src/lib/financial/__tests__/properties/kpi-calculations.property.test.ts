import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { calculateKPIs } from '../../kpi-calculations'
import { arbKPIInput } from './generators'

describe('calculateKPIs — properties', () => {
  // ==========================================================================
  // Conservation laws
  // ==========================================================================

  it('totalExpenses === brokerFees + localFees + driverPay + tripExpenses + carrierPay', () => {
    fc.assert(
      fc.property(arbKPIInput(), (input) => {
        const r = calculateKPIs(input)
        const expected =
          input.totalBrokerFees +
          input.totalLocalFees +
          input.totalDriverPay +
          input.totalTripExpenses +
          input.totalCarrierPay
        expect(r.totalExpenses).toBeCloseTo(expected, 8)
      }),
    )
  })

  it('netProfit === totalRevenue − totalExpenses', () => {
    fc.assert(
      fc.property(arbKPIInput(), (input) => {
        const r = calculateKPIs(input)
        expect(r.netProfit).toBeCloseTo(input.totalRevenue - r.totalExpenses, 8)
      }),
    )
  })

  it('cleanGross === totalRevenue − totalBrokerFees − totalLocalFees', () => {
    fc.assert(
      fc.property(arbKPIInput(), (input) => {
        const r = calculateKPIs(input)
        expect(r.cleanGross).toBeCloseTo(
          input.totalRevenue - input.totalBrokerFees - input.totalLocalFees,
          8,
        )
      }),
    )
  })

  it('truckGross === cleanGross − totalDriverPay', () => {
    fc.assert(
      fc.property(arbKPIInput(), (input) => {
        const r = calculateKPIs(input)
        expect(r.truckGross).toBeCloseTo(r.cleanGross - input.totalDriverPay, 8)
      }),
    )
  })

  // ==========================================================================
  // Margin / ratio identities
  // ==========================================================================

  it('operatingRatio + netMargin === 100 when revenue > 0', () => {
    fc.assert(
      fc.property(arbKPIInput(), (input) => {
        if (input.totalRevenue <= 0) return
        const r = calculateKPIs(input)
        // Precision 4 (5e-5 tolerance): identity is algebraically exact, but two
        // independent divisions by tiny revenue drift by a few ULPs in float64.
        // With max expense ~$1.2M in generators, worst-case drift is ~2e-6.
        expect(r.operatingRatio + r.netMargin).toBeCloseTo(100, 4)
      }),
    )
  })

  // ==========================================================================
  // Null boundary conditions
  // ==========================================================================

  it('per-mile metrics null iff totalMiles === 0', () => {
    fc.assert(
      fc.property(arbKPIInput(), (input) => {
        const r = calculateKPIs(input)
        if (input.totalMiles === 0) {
          expect(r.rpm).toBeNull()
          expect(r.cpm).toBeNull()
          expect(r.ppm).toBeNull()
        } else {
          expect(r.rpm).not.toBeNull()
          expect(r.cpm).not.toBeNull()
          expect(r.ppm).not.toBeNull()
        }
      }),
    )
  })

  it('fleet metrics null iff truckCount === 0', () => {
    fc.assert(
      fc.property(arbKPIInput(), (input) => {
        const r = calculateKPIs(input)
        if (input.truckCount === 0) {
          expect(r.revenuePerTruck).toBeNull()
          expect(r.profitPerTruck).toBeNull()
          expect(r.milesPerTruck).toBeNull()
          expect(r.fixedCostPerTruck).toBeNull()
        } else {
          expect(r.revenuePerTruck).not.toBeNull()
          expect(r.profitPerTruck).not.toBeNull()
          expect(r.fixedCostPerTruck).not.toBeNull()
          // milesPerTruck is still null if miles === 0 even when trucks > 0
          if (input.totalMiles > 0) {
            expect(r.milesPerTruck).not.toBeNull()
          }
        }
      }),
    )
  })

  // ==========================================================================
  // Break-even consistency
  // ==========================================================================

  it('break-even × gross profit margin ratio ≈ total fixed expenses (when defined)', () => {
    fc.assert(
      fc.property(arbKPIInput(), (input) => {
        const r = calculateKPIs(input)
        // Guard: the production code returns null when revenue <= 0 OR truckGross <= 0
        // (grossProfitMarginRatio <= 0). Both paths must be respected here.
        if (r.breakEvenRevenue === null) return
        if (input.totalRevenue <= 0) return
        // breakEvenRevenue = fixedCosts / (truckGross/revenue)
        // ⇒ breakEvenRevenue * (truckGross/revenue) === fixedCosts
        const marginRatio = r.truckGross / input.totalRevenue
        const reconstructed = r.breakEvenRevenue * marginRatio
        expect(reconstructed).toBeCloseTo(input.totalFixedExpenses ?? 0, 4)
      }),
    )
  })

  // ==========================================================================
  // Fixed-cost-per-truck conservation
  // ==========================================================================

  it('fixedCostPerTruck === totalFixedExpenses / truckCount when truckCount > 0', () => {
    fc.assert(
      fc.property(arbKPIInput(), (input) => {
        const r = calculateKPIs(input)
        if (input.truckCount === 0) {
          expect(r.fixedCostPerTruck).toBeNull()
          return
        }
        expect(r.fixedCostPerTruck).toBeCloseTo(
          (input.totalFixedExpenses ?? 0) / input.truckCount,
          8,
        )
      }),
    )
  })
})
