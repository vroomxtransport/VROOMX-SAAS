/**
 * Dedicated test file for recalculateTripFinancials CAS retry behavior.
 *
 * These tests live in a separate file (not trips.test.ts) because trips.test.ts
 * contains pre-existing tests that fail with "headers was called outside a
 * request scope" — those tests invoke server actions whose deep call chains
 * hit Next.js's request-scoped `headers()` API without a mocked request
 * context. Running our CAS tests in the same file causes those broken tests'
 * pending unhandled rejections to contaminate the fake-timer queue we rely on
 * for the retry-exhaustion test. Isolating into a separate file gives us a
 * clean vi.mock hoisting scope and zero cross-test interference.
 *
 * See CodeAuditX audit plan §5 item 3 and
 * src/app/actions/trips.ts::recalculateTripFinancials for the fix this
 * suite verifies.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module-level mocks — MUST be declared before importing the SUT so vi.mock
// hoisting works.
// ---------------------------------------------------------------------------

vi.mock('@/lib/authz', () => ({
  authorize: vi.fn(),
  safeError: vi.fn((_err: unknown, _ctx: string) => 'An unexpected error occurred. Please try again.'),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/financial/trip-calculations', () => ({
  calculateTripFinancials: vi.fn().mockReturnValue({
    revenue: 3000,
    brokerFees: 200,
    localFees: 0,
    driverPay: 750,
    expenses: 100,
    netProfit: 1950,
    totalMiles: 500,
  }),
}))

import { authorize } from '@/lib/authz'
import { recalculateTripFinancials } from '../trips'

const mockedAuthorize = vi.mocked(authorize)

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

/**
 * Build a mock Supabase client tailored for recalculateTripFinancials.
 * The function's access pattern is:
 *   1. SELECT trip (id, version, carrier_pay, driver) .eq(id).eq(tenant).single()
 *   2. SELECT orders .eq(trip_id).eq(tenant_id).order(created_at)
 *   3. SELECT trip_expenses .eq(trip_id).eq(tenant_id)
 *   4. SELECT local_drives .eq(trip_id).eq(tenant_id)
 *   5. UPDATE trips .eq(id).eq(tenant_id).eq(version, old).select('id')
 *      → returns [] on CAS conflict, [{id}] on success
 *
 * The `updateResponses` queue lets us simulate conflict-then-success,
 * all-conflict (exhaustion), and happy-path in one factory.
 */
function createRecalcMock(options: {
  tripRow?: { id: string; version: number; carrier_pay: string; driver: unknown }
  updateResponses?: Array<{ data: { id: string }[]; error: unknown }>
} = {}) {
  const tripRow = options.tripRow ?? {
    id: 'trip-1',
    version: 0,
    carrier_pay: '1000',
    driver: null,
  }
  const updateResponses = options.updateResponses ?? [
    { data: [{ id: 'trip-1' }], error: null },
  ]
  let updateCallIndex = 0
  // Captures every (col, val) arg passed to .eq() on the UPDATE chain
  // across all retry attempts, so tests can verify the CAS predicate
  // uses the version read from the trip row.
  const updateEqCalls: Array<[string, unknown]> = []

  const client = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'trips') {
        // Build a fresh update chain per .from('trips') call.
        //   update()   → {eq}          (level 0)
        //   .eq(id)    → {eq}          (level 1)
        //   .eq(tid)   → {eq}          (level 2)
        //   .eq(ver)   → {select}      (level 3, terminal)
        //   .select()  → Promise<resp>
        const makeEqChain = (level: number): unknown => {
          if (level >= 3) {
            return {
              select: vi.fn().mockImplementation(() => {
                const resp =
                  updateResponses[updateCallIndex] ??
                  updateResponses[updateResponses.length - 1]
                updateCallIndex++
                return Promise.resolve(resp)
              }),
            }
          }
          return {
            eq: vi.fn().mockImplementation((col: string, val: unknown) => {
              updateEqCalls.push([col, val])
              return makeEqChain(level + 1)
            }),
          }
        }
        return {
          // Read path: .select(...).eq(id).eq(tenant_id).single()
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: tripRow, error: null }),
              }),
            }),
          }),
          // Write path: .update(...).eq(id).eq(tenant_id).eq(version).select('id')
          update: vi.fn().mockImplementation(() => makeEqChain(0)),
        }
      }
      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }
      }
      // trip_expenses and local_drives both use .select().eq().eq() (no .single)
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }
    }),
  }
  return {
    client,
    getUpdateCallCount: () => updateCallIndex,
    getUpdateEqCalls: () => updateEqCalls,
  }
}

function mockAuthSuccess(supabaseClient: ReturnType<typeof createRecalcMock>['client']) {
  mockedAuthorize.mockResolvedValue({
    ok: true,
    ctx: {
      supabase: supabaseClient as never,
      tenantId: 'tenant-456',
      user: { id: 'user-123', email: 'test@example.com' },
      role: 'admin',
      permissions: ['*'],
    },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('recalculateTripFinancials (CAS retry)', () => {
  it('succeeds on first attempt when no CAS conflict', async () => {
    const { client, getUpdateCallCount } = createRecalcMock({
      updateResponses: [{ data: [{ id: 'trip-1' }], error: null }],
    })
    mockAuthSuccess(client)

    const result = await recalculateTripFinancials('trip-1')

    expect(result).toEqual({ success: true })
    expect(getUpdateCallCount()).toBe(1)
  })

  it('retries and succeeds when first CAS attempt returns 0 rows', async () => {
    vi.useFakeTimers()
    try {
      const { client, getUpdateCallCount } = createRecalcMock({
        updateResponses: [
          { data: [], error: null }, // conflict
          { data: [{ id: 'trip-1' }], error: null }, // retry succeeds
        ],
      })
      mockAuthSuccess(client)

      const promise = recalculateTripFinancials('trip-1')
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toEqual({ success: true })
      // One conflict + one success = 2 update calls
      expect(getUpdateCallCount()).toBe(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns error when CAS conflicts persist beyond max retries', async () => {
    vi.useFakeTimers()
    try {
      const { client, getUpdateCallCount } = createRecalcMock({
        // Every attempt returns 0 rows → persistent conflict
        updateResponses: [{ data: [], error: null }],
      })
      mockAuthSuccess(client)

      const promise = recalculateTripFinancials('trip-1')
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toHaveProperty('error')
      // Bounded retries: the implementation caps at MAX_RETRIES (5)
      expect(getUpdateCallCount()).toBe(5)
    } finally {
      vi.useRealTimers()
    }
  })

  it('passes CAS with the version read from the trip row', async () => {
    const { client, getUpdateEqCalls } = createRecalcMock({
      tripRow: { id: 'trip-1', version: 7, carrier_pay: '1000', driver: null },
      updateResponses: [{ data: [{ id: 'trip-1' }], error: null }],
    })
    mockAuthSuccess(client)

    await recalculateTripFinancials('trip-1')

    // The UPDATE chain is .update(...).eq(id).eq(tenant_id).eq(version).
    // All three .eq calls are recorded in insertion order by the mock.
    const eqCalls = getUpdateEqCalls()
    expect(eqCalls).toHaveLength(3)
    expect(eqCalls[0][0]).toBe('id')
    expect(eqCalls[1][0]).toBe('tenant_id')
    // The third .eq is the CAS predicate — must match the version read
    // from the trip row so concurrent writers are detected.
    expect(eqCalls[2]).toEqual(['version', 7])
  })
})
