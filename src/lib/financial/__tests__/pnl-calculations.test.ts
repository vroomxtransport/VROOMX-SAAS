import { describe, it, expect } from 'vitest'
import {
  calculatePnL,
  calculateUnitMetrics,
  type PnLInput,
} from '../pnl-calculations'

/** Build a PnLInput with sensible defaults */
function mkInput(overrides: Partial<PnLInput> = {}): PnLInput {
  return {
    totalRevenue: 0,
    totalBrokerFees: 0,
    totalLocalFees: 0,
    totalDriverPay: 0,
    fuelCosts: 0,
    tollCosts: 0,
    maintenanceCosts: 0,
    lodgingCosts: 0,
    miscCosts: 0,
    totalCarrierPay: 0,
    fixedExpensesByCategory: {},
    totalFixedExpenses: 0,
    truckCount: 0,
    completedTripCount: 0,
    carsHauled: 0,
    totalMiles: 0,
    orderCount: 0,
    ...overrides,
  }
}

describe('calculatePnL', () => {
  it('returns all zeros for empty input', () => {
    const result = calculatePnL(mkInput())

    expect(result.revenue).toBe(0)
    expect(result.cleanGross).toBe(0)
    expect(result.truckGross).toBe(0)
    expect(result.netProfitBeforeTax).toBe(0)
    expect(result.grossProfitMargin).toBe(0)
    expect(result.netMargin).toBe(0)
    expect(result.breakEvenRevenue).toBeNull()
  })

  it('calculates revenue waterfall correctly', () => {
    const result = calculatePnL(mkInput({
      totalRevenue: 100000,
      totalBrokerFees: 10000,
      totalLocalFees: 5000,
      totalDriverPay: 40000,
    }))

    // Clean Gross = 100000 - 10000 - 5000 = 85000
    expect(result.cleanGross).toBe(85000)
    // Truck Gross = 85000 - 40000 = 45000
    expect(result.truckGross).toBe(45000)
    // Gross Profit Margin = 45000 / 100000 * 100 = 45%
    expect(result.grossProfitMargin).toBe(45)
  })

  it('calculates operating expenses and net profit', () => {
    const result = calculatePnL(mkInput({
      totalRevenue: 100000,
      totalBrokerFees: 10000,
      totalLocalFees: 0,
      totalDriverPay: 50000,
      fuelCosts: 5000,
      tollCosts: 1000,
      maintenanceCosts: 2000,
      lodgingCosts: 500,
      miscCosts: 500,
      totalCarrierPay: 3000,
      totalFixedExpenses: 15000,
    }))

    // cleanGross = 90000, truckGross = 40000
    expect(result.truckGross).toBe(40000)
    // directTripCosts = 5000+1000+2000+500+500 = 9000
    expect(result.directTripCosts).toBe(9000)
    // totalOperating = 15000 + 9000 + 3000 = 27000
    expect(result.totalOperatingExpenses).toBe(27000)
    // netProfit = 40000 - 27000 = 13000
    expect(result.netProfitBeforeTax).toBe(13000)
    // netMargin = 13000 / 100000 * 100 = 13%
    expect(result.netMargin).toBe(13)
  })

  it('calculates break-even revenue correctly', () => {
    const result = calculatePnL(mkInput({
      totalRevenue: 100000,
      totalBrokerFees: 5000,
      totalLocalFees: 0,
      totalDriverPay: 50000,
      totalFixedExpenses: 20000,
    }))

    // cleanGross = 95000, truckGross = 45000
    // grossMarginRatio = 45000 / 100000 = 0.45
    // breakEven = 20000 / 0.45 ≈ 44444.44
    expect(result.breakEvenRevenue).toBeCloseTo(44444.44, 0)
  })

  it('returns null break-even when truckGross margin is zero', () => {
    const result = calculatePnL(mkInput({
      totalRevenue: 100000,
      totalBrokerFees: 100000,
      totalFixedExpenses: 5000,
    }))

    // cleanGross = 0, truckGross = 0, margin = 0
    expect(result.breakEvenRevenue).toBeNull()
  })

  it('handles negative net profit (losing money)', () => {
    const result = calculatePnL(mkInput({
      totalRevenue: 50000,
      totalBrokerFees: 5000,
      totalDriverPay: 30000,
      fuelCosts: 10000,
      totalFixedExpenses: 25000,
    }))

    // cleanGross = 45000, truckGross = 15000
    // totalOperating = 25000 + 10000 = 35000
    // netProfit = 15000 - 35000 = -20000
    expect(result.netProfitBeforeTax).toBe(-20000)
    expect(result.netMargin).toBe(-40)
  })

  it('preserves fixed costs by category', () => {
    const categories = { insurance: 5000, rent: 2000, truck_lease: 8000 }
    const result = calculatePnL(mkInput({
      totalRevenue: 100000,
      fixedExpensesByCategory: categories,
      totalFixedExpenses: 15000,
    }))

    expect(result.fixedCostsByCategory).toEqual(categories)
    expect(result.fixedCosts).toBe(15000)
  })
})

