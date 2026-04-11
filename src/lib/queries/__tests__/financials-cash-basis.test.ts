import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchKPIAggregates } from '../financials'

// ============================================================================
// Wave 6: cash-basis aggregation path in fetchKPIAggregates
//
// These tests exercise the cash-basis branch specifically — the ratio
// clamping, zero-revenue fallback, overpayment handling, and the
// distinct-order count via order.id. The accrual path is indirectly
// covered by the existing financials pages that consume it.
// ============================================================================

interface TableResult {
  data: unknown
  error: unknown
  count?: number
}

/**
 * Builds a chainable Supabase mock where each `.from(table)` call returns
 * a query builder that swallows any chain of filter methods and resolves
 * to a preset result per table. `.head: true` aware — we pass `count`
 * when mocking a HEAD count query.
 */
function buildMockSupabase(tableResults: Record<string, TableResult>): SupabaseClient {
  const makeChain = (result: TableResult) => {
    const chain: Record<string, unknown> = {}
    const assign = (key: string, value: unknown) => {
      Object.defineProperty(chain, key, { value, writable: true, enumerable: true, configurable: true })
    }
    for (const method of ['eq', 'in', 'gte', 'lte', 'or', 'order', 'limit', 'not'] as const) {
      assign(method, vi.fn().mockReturnValue(chain))
    }
    chain.then = (resolve: (value: TableResult) => void) => {
      resolve(result)
      return Promise.resolve(result)
    }
    chain.maybeSingle = vi.fn().mockResolvedValue(result)
    chain.single = vi.fn().mockResolvedValue(result)
    return chain
  }

  const client = {
    from: vi.fn().mockImplementation((table: string) => {
      const result = tableResults[table] ?? { data: [], error: null }
      return {
        select: vi.fn().mockReturnValue(makeChain(result)),
      }
    }),
  }
  return client as unknown as SupabaseClient
}

const DATE_RANGE = {
  from: '2026-03-01T00:00:00.000Z',
  to: '2026-03-31T23:59:59.999Z',
}

/**
 * Shared fixture setup: empty trips / trip_expenses / trucks so only the
 * cash-mode payments path contributes to the aggregate under test.
 */
function emptyFixtures(): Record<string, TableResult> {
  return {
    trips: { data: [], error: null },
    trip_expenses: { data: [], error: null },
    trucks: { data: [], error: null, count: 0 },
    orders: { data: [], error: null }, // used by safeFetchMiles
  }
}

