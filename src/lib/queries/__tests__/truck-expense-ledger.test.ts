import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getTruckExpenses,
  summarizeTruckExpenses,
  normalizeTripExpenseCategory,
  normalizeBusinessExpenseCategory,
  monthsBetween,
  type TruckExpenseEntry,
} from '../truck-expense-ledger'

// ============================================================================
// Chainable Supabase query-builder mock
// ============================================================================

/**
 * Builds a per-table mock that swallows any chain of builder methods
 * (`eq`, `in`, `gte`, `lte`, `or`) and resolves to the preset result when
 * awaited. Per-table results can be overridden so each test scopes its
 * fixture to exactly the source table under test.
 */
function buildMockSupabase(tableResults: Record<string, { data: unknown; error: unknown }>): SupabaseClient {
  const makeChain = (result: { data: unknown; error: unknown }) => {
    const chain: Record<string, unknown> = {}
    const assign = (key: string, value: unknown) => {
      Object.defineProperty(chain, key, { value, writable: true, enumerable: true, configurable: true })
    }
    for (const method of ['eq', 'in', 'gte', 'lte', 'or', 'order', 'limit'] as const) {
      assign(method, vi.fn().mockReturnValue(chain))
    }
    chain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => {
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

// ============================================================================
// Pure helpers
// ============================================================================

describe('normalizeTripExpenseCategory', () => {
  it('passes through valid trip_expense enum values', () => {
    expect(normalizeTripExpenseCategory('fuel')).toBe('fuel')
    expect(normalizeTripExpenseCategory('tolls')).toBe('tolls')
    expect(normalizeTripExpenseCategory('repairs')).toBe('repairs')
    expect(normalizeTripExpenseCategory('lodging')).toBe('lodging')
    expect(normalizeTripExpenseCategory('misc')).toBe('misc')
  })

  it('falls back to misc for unknown categories', () => {
    expect(normalizeTripExpenseCategory('nonsense')).toBe('misc')
    expect(normalizeTripExpenseCategory('')).toBe('misc')
  })
})

describe('normalizeBusinessExpenseCategory', () => {
  it('passes through business_expense categories that already match the normalized vocab', () => {
    expect(normalizeBusinessExpenseCategory('insurance')).toBe('insurance')
    expect(normalizeBusinessExpenseCategory('truck_lease')).toBe('truck_lease')
    expect(normalizeBusinessExpenseCategory('registration')).toBe('registration')
    expect(normalizeBusinessExpenseCategory('office_supplies')).toBe('office_supplies')
  })

  it('maps legacy category aliases to normalized names', () => {
    expect(normalizeBusinessExpenseCategory('tolls_fixed')).toBe('tolls')
  })

  it('falls back to misc for unknown business categories', () => {
    expect(normalizeBusinessExpenseCategory('other')).toBe('misc')
    expect(normalizeBusinessExpenseCategory('')).toBe('misc')
  })
})

describe('monthsBetween', () => {
  it('returns 1 for same-month dates', () => {
    expect(monthsBetween(new Date('2026-03-01'), new Date('2026-03-31'))).toBe(1)
    expect(monthsBetween(new Date('2026-03-15'), new Date('2026-03-15'))).toBe(1)
  })

  it('counts inclusive months across a year', () => {
    expect(monthsBetween(new Date('2026-01-01'), new Date('2026-12-31'))).toBe(12)
    expect(monthsBetween(new Date('2026-01-01'), new Date('2026-03-31'))).toBe(3)
  })

  it('spans a year boundary correctly', () => {
    expect(monthsBetween(new Date('2025-11-01'), new Date('2026-02-28'))).toBe(4)
  })

  it('returns 0 when end is before start', () => {
    expect(monthsBetween(new Date('2026-06-01'), new Date('2026-03-01'))).toBe(0)
  })
})

describe('summarizeTruckExpenses', () => {
  const make = (overrides: Partial<TruckExpenseEntry>): TruckExpenseEntry => ({
    id: 'trip_expenses:1',
    sourceTable: 'trip_expenses',
    sourceId: '1',
    truckId: 'truck-1',
    scope: 'trip',
    category: 'fuel',
    amount: 100,
    occurredAt: '2026-03-15',
    description: 'test',
    metadata: {},
    editable: true,
    sourceBadge: 'manual',
    ...overrides,
  })

  it('returns all-zero summary for an empty ledger', () => {
    const s = summarizeTruckExpenses([])
    expect(s.total).toBe(0)
    expect(s.fuel).toBe(0)
    expect(s.maintenance).toBe(0)
  })

  it('groups by named category bucket', () => {
    const s = summarizeTruckExpenses([
      make({ category: 'fuel', amount: 250 }),
      make({ category: 'fuel', amount: 150 }),
      make({ category: 'tolls', amount: 40 }),
      make({ category: 'maintenance', amount: 800 }),
      make({ category: 'insurance', amount: 300 }),
      make({ category: 'truck_lease', amount: 1200 }),
      make({ category: 'registration', amount: 75 }),
    ])

    expect(s.fuel).toBe(400)
    expect(s.tolls).toBe(40)
    expect(s.maintenance).toBe(800)
    expect(s.insurance).toBe(300)
    expect(s.truck_lease).toBe(1200)
    expect(s.registration).toBe(75)
    expect(s.total).toBe(400 + 40 + 800 + 300 + 1200 + 75)
  })

  it('groups non-truck business categories under fixed_other', () => {
    const s = summarizeTruckExpenses([
      make({ category: 'dispatch', amount: 100 }),
      make({ category: 'parking', amount: 50 }),
      make({ category: 'software', amount: 200 }),
      make({ category: 'salary', amount: 3000 }),
    ])

    expect(s.fixed_other).toBe(3350)
    expect(s.total).toBe(3350)
  })

  it('buckets misc category into other', () => {
    const s = summarizeTruckExpenses([make({ category: 'misc', amount: 123 })])
    expect(s.other).toBe(123)
    expect(s.total).toBe(123)
  })

  it('rounds currency to 2 decimal places', () => {
    const s = summarizeTruckExpenses([
      make({ category: 'fuel', amount: 12.345 }),
      make({ category: 'fuel', amount: 7.891 }),
    ])
    expect(s.fuel).toBe(20.24)
    expect(s.total).toBe(20.24)
  })
})

// ============================================================================
// getTruckExpenses integration
// ============================================================================

describe('getTruckExpenses', () => {
  const TRUCK_ID = 'truck-1'
  const RANGE = { from: '2026-03-01', to: '2026-03-31' }

  it('returns empty ledger when every source is empty', async () => {
    const supabase = buildMockSupabase({})
    const entries = await getTruckExpenses(supabase, TRUCK_ID, RANGE)
    expect(entries).toEqual([])
  })

  it('normalizes trip_expenses through the trips join', async () => {
    const supabase = buildMockSupabase({
      trips: { data: [{ id: 'trip-a' }], error: null },
      trip_expenses: {
        data: [
          {
            id: 'te-1',
            trip_id: 'trip-a',
            category: 'fuel',
            custom_label: 'Pilot stop',
            amount: '250.00',
            notes: null,
            expense_date: '2026-03-10',
            created_at: '2026-03-10T12:00:00Z',
          },
          {
            id: 'te-2',
            trip_id: 'trip-a',
            category: 'tolls',
            custom_label: null,
            amount: '15.50',
            notes: 'i-76',
            expense_date: '2026-03-11',
            created_at: '2026-03-11T12:00:00Z',
          },
        ],
        error: null,
      },
    })

    const entries = await getTruckExpenses(supabase, TRUCK_ID, RANGE)

    const tripRows = entries.filter((e) => e.sourceTable === 'trip_expenses')
    expect(tripRows).toHaveLength(2)
    expect(tripRows[0].id).toBe('trip_expenses:te-2') // sorted desc by occurredAt
    expect(tripRows[0].amount).toBe(15.5)
    expect(tripRows[0].category).toBe('tolls')
    expect(tripRows[0].scope).toBe('trip')
    expect(tripRows[0].editable).toBe(true)
    expect(tripRows[0].sourceBadge).toBe('manual')
    expect(tripRows[1].description).toBe('Pilot stop')
    expect(tripRows[1].metadata).toMatchObject({ trip_id: 'trip-a' })
  })

  it('skips trip_expenses entirely when the truck has no trips', async () => {
    const supabase = buildMockSupabase({
      trips: { data: [], error: null },
      trip_expenses: {
        data: [{ id: 'te-1', amount: '999' }],
        error: null,
      },
    })

    const entries = await getTruckExpenses(supabase, TRUCK_ID, RANGE)
    expect(entries.filter((e) => e.sourceTable === 'trip_expenses')).toHaveLength(0)
  })

  it('normalizes fuel_entries with IFTA metadata', async () => {
    const supabase = buildMockSupabase({
      fuel_entries: {
        data: [
          {
            id: 'fe-1',
            date: '2026-03-12',
            gallons: '125.000',
            cost_per_gallon: '3.850',
            total_cost: '481.25',
            odometer: 125_432,
            location: 'Love\'s Travel Stop',
            state: 'OH',
            notes: null,
          },
        ],
        error: null,
      },
    })

    const entries = await getTruckExpenses(supabase, TRUCK_ID, RANGE)
    const fuelRows = entries.filter((e) => e.sourceTable === 'fuel_entries')
    expect(fuelRows).toHaveLength(1)
    expect(fuelRows[0].category).toBe('fuel')
    expect(fuelRows[0].amount).toBe(481.25)
    expect(fuelRows[0].occurredAt).toBe('2026-03-12')
    expect(fuelRows[0].description).toBe('Love\'s Travel Stop')
    expect(fuelRows[0].metadata).toMatchObject({
      gallons: 125,
      cost_per_gallon: 3.85,
      state: 'OH',
      odometer: 125_432,
    })
  })

  it('only surfaces completed maintenance records', async () => {
    const supabase = buildMockSupabase({
      maintenance_records: {
        data: [
          {
            id: 'mr-1',
            maintenance_type: 'tire',
            status: 'completed',
            description: '4 drive tires',
            vendor: 'Big O',
            cost: '1200.00',
            scheduled_date: '2026-03-14',
            completed_date: '2026-03-15T14:30:00Z',
            odometer: 125_500,
            notes: null,
          },
        ],
        error: null,
      },
    })

    const entries = await getTruckExpenses(supabase, TRUCK_ID, RANGE)
    const maintRows = entries.filter((e) => e.sourceTable === 'maintenance_records')
    expect(maintRows).toHaveLength(1)
    expect(maintRows[0].amount).toBe(1200)
    expect(maintRows[0].category).toBe('maintenance')
    expect(maintRows[0].occurredAt).toBe('2026-03-15')
    expect(maintRows[0].metadata).toMatchObject({ vendor: 'Big O', maintenance_type: 'tire' })
  })

  describe('business_expenses proration', () => {
    it('includes a one_time row that lands inside the period at full amount', async () => {
      const supabase = buildMockSupabase({
        business_expenses: {
          data: [
            {
              id: 'be-1',
              name: 'DOT inspection fee',
              category: 'registration',
              recurrence: 'one_time',
              amount: '150.00',
              effective_from: '2026-03-15',
              effective_to: null,
              notes: null,
            },
          ],
          error: null,
        },
      })

      const entries = await getTruckExpenses(supabase, TRUCK_ID, RANGE)
      const bizRows = entries.filter((e) => e.sourceTable === 'business_expenses')
      expect(bizRows).toHaveLength(1)
      expect(bizRows[0].amount).toBe(150)
      expect(bizRows[0].category).toBe('registration')
      expect(bizRows[0].scope).toBe('business_allocated')
      expect(bizRows[0].metadata).toMatchObject({ prorated: true, overlap_months: 1 })
    })

    it('excludes a one_time row whose effective_from is outside the period', async () => {
      const supabase = buildMockSupabase({
        business_expenses: {
          data: [
            {
              id: 'be-1',
              name: 'Old fee',
              category: 'registration',
              recurrence: 'one_time',
              amount: '150.00',
              effective_from: '2026-01-10',
              effective_to: null,
              notes: null,
            },
          ],
          error: null,
        },
      })

      const entries = await getTruckExpenses(supabase, TRUCK_ID, RANGE)
      expect(entries.filter((e) => e.sourceTable === 'business_expenses')).toHaveLength(0)
    })

    it('prorates a monthly row by overlap months', async () => {
      const supabase = buildMockSupabase({
        business_expenses: {
          data: [
            {
              id: 'be-2',
              name: 'Physical damage insurance',
              category: 'insurance',
              recurrence: 'monthly',
              amount: '450.00',
              effective_from: '2025-06-01',
              effective_to: null,
              notes: null,
            },
          ],
          error: null,
        },
      })

      const entries = await getTruckExpenses(supabase, TRUCK_ID, RANGE)
      const row = entries.find((e) => e.sourceId === 'be-2')
      expect(row).toBeDefined()
      // March 2026 range = 1 overlap month × $450
      expect(row!.amount).toBe(450)
    })

    it('prorates an annual row by 1 month out of 12', async () => {
      const supabase = buildMockSupabase({
        business_expenses: {
          data: [
            {
              id: 'be-3',
              name: 'IFTA registration',
              category: 'registration',
              recurrence: 'annual',
              amount: '1200.00',
              effective_from: '2026-01-01',
              effective_to: null,
              notes: null,
            },
          ],
          error: null,
        },
      })

      const entries = await getTruckExpenses(supabase, TRUCK_ID, RANGE)
      const row = entries.find((e) => e.sourceId === 'be-3')
      expect(row).toBeDefined()
      expect(row!.amount).toBe(100) // 1200 / 12 × 1 overlap month
    })
  })

  it('merges all four sources and sorts by occurredAt DESC', async () => {
    const supabase = buildMockSupabase({
      trips: { data: [{ id: 'trip-a' }], error: null },
      trip_expenses: {
        data: [
          {
            id: 'te-1',
            trip_id: 'trip-a',
            category: 'fuel',
            custom_label: null,
            amount: '100',
            notes: null,
            expense_date: '2026-03-05',
            created_at: '2026-03-05T12:00:00Z',
          },
        ],
        error: null,
      },
      fuel_entries: {
        data: [
          {
            id: 'fe-1',
            date: '2026-03-20',
            gallons: '100',
            cost_per_gallon: '4',
            total_cost: '400',
            odometer: null,
            location: null,
            state: null,
            notes: null,
          },
        ],
        error: null,
      },
      maintenance_records: {
        data: [
          {
            id: 'mr-1',
            maintenance_type: 'oil_change',
            status: 'completed',
            description: null,
            vendor: null,
            cost: '250',
            scheduled_date: null,
            completed_date: '2026-03-12T00:00:00Z',
            odometer: null,
            notes: null,
          },
        ],
        error: null,
      },
      business_expenses: {
        data: [
          {
            id: 'be-1',
            name: 'Insurance',
            category: 'insurance',
            recurrence: 'monthly',
            amount: '500',
            effective_from: '2026-03-01',
            effective_to: null,
            notes: null,
          },
        ],
        error: null,
      },
    })

    const entries = await getTruckExpenses(supabase, TRUCK_ID, RANGE)
    expect(entries).toHaveLength(4)

    // Descending by occurredAt
    const dates = entries.map((e) => e.occurredAt)
    expect(dates).toEqual(['2026-03-20', '2026-03-12', '2026-03-05', '2026-03-01'])

    const summary = summarizeTruckExpenses(entries)
    expect(summary.fuel).toBe(500) // 100 (trip) + 400 (fuel_entries)
    expect(summary.maintenance).toBe(250)
    expect(summary.insurance).toBe(500)
    expect(summary.total).toBe(1250)
  })
})
