import { describe, it, expect } from 'vitest'
import {
  calculateTripFinancials,
  type OrderFinancials,
  type DriverConfig,
  type TripExpenseItem,
} from '../trip-calculations'

/** Helper to build OrderFinancials with sensible defaults for new fields */
function mkOrder(overrides: Partial<OrderFinancials> & { revenue: number; brokerFee: number }): OrderFinancials {
  return {
    localFee: 0,
    distanceMiles: null,
    driverPayRateOverride: null,
    ...overrides,
  }
}

describe('calculateTripFinancials', () => {
  it('returns all zeros for empty orders array', () => {
    const driver: DriverConfig = {
      driverType: 'company',
      payType: 'percentage_of_carrier_pay',
      payRate: 60,
    }

    const result = calculateTripFinancials([], driver, [], 0)

    expect(result).toEqual({
      revenue: 0,
      brokerFees: 0,
      localFees: 0,
      carrierPay: 0,
      driverPay: 0,
      expenses: 0,
      netProfit: 0,
      cleanGross: 0,
      truckGross: 0,
      totalMiles: 0,
      orderCount: 0,
      rpm: null,
      cpm: null,
      ppm: null,
      appc: null,
    })
  })

  it('calculates company driver pay as percentage of revenue after broker fees', () => {
    const orders: OrderFinancials[] = [mkOrder({ revenue: 1000, brokerFee: 100 })]
    const driver: DriverConfig = {
      driverType: 'company',
      payType: 'percentage_of_carrier_pay',
      payRate: 60,
    }

    const result = calculateTripFinancials(orders, driver, [], 0)

    // cleanGross = 1000 - 100 - 0 = 900
    // driverPay = 900 * 0.60 = 540
    // truckGross = 900 - 540 = 360
    // netProfit = 1000 - 100 - 0 - 540 - 0 - 0 = 360
    expect(result).toEqual({
      revenue: 1000,
      brokerFees: 100,
      localFees: 0,
      carrierPay: 0,
      driverPay: 540,
      expenses: 0,
      netProfit: 360,
      cleanGross: 900,
      truckGross: 360,
      totalMiles: 0,
      orderCount: 1,
      rpm: null,
      cpm: null,
      ppm: null,
      appc: 1000,
    })
  })

  it('calculates multi-order company driver at 50% with expenses and carrier pay', () => {
    const orders: OrderFinancials[] = [
      mkOrder({ revenue: 2000, brokerFee: 200 }),
      mkOrder({ revenue: 1500, brokerFee: 150 }),
    ]
    const driver: DriverConfig = {
      driverType: 'company',
      payType: 'percentage_of_carrier_pay',
      payRate: 50,
    }
    const expenses: TripExpenseItem[] = [{ amount: 50 }]

    const result = calculateTripFinancials(orders, driver, expenses, 100)

    // revenue = 3500, brokerFees = 350, localFees = 0
    // order1 cleanGross = 2000 - 200 = 1800, driverPay = 1800 * 0.50 = 900
    // order2 cleanGross = 1500 - 150 = 1350, driverPay = 1350 * 0.50 = 675
    // total driverPay = 900 + 675 = 1575
    // cleanGross = 3500 - 350 = 3150
    // truckGross = 3150 - 1575 = 1575
    // netProfit = 3500 - 350 - 0 - 1575 - 50 - 100 = 1425
    expect(result).toEqual({
      revenue: 3500,
      brokerFees: 350,
      localFees: 0,
      carrierPay: 100,
      driverPay: 1575,
      expenses: 50,
      netProfit: 1425,
      cleanGross: 3150,
      truckGross: 1575,
      totalMiles: 0,
      orderCount: 2,
      rpm: null,
      cpm: null,
      ppm: null,
      appc: 1750,
    })
  })

  it('calculates owner-operator dispatch fee correctly (driver gets remainder)', () => {
    const orders: OrderFinancials[] = [mkOrder({ revenue: 5000, brokerFee: 500 })]
    const driver: DriverConfig = {
      driverType: 'owner_operator',
      payType: 'dispatch_fee_percent',
      payRate: 10,
    }

    const result = calculateTripFinancials(orders, driver, [], 0)

    // cleanGross = 5000 - 500 = 4500
    // dispatchFee = 4500 * 0.10 = 450
    // driverPay = 4500 - 450 = 4050
    // truckGross = 4500 - 4050 = 450
    // netProfit = 5000 - 500 - 0 - 4050 - 0 - 0 = 450
    expect(result).toEqual({
      revenue: 5000,
      brokerFees: 500,
      localFees: 0,
      carrierPay: 0,
      driverPay: 4050,
      expenses: 0,
      netProfit: 450,
      cleanGross: 4500,
      truckGross: 450,
      totalMiles: 0,
      orderCount: 1,
      rpm: null,
      cpm: null,
      ppm: null,
      appc: 5000,
    })
  })

  it('calculates per-car flat rate as rate times order count', () => {
    const orders: OrderFinancials[] = [
      mkOrder({ revenue: 1000, brokerFee: 100 }),
      mkOrder({ revenue: 1200, brokerFee: 150 }),
    ]
    const driver: DriverConfig = {
      driverType: 'company',
      payType: 'per_car',
      payRate: 50,
    }
    const expenses: TripExpenseItem[] = [{ amount: 30 }]

    const result = calculateTripFinancials(orders, driver, expenses, 0)

    // driverPay = 50 * 2 = 100
    // cleanGross = 2200 - 250 = 1950
    // truckGross = 1950 - 100 = 1850
    // netProfit = 2200 - 250 - 0 - 100 - 30 - 0 = 1820
    expect(result).toEqual({
      revenue: 2200,
      brokerFees: 250,
      localFees: 0,
      carrierPay: 0,
      driverPay: 100,
      expenses: 30,
      netProfit: 1820,
      cleanGross: 1950,
      truckGross: 1850,
      totalMiles: 0,
      orderCount: 2,
      rpm: null,
      cpm: null,
      ppm: null,
      appc: 1100,
    })
  })

  it('calculates with carrier pay and multiple expenses', () => {
    const orders: OrderFinancials[] = [mkOrder({ revenue: 3000, brokerFee: 300 })]
    const driver: DriverConfig = {
      driverType: 'company',
      payType: 'percentage_of_carrier_pay',
      payRate: 40,
    }
    const expenses: TripExpenseItem[] = [{ amount: 100 }, { amount: 50 }]

    const result = calculateTripFinancials(orders, driver, expenses, 500)

    // cleanGross = 3000 - 300 = 2700
    // driverPay = 2700 * 0.40 = 1080
    // truckGross = 2700 - 1080 = 1620
    // netProfit = 3000 - 300 - 0 - 1080 - 150 - 500 = 970
    expect(result).toEqual({
      revenue: 3000,
      brokerFees: 300,
      localFees: 0,
      carrierPay: 500,
      driverPay: 1080,
      expenses: 150,
      netProfit: 970,
      cleanGross: 2700,
      truckGross: 1620,
      totalMiles: 0,
      orderCount: 1,
      rpm: null,
      cpm: null,
      ppm: null,
      appc: 3000,
    })
  })

  it('returns zero driver pay when driver is null', () => {
    const orders: OrderFinancials[] = [mkOrder({ revenue: 1000, brokerFee: 100 })]

    const result = calculateTripFinancials(orders, null, [], 0)

    expect(result).toEqual({
      revenue: 1000,
      brokerFees: 100,
      localFees: 0,
      carrierPay: 0,
      driverPay: 0,
      expenses: 0,
      netProfit: 900,
      cleanGross: 900,
      truckGross: 900,
      totalMiles: 0,
      orderCount: 1,
      rpm: null,
      cpm: null,
      ppm: null,
      appc: 1000,
    })
  })

  it('handles negative net profit (trip loses money)', () => {
    const orders: OrderFinancials[] = [mkOrder({ revenue: 500, brokerFee: 100 })]
    const driver: DriverConfig = {
      driverType: 'company',
      payType: 'percentage_of_carrier_pay',
      payRate: 60,
    }
    const expenses: TripExpenseItem[] = [{ amount: 200 }]

    const result = calculateTripFinancials(orders, driver, expenses, 300)

    // cleanGross = 500 - 100 = 400
    // driverPay = 400 * 0.60 = 240
    // truckGross = 400 - 240 = 160
    // netProfit = 500 - 100 - 0 - 240 - 200 - 300 = -340
    expect(result).toEqual({
      revenue: 500,
      brokerFees: 100,
      localFees: 0,
      carrierPay: 300,
      driverPay: 240,
      expenses: 200,
      netProfit: -340,
      cleanGross: 400,
      truckGross: 160,
      totalMiles: 0,
      orderCount: 1,
      rpm: null,
      cpm: null,
      ppm: null,
      appc: 500,
    })
  })

  // ============================================================================
  // Per-mile pay tests
  // ============================================================================

  it('calculates per-mile pay correctly', () => {
    const orders: OrderFinancials[] = [
      mkOrder({ revenue: 1200, brokerFee: 100, distanceMiles: 2800 }),
    ]
    const driver: DriverConfig = {
      driverType: 'company',
      payType: 'per_mile',
      payRate: 0.5,
    }

    const result = calculateTripFinancials(orders, driver, [], 0)

    // driverPay = 2800 * 0.50 = 1400
    // cleanGross = 1200 - 100 = 1100
    // truckGross = 1100 - 1400 = -300
    // netProfit = 1200 - 100 - 0 - 1400 - 0 - 0 = -300
    expect(result.driverPay).toBe(1400)
    expect(result.netProfit).toBe(-300)
    expect(result.totalMiles).toBe(2800)
    // RPM = 1200 / 2800 ≈ 0.4286
    expect(result.rpm).toBeCloseTo(0.4286, 3)
  })

  it('calculates per-mile pay with multiple orders of varying distances', () => {
    const orders: OrderFinancials[] = [
      mkOrder({ revenue: 800, brokerFee: 50, distanceMiles: 1000 }),
      mkOrder({ revenue: 600, brokerFee: 30, distanceMiles: 500 }),
    ]
    const driver: DriverConfig = {
      driverType: 'company',
      payType: 'per_mile',
      payRate: 0.75,
    }

    const result = calculateTripFinancials(orders, driver, [], 0)

    // totalMiles = 1000 + 500 = 1500
    // driverPay = 1500 * 0.75 = 1125
    // netProfit = 1400 - 80 - 0 - 1125 - 0 - 0 = 195
    expect(result.driverPay).toBe(1125)
    expect(result.netProfit).toBe(195)
    expect(result.totalMiles).toBe(1500)
    expect(result.orderCount).toBe(2)
    expect(result.appc).toBe(700)
  })

  it('per-mile pay with null distance_miles contributes 0 miles', () => {
    const orders: OrderFinancials[] = [
      mkOrder({ revenue: 500, brokerFee: 0, distanceMiles: null }),
      mkOrder({ revenue: 500, brokerFee: 0, distanceMiles: 100 }),
    ]
    const driver: DriverConfig = {
      driverType: 'company',
      payType: 'per_mile',
      payRate: 1.0,
    }

    const result = calculateTripFinancials(orders, driver, [], 0)

    // totalMiles = 0 + 100 = 100
    // driverPay = 100 * 1.0 = 100
    expect(result.driverPay).toBe(100)
    expect(result.totalMiles).toBe(100)
  })

  // ============================================================================
  // Local fee tests
  // ============================================================================

  it('subtracts local fees from Clean Gross and net profit', () => {
    const orders: OrderFinancials[] = [
      mkOrder({ revenue: 1200, brokerFee: 100, localFee: 170 }),
    ]
    const driver: DriverConfig = {
      driverType: 'company',
      payType: 'percentage_of_carrier_pay',
      payRate: 90,
    }

    const result = calculateTripFinancials(orders, driver, [], 0)

    // cleanGross = 1200 - 100 - 170 = 930
    // driverPay = 930 * 0.90 = 837
    // truckGross = 930 - 837 = 93
    // netProfit = 1200 - 100 - 170 - 837 - 0 - 0 = 93
    expect(result.cleanGross).toBe(930)
    expect(result.truckGross).toBe(93)
    expect(result.driverPay).toBe(837)
    expect(result.netProfit).toBe(93)
  })

  it('local fees reduce dispatch fee driver pay correctly', () => {
    const orders: OrderFinancials[] = [
      mkOrder({ revenue: 5000, brokerFee: 500, localFee: 170 }),
    ]
    const driver: DriverConfig = {
      driverType: 'owner_operator',
      payType: 'dispatch_fee_percent',
      payRate: 10,
    }

    const result = calculateTripFinancials(orders, driver, [], 0)

    // cleanGross = 5000 - 500 - 170 = 4330
    // dispatchFee = 4330 * 0.10 = 433
    // driverPay = 4330 - 433 = 3897
    // truckGross = 4330 - 3897 = 433
    // netProfit = 5000 - 500 - 170 - 3897 - 0 - 0 = 433
    expect(result.cleanGross).toBe(4330)
    expect(result.truckGross).toBe(433)
    expect(result.driverPay).toBe(3897)
    expect(result.netProfit).toBe(433)
  })

  // ============================================================================
  // Per-order driver % override tests
  // ============================================================================

  it('per-order driver % override replaces global rate for that order', () => {
    const orders: OrderFinancials[] = [
      mkOrder({ revenue: 1000, brokerFee: 100, driverPayRateOverride: 80 }),  // override 80%
      mkOrder({ revenue: 1000, brokerFee: 100, driverPayRateOverride: null }), // uses global 60%
    ]
    const driver: DriverConfig = {
      driverType: 'company',
      payType: 'percentage_of_carrier_pay',
      payRate: 60,
    }

    const result = calculateTripFinancials(orders, driver, [], 0)

    // order1: cleanGross = 900, driverPay = 900 * 0.80 = 720
    // order2: cleanGross = 900, driverPay = 900 * 0.60 = 540
    // total driverPay = 720 + 540 = 1260
    // cleanGross = 2000 - 200 = 1800
    // truckGross = 1800 - 1260 = 540
    expect(result.driverPay).toBe(1260)
    expect(result.cleanGross).toBe(1800)
    expect(result.truckGross).toBe(540)
    expect(result.netProfit).toBe(540)
  })

  it('per-order override works with dispatch_fee_percent too', () => {
    const orders: OrderFinancials[] = [
      mkOrder({ revenue: 5000, brokerFee: 500, driverPayRateOverride: 15 }), // 15% dispatch fee
    ]
    const driver: DriverConfig = {
      driverType: 'owner_operator',
      payType: 'dispatch_fee_percent',
      payRate: 10,
    }

    const result = calculateTripFinancials(orders, driver, [], 0)

    // cleanGross = 5000 - 500 = 4500
    // dispatchFee = 4500 * 0.15 = 675 (using override)
    // driverPay = 4500 - 675 = 3825
    expect(result.driverPay).toBe(3825)
    expect(result.netProfit).toBe(675)
  })

  // ============================================================================
  // Combined scenario
  // ============================================================================

  it('combined: local fee + per-mile pay + distance metrics', () => {
    const orders: OrderFinancials[] = [
      mkOrder({ revenue: 2000, brokerFee: 200, localFee: 170, distanceMiles: 1000 }),
      mkOrder({ revenue: 1500, brokerFee: 100, localFee: 0, distanceMiles: 800 }),
    ]
    const driver: DriverConfig = {
      driverType: 'company',
      payType: 'per_mile',
      payRate: 0.50,
    }

    const result = calculateTripFinancials(orders, driver, [{ amount: 50 }], 0)

    // totalMiles = 1000 + 800 = 1800
    // driverPay = 1800 * 0.50 = 900
    // cleanGross = 3500 - 300 - 170 = 3030
    // truckGross = 3030 - 900 = 2130
    // netProfit = 3500 - 300 - 170 - 900 - 50 - 0 = 2080
    expect(result.revenue).toBe(3500)
    expect(result.cleanGross).toBe(3030)
    expect(result.truckGross).toBe(2130)
    expect(result.driverPay).toBe(900)
    expect(result.netProfit).toBe(2080)
    expect(result.totalMiles).toBe(1800)
    expect(result.orderCount).toBe(2)
    expect(result.appc).toBe(1750)
    // RPM = 3500 / 1800 ≈ 1.944
    expect(result.rpm).toBeCloseTo(1.944, 2)
  })
})