describe('fetchKPIAggregates cash-basis', () => {
  it('proportionally attributes deductions for a single partial payment', async () => {
    // $2000 payment on a $5000 order with $500 broker fee, $100 local fee
    // Ratio = 0.4 → attribute 40% of deductions
    const supabase = buildMockSupabase({
      ...emptyFixtures(),
      payments: {
        data: [
          {
            amount: '2000.00',
            payment_date: '2026-03-10',
            order: {
              id: 'order-1',
              revenue: '5000.00',
              broker_fee: '500.00',
              local_fee: '100.00',
              carrier_pay: '3000.00',
            },
          },
        ],
        error: null,
      },
    })

    const kpi = await fetchKPIAggregates(supabase, DATE_RANGE, 'cash')

    expect(kpi.totalRevenue).toBe(2000)
    expect(kpi.totalBrokerFees).toBe(200) // 500 * 0.4
    expect(kpi.totalLocalFees).toBe(40) // 100 * 0.4
    expect(kpi.totalCarrierPay).toBe(1200) // 3000 * 0.4
    expect(kpi.orderCount).toBe(1)
  })

  it('sums multiple payments on the same order to full attribution', async () => {
    // Two $2000 payments on a $5000 order, then a $1000 payment on a
    // different order. First order collects 80% total; second collects 100%.
    const supabase = buildMockSupabase({
      ...emptyFixtures(),
      payments: {
        data: [
          {
            amount: '2000',
            payment_date: '2026-03-05',
            order: {
              id: 'order-1',
              revenue: '5000',
              broker_fee: '500',
              local_fee: '0',
              carrier_pay: '3000',
            },
          },
          {
            amount: '2000',
            payment_date: '2026-03-15',
            order: {
              id: 'order-1',
              revenue: '5000',
              broker_fee: '500',
              local_fee: '0',
              carrier_pay: '3000',
            },
          },
          {
            amount: '1000',
            payment_date: '2026-03-20',
            order: {
              id: 'order-2',
              revenue: '1000',
              broker_fee: '100',
              local_fee: '0',
              carrier_pay: '600',
            },
          },
        ],
        error: null,
      },
    })

    const kpi = await fetchKPIAggregates(supabase, DATE_RANGE, 'cash')

    // Revenue = 2000 + 2000 + 1000 = 5000 (cash in)
    expect(kpi.totalRevenue).toBe(5000)
    // Broker: (500 * 0.4) + (500 * 0.4) + (100 * 1.0) = 200 + 200 + 100 = 500
    expect(kpi.totalBrokerFees).toBe(500)
    // Carrier: (3000 * 0.4) + (3000 * 0.4) + (600 * 1.0) = 1200 + 1200 + 600 = 3000
    expect(kpi.totalCarrierPay).toBe(3000)
    // 2 distinct orders — not 3 (two payments on order-1 collapse)
    expect(kpi.orderCount).toBe(2)
  })

  it('distinct orderCount keyed by order.id not revenue amount', async () => {
    // Two different orders with the same $1000 revenue — dedup by id,
    // not by revenue value. Revenue-amount dedup would undercount to 1.
    const supabase = buildMockSupabase({
      ...emptyFixtures(),
      payments: {
        data: [
          {
            amount: '1000',
            payment_date: '2026-03-10',
            order: {
              id: 'order-a',
              revenue: '1000',
              broker_fee: '0',
              local_fee: '0',
              carrier_pay: '0',
            },
          },
          {
            amount: '1000',
            payment_date: '2026-03-12',
            order: {
              id: 'order-b',
              revenue: '1000',
              broker_fee: '0',
              local_fee: '0',
              carrier_pay: '0',
            },
          },
        ],
        error: null,
      },
    })

    const kpi = await fetchKPIAggregates(supabase, DATE_RANGE, 'cash')
    expect(kpi.orderCount).toBe(2)
  })

  it('zero-revenue order: cash flows through as revenue but no phantom deductions', async () => {
    // Order has revenue=0 but somehow broker_fee=500 (data quality issue).
    // The fallback ratio=0 means the $1000 payment counts as pure revenue
    // with no broker fee attribution — safer than ratio=1 which would
    // have attributed the full $500.
    const supabase = buildMockSupabase({
      ...emptyFixtures(),
      payments: {
        data: [
          {
            amount: '1000',
            payment_date: '2026-03-10',
            order: {
              id: 'order-zero',
              revenue: '0',
              broker_fee: '500',
              local_fee: '100',
              carrier_pay: '600',
            },
          },
        ],
        error: null,
      },
    })

    const kpi = await fetchKPIAggregates(supabase, DATE_RANGE, 'cash')

    expect(kpi.totalRevenue).toBe(1000)
    expect(kpi.totalBrokerFees).toBe(0)
    expect(kpi.totalLocalFees).toBe(0)
    expect(kpi.totalCarrierPay).toBe(0)
    expect(kpi.orderCount).toBe(1) // still counted even with zero revenue
  })

  it('over-payment (ratio > 1) clamps deductions to full value', async () => {
    // Customer pays $6000 on a $5000 order (duplicate payment or
    // overpayment). Ratio raw = 1.2, clamped to 1.0. Revenue gets the
    // full $6000, but broker fee is the full $500 (not $600).
    const supabase = buildMockSupabase({
      ...emptyFixtures(),
      payments: {
        data: [
          {
            amount: '6000',
            payment_date: '2026-03-10',
            order: {
              id: 'order-1',
              revenue: '5000',
              broker_fee: '500',
              local_fee: '100',
              carrier_pay: '3000',
            },
          },
        ],
        error: null,
      },
    })

    const kpi = await fetchKPIAggregates(supabase, DATE_RANGE, 'cash')

    expect(kpi.totalRevenue).toBe(6000)
    expect(kpi.totalBrokerFees).toBe(500) // clamped, not 600
    expect(kpi.totalLocalFees).toBe(100) // clamped
    expect(kpi.totalCarrierPay).toBe(3000) // clamped
  })

  it('empty period: zero aggregates, no crash', async () => {
    const supabase = buildMockSupabase({
      ...emptyFixtures(),
      payments: { data: [], error: null },
    })

    const kpi = await fetchKPIAggregates(supabase, DATE_RANGE, 'cash')

    expect(kpi.totalRevenue).toBe(0)
    expect(kpi.totalBrokerFees).toBe(0)
    expect(kpi.totalLocalFees).toBe(0)
    expect(kpi.totalCarrierPay).toBe(0)
    expect(kpi.orderCount).toBe(0)
  })

  it('handles Supabase embedded-array response shape', async () => {
    // Supabase returns the embedded relation as an array when the FK
    // is non-unique. Our adapter must handle both `{ order: {...} }` and
    // `{ order: [{...}] }`.
    const supabase = buildMockSupabase({
      ...emptyFixtures(),
      payments: {
        data: [
          {
            amount: '1000',
            payment_date: '2026-03-10',
            order: [
              {
                id: 'order-1',
                revenue: '1000',
                broker_fee: '100',
                local_fee: '0',
                carrier_pay: '600',
              },
            ],
          },
        ],
        error: null,
      },
    })

    const kpi = await fetchKPIAggregates(supabase, DATE_RANGE, 'cash')

    expect(kpi.totalRevenue).toBe(1000)
    expect(kpi.totalBrokerFees).toBe(100)
    expect(kpi.orderCount).toBe(1)
  })

  it('defaults to accrual mode when basis arg is omitted', async () => {
    // No `basis` arg → should hit the orders path, NOT the payments path.
    // Verify by providing rich payments data that would produce non-zero
    // cash results, and empty orders — if the function is in cash mode,
    // totalRevenue would be > 0.
    const supabase = buildMockSupabase({
      ...emptyFixtures(),
      payments: {
        data: [
          {
            amount: '1000',
            payment_date: '2026-03-10',
            order: {
              id: 'order-1',
              revenue: '5000',
              broker_fee: '500',
              local_fee: '0',
              carrier_pay: '3000',
            },
          },
        ],
        error: null,
      },
      orders: { data: [], error: null },
    })

    // Accrual mode reads from orders, which is empty → all zeros.
    const kpi = await fetchKPIAggregates(supabase, DATE_RANGE)
    expect(kpi.totalRevenue).toBe(0)
    expect(kpi.orderCount).toBe(0)
  })
})
