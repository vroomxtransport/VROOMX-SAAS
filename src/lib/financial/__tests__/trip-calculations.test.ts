import { describe, it, expect } from 'vitest'
import {
  calculateTripFinancials,
  type OrderFinancials,
  type DriverConfig,
  type TripExpenseItem,
} from '../trip-calculations'

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
      carrierPay: 0,
      driverPay: 0,
      expenses: 0,
      netProfit: 0,
    })
  })

  it('calculates company driver pay as percentage of revenue after broker fees', () => {
    const orders: OrderFinancials[] = [{ revenue: 1000, brokerFee: 100 }]
    const driver: DriverConfig = {
      driverType: 'company',
      payType: 'percentage_of_carrier_pay',
      payRate: 60,
    }

    const result = calculateTripFinancials(orders, driver, [], 0)

    // revenueAfterFees = 1000 - 100 = 900
    // driverPay = 900 * 0.60 = 540
    // netProfit = 1000 - 100 - 540 - 0 - 0 = 360
    expect(result).toEqual({
      revenue: 1000,
      brokerFees: 100,
      carrierPay: 0,
      driverPay: 540,
      expenses: 0,
      netProfit: 360,
    })
  })

  it('calculates multi-order company driver at 50% with expenses and carrier pay', () => {
    const orders: OrderFinancials[] = [
      { revenue: 2000, brokerFee: 200 },
      { revenue: 1500, brokerFee: 150 },
    ]
    const driver: DriverConfig = {
      driverType: 'company',
      payType: 'percentage_of_carrier_pay',
      payRate: 50,
    }
    const expenses: TripExpenseItem[] = [{ amount: 50 }]

    const result = calculateTripFinancials(orders, driver, expenses, 100)

    // revenue = 2000 + 1500 = 3500
    // brokerFees = 200 + 150 = 350
    // revenueAfterFees = 3500 - 350 = 3150
    // driverPay = 3150 * 0.50 = 1575
    // expenses = 50
    // carrierPay = 100
    // netProfit = 3500 - 350 - 1575 - 50 - 100 = 1425
    expect(result).toEqual({
      revenue: 3500,
      brokerFees: 350,
      carrierPay: 100,
      driverPay: 1575,
      expenses: 50,
      netProfit: 1425,
    })
  })

  it('calculates owner-operator dispatch fee correctly (driver gets remainder)', () => {
    const orders: OrderFinancials[] = [{ revenue: 5000, brokerFee: 500 }]
    const driver: DriverConfig = {
      driverType: 'owner_operator',
      payType: 'dispatch_fee_percent',
      payRate: 10,
    }

    const result = calculateTripFinancials(orders, driver, [], 0)

    // revenueAfterFees = 5000 - 500 = 4500
    // dispatchFee (company keeps) = 4500 * 0.10 = 450
    // driverPay = 4500 - 450 = 4050
    // netProfit = 5000 - 500 - 4050 - 0 - 0 = 450
    expect(result).toEqual({
      revenue: 5000,
      brokerFees: 500,
      carrierPay: 0,
      driverPay: 4050,
      expenses: 0,
      netProfit: 450,
    })
  })

  it('calculates per-car flat rate as rate times order count', () => {
    const orders: OrderFinancials[] = [
      { revenue: 1000, brokerFee: 100 },
      { revenue: 1200, brokerFee: 150 },
    ]
    const driver: DriverConfig = {
      driverType: 'company',
      payType: 'per_car',
      payRate: 50,
    }
    const expenses: TripExpenseItem[] = [{ amount: 30 }]

    const result = calculateTripFinancials(orders, driver, expenses, 0)

    // revenue = 1000 + 1200 = 2200
    // brokerFees = 100 + 150 = 250
    // driverPay = 50 * 2 = 100
    // expenses = 30
    // netProfit = 2200 - 250 - 100 - 30 - 0 = 1820
    expect(result).toEqual({
      revenue: 2200,
      brokerFees: 250,
      carrierPay: 0,
      driverPay: 100,
      expenses: 30,
      netProfit: 1820,
    })
  })

  it('calculates with carrier pay and multiple expenses', () => {
    const orders: OrderFinancials[] = [{ revenue: 3000, brokerFee: 300 }]
    const driver: DriverConfig = {
      driverType: 'company',
      payType: 'percentage_of_carrier_pay',
      payRate: 40,
    }
    const expenses: TripExpenseItem[] = [{ amount: 100 }, { amount: 50 }]

    const result = calculateTripFinancials(orders, driver, expenses, 500)

    // revenue = 3000
    // brokerFees = 300
    // revenueAfterFees = 3000 - 300 = 2700
    // driverPay = 2700 * 0.40 = 1080
    // expenses = 100 + 50 = 150
    // carrierPay = 500
    // netProfit = 3000 - 300 - 1080 - 150 - 500 = 970
    expect(result).toEqual({
      revenue: 3000,
      brokerFees: 300,
      carrierPay: 500,
      driverPay: 1080,
      expenses: 150,
      netProfit: 970,
    })
  })

  it('returns zero driver pay when driver is null', () => {
    const orders: OrderFinancials[] = [{ revenue: 1000, brokerFee: 100 }]

    const result = calculateTripFinancials(orders, null, [], 0)

    // revenue = 1000
    // brokerFees = 100
    // driverPay = 0 (no driver)
    // netProfit = 1000 - 100 - 0 - 0 - 0 = 900
    expect(result).toEqual({
      revenue: 1000,
      brokerFees: 100,
      carrierPay: 0,
      driverPay: 0,
      expenses: 0,
      netProfit: 900,
    })
  })

  it('handles negative net profit (trip loses money)', () => {
    const orders: OrderFinancials[] = [{ revenue: 500, brokerFee: 100 }]
    const driver: DriverConfig = {
      driverType: 'company',
      payType: 'percentage_of_carrier_pay',
      payRate: 60,
    }
    const expenses: TripExpenseItem[] = [{ amount: 200 }]

    const result = calculateTripFinancials(orders, driver, expenses, 300)

    // revenue = 500
    // brokerFees = 100
    // revenueAfterFees = 500 - 100 = 400
    // driverPay = 400 * 0.60 = 240
    // expenses = 200
    // carrierPay = 300
    // netProfit = 500 - 100 - 240 - 200 - 300 = -340
    expect(result).toEqual({
      revenue: 500,
      brokerFees: 100,
      carrierPay: 300,
      driverPay: 240,
      expenses: 200,
      netProfit: -340,
    })
  })
})