describe('calculateUnitMetrics', () => {
  it('returns nulls when no trucks, trips, or miles', () => {
    const input = mkInput()
    const pnl = calculatePnL(input)
    const metrics = calculateUnitMetrics(input, pnl)

    expect(metrics.revenuePerTruck).toBeNull()
    expect(metrics.revenuePerTrip).toBeNull()
    expect(metrics.rpm).toBeNull()
    expect(metrics.trucksInService).toBe(0)
    expect(metrics.tripCount).toBe(0)
    expect(metrics.totalMiles).toBe(0)
  })

  it('calculates per-truck metrics', () => {
    const input = mkInput({
      totalRevenue: 100000,
      totalBrokerFees: 10000,
      totalDriverPay: 40000,
      totalFixedExpenses: 12000,
      truckCount: 3,
    })
    const pnl = calculatePnL(input)
    const metrics = calculateUnitMetrics(input, pnl)

    // truckGross = 50000, net = 50000 - 12000 = 38000
    expect(metrics.revenuePerTruck).toBeCloseTo(33333.33, 0)
    expect(metrics.truckGrossPerTruck).toBeCloseTo(16666.67, 0)
    expect(metrics.fixedCostPerTruck).toBe(4000)
    expect(metrics.netProfitPerTruck).toBeCloseTo(12666.67, 0)
  })

  it('calculates per-trip metrics', () => {
    const input = mkInput({
      totalRevenue: 60000,
      totalBrokerFees: 6000,
      totalDriverPay: 20000,
      totalFixedExpenses: 10000,
      fuelCosts: 5000,
      completedTripCount: 10,
      carsHauled: 80,
    })
    const pnl = calculatePnL(input)
    const metrics = calculateUnitMetrics(input, pnl)

    expect(metrics.revenuePerTrip).toBe(6000)
    expect(metrics.truckGrossPerTrip).toBe(3400) // 34000 / 10
    expect(metrics.appc).toBe(750) // 60000 / 80
    expect(metrics.overheadPerTrip).toBe(1000) // 10000 / 10
    expect(metrics.directCostPerTrip).toBe(500) // 5000 / 10
  })

  it('calculates per-mile metrics', () => {
    const input = mkInput({
      totalRevenue: 100000,
      totalBrokerFees: 10000,
      totalDriverPay: 40000,
      totalFixedExpenses: 15000,
      fuelCosts: 8000,
      totalMiles: 50000,
    })
    const pnl = calculatePnL(input)
    const metrics = calculateUnitMetrics(input, pnl)

    // rpm = 100000 / 50000 = 2.0
    expect(metrics.rpm).toBe(2)
    // truckGross/mile = 50000 / 50000 = 1.0
    expect(metrics.truckGrossPerMile).toBe(1)
    // fixedCost/mile = 15000 / 50000 = 0.30
    expect(metrics.fixedCostPerMile).toBe(0.3)
    // fuelCost/mile = 8000 / 50000 = 0.16
    expect(metrics.fuelCostPerMile).toBe(0.16)
  })

  it('reports volume metrics correctly', () => {
    const input = mkInput({
      truckCount: 5,
      completedTripCount: 20,
      carsHauled: 150,
      totalMiles: 80000,
    })
    const pnl = calculatePnL(input)
    const metrics = calculateUnitMetrics(input, pnl)

    expect(metrics.trucksInService).toBe(5)
    expect(metrics.tripCount).toBe(20)
    expect(metrics.carsHauled).toBe(150)
    expect(metrics.totalMiles).toBe(80000)
  })
})
