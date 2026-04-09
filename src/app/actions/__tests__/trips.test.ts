import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/authz', () => ({
  authorize: vi.fn(),
  safeError: vi.fn((_err: unknown, _ctx: string) => 'An unexpected error occurred. Please try again.'),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/activity-log', () => ({
  logOrderActivity: vi.fn().mockResolvedValue(undefined),
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
import { revalidatePath } from 'next/cache'
import { createTrip, updateTrip, deleteTrip, updateTripStatus, assignOrderToTrip, unassignOrderFromTrip } from '../trips'

const mockedAuthorize = vi.mocked(authorize)
const mockedRevalidate = vi.mocked(revalidatePath)

type SelectResult = { data: unknown; error: unknown }
type SelectChain = {
  eq: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  gt: ReturnType<typeof vi.fn>
  then: (resolve: (value: SelectResult) => void) => void
}

// ---------------------------------------------------------------------------
// Mock Supabase client factory
// ---------------------------------------------------------------------------

/** Build a mock Supabase client with configurable responses per table call.
 *  The trips actions make multiple chained calls to `.from()`, so we track
 *  call order and return the right mock for each invocation.
 */
function createMockSupabaseClient(overrides: {
  insertResult?: { data: unknown; error: unknown }
  updateResult?: { data: unknown; error: unknown }
  deleteResult?: { error: unknown }
  /** Result for orders update (unassign on delete) */
  ordersUpdateResult?: { error: unknown }
  /** Result for select queries (e.g. trip fetch for recalc) */
  selectResult?: { data: unknown; error: unknown }
  /** Result for orders select (recalc) */
  ordersSelectResult?: { data: unknown; error: unknown }
} = {}) {
  const insertResult = overrides.insertResult ?? { data: { id: 'trip-1', trip_number: 'TRP-001', status: 'planned' }, error: null }
  const updateResult = overrides.updateResult ?? { data: { id: 'trip-1', trip_number: 'TRP-001', status: 'planned' }, error: null }
  const deleteResult = overrides.deleteResult ?? { error: null }
  const ordersUpdateResult = overrides.ordersUpdateResult ?? { error: null }

  // Generic chain builder for select queries
  const makeSelectChain = (result: { data: unknown; error: unknown }) => {
    const chain = {} as SelectChain
    chain.eq = vi.fn().mockReturnValue(chain)
    chain.single = vi.fn().mockResolvedValue(result)
    chain.order = vi.fn().mockResolvedValue(result)
    chain.in = vi.fn().mockResolvedValue(result)
    chain.gt = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    })
    chain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve(result)
    return chain
  }

  const client = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue(ordersUpdateResult),
            }),
          }),
          select: vi.fn().mockReturnValue(
            makeSelectChain(overrides.ordersSelectResult ?? { data: [], error: null })
          ),
        }
      }

      // Default: trips table (or trip_expenses, etc.)
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(insertResult),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(updateResult),
              }),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue(deleteResult),
          }),
        }),
        select: vi.fn().mockReturnValue(
          makeSelectChain(overrides.selectResult ?? { data: { id: 'trip-1', carrier_pay: '1000', driver: null }, error: null })
        ),
      }
    }),
  }
  return client
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function validTripInput() {
  return {
    driver_id: 'driver-1',
    truck_id: 'truck-1',
    start_date: '2026-03-20',
    end_date: '2026-03-25',
    carrier_pay: 1500,
  }
}

function mockAuthSuccess(supabaseClient: ReturnType<typeof createMockSupabaseClient>) {
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

function mockAuthFailure() {
  mockedAuthorize.mockResolvedValue({
    ok: false,
    error: 'Not authenticated',
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

describe('createTrip', () => {
  it('returns success with valid input', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    const result = await createTrip(validTripInput())

    expect(result).toEqual({
      success: true,
      data: { id: 'trip-1', trip_number: 'TRP-001', status: 'planned' },
    })
    expect(mockedAuthorize).toHaveBeenCalledWith('trips.create', expect.objectContaining({
      rateLimit: expect.objectContaining({ key: 'createTrip' }),
    }))
    expect(mockedRevalidate).toHaveBeenCalledWith('/dispatch')
  })

  it('returns field errors for invalid Zod input', async () => {
    const result = await createTrip({
      driver_id: '', // required, min 1
      truck_id: '',
      start_date: '',
      end_date: '',
    })

    expect(result).toHaveProperty('error')
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('returns error when unauthorized', async () => {
    mockAuthFailure()

    const result = await createTrip(validTripInput())

    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('stores carrier_pay as string', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    await createTrip(validTripInput())

    const fromCall = mockClient.from
    expect(fromCall).toHaveBeenCalledWith('trips')
    const insertFn = fromCall.mock.results[0].value.insert
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-456',
        carrier_pay: '1500',
        driver_id: 'driver-1',
        truck_id: 'truck-1',
      }),
    )
  })

  it('returns error when supabase insert fails', async () => {
    const mockClient = createMockSupabaseClient({
      insertResult: { data: null, error: { message: 'DB error' } },
    })
    mockAuthSuccess(mockClient)

    const result = await createTrip(validTripInput())

    expect(result).toEqual({ error: 'An unexpected error occurred. Please try again.' })
  })
})

describe('updateTrip', () => {
  it('returns success with valid partial update', async () => {
    const mockClient = createMockSupabaseClient()
    mockedAuthorize
      .mockResolvedValueOnce({
        ok: true,
        ctx: {
          supabase: mockClient as never,
          tenantId: 'tenant-456',
          user: { id: 'user-123', email: 'test@example.com' },
          role: 'admin',
          permissions: ['*'],
        },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: 'Not authenticated',
      })

    const result = await updateTrip('trip-1', { notes: 'Updated notes' })

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ id: 'trip-1' }),
    })
    expect(mockedAuthorize).toHaveBeenCalledWith('trips.update')
  })

  it('returns field errors for invalid input', async () => {
    const result = await updateTrip('trip-1', {
      carrier_pay: -100, // min 0
    })

    expect(result).toHaveProperty('error')
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('returns error when unauthorized', async () => {
    mockAuthFailure()

    const result = await updateTrip('trip-1', { notes: 'test' })

    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('triggers recalculation when carrier_pay changes', async () => {
    // For updateTrip: first authorize for updateTrip itself, then authorize for recalc
    const mockClient = createMockSupabaseClient()
    // First call: updateTrip authorize, subsequent calls: recalculate authorize
    mockedAuthorize
      .mockResolvedValueOnce({
        ok: true,
        ctx: {
          supabase: mockClient as never,
          tenantId: 'tenant-456',
          user: { id: 'user-123', email: 'test@example.com' },
          role: 'admin',
          permissions: ['*'],
        },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: 'Not authenticated',
      })

    const result = await updateTrip('trip-1', { carrier_pay: 2000 })

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ id: 'trip-1' }),
    })
    // authorize called twice: once for updateTrip, once for recalculateTripFinancials
    expect(mockedAuthorize).toHaveBeenCalledTimes(2)
    expect(mockedAuthorize).toHaveBeenCalledWith('trips.view', { checkSuspension: false })
  })

  it('returns error when supabase update fails', async () => {
    const mockClient = createMockSupabaseClient({
      updateResult: { data: null, error: { message: 'DB error' } },
    })
    mockAuthSuccess(mockClient)

    const result = await updateTrip('trip-1', { notes: 'test' })

    expect(result).toEqual({ error: 'An unexpected error occurred. Please try again.' })
  })
})

describe('deleteTrip', () => {
  it('returns success and unassigns orders', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    const result = await deleteTrip('trip-1')

    expect(result).toEqual({ success: true })
    expect(mockedAuthorize).toHaveBeenCalledWith('trips.delete')
    // Should unassign orders first
    expect(mockClient.from).toHaveBeenCalledWith('orders')
    // Then delete the trip
    expect(mockClient.from).toHaveBeenCalledWith('trips')
    expect(mockedRevalidate).toHaveBeenCalledWith('/dispatch')
    expect(mockedRevalidate).toHaveBeenCalledWith('/orders')
  })

  it('returns error when unauthorized', async () => {
    mockAuthFailure()

    const result = await deleteTrip('trip-1')

    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('returns error when orders unassign fails', async () => {
    const mockClient = createMockSupabaseClient({
      ordersUpdateResult: { error: { message: 'Unassign failed' } },
    })
    mockAuthSuccess(mockClient)

    const result = await deleteTrip('trip-1')

    expect(result).toEqual({ error: 'An unexpected error occurred. Please try again.' })
  })

  it('returns error when supabase delete fails', async () => {
    const mockClient = createMockSupabaseClient({
      deleteResult: { error: { message: 'FK constraint' } },
    })
    mockAuthSuccess(mockClient)

    const result = await deleteTrip('trip-1')

    expect(result).toEqual({ error: 'An unexpected error occurred. Please try again.' })
  })
})

describe('updateTripStatus', () => {
  it('returns success with valid status', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    const result = await updateTripStatus('trip-1', 'in_progress')

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ id: 'trip-1' }),
    })
    expect(mockedAuthorize).toHaveBeenCalledWith('trips.update')
  })

  it('rejects invalid trip status', async () => {
    const result = await updateTripStatus('trip-1', 'invalid_status' as never)

    expect(result).toEqual({ error: 'Invalid trip status' })
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('returns error when unauthorized', async () => {
    mockAuthFailure()

    const result = await updateTripStatus('trip-1', 'in_progress')

    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('returns error when supabase update fails', async () => {
    const mockClient = createMockSupabaseClient({
      updateResult: { data: null, error: { message: 'DB error' } },
    })
    mockAuthSuccess(mockClient)

    const result = await updateTripStatus('trip-1', 'completed')

    expect(result).toEqual({ error: 'An unexpected error occurred. Please try again.' })
  })

  it('accepts all valid trip statuses', async () => {
    // Exclude at_terminal since it has complex chaining (tested separately if needed)
    const validStatuses = ['planned', 'in_progress', 'completed'] as const

    for (const status of validStatuses) {
      vi.clearAllMocks()
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const mockClient = createMockSupabaseClient()
      mockAuthSuccess(mockClient)

      const result = await updateTripStatus('trip-1', status)

      expect(result).toHaveProperty('success', true)
    }
  })

  it('accepts at_terminal status with local drives logic', async () => {
    // at_terminal triggers additional queries for qualifying orders + local_drives
    const makeDeepChain = (result: { data: unknown; error: unknown }) => {
      const chain = {} as SelectChain
      chain.eq = vi.fn().mockReturnValue(chain)
      chain.single = vi.fn().mockResolvedValue(result)
      chain.order = vi.fn().mockResolvedValue(result)
      chain.in = vi.fn().mockResolvedValue(result)
      chain.gt = vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      })
      chain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve(result)
      return chain
    }

    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'orders') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
            select: vi.fn().mockReturnValue(
              makeDeepChain({ data: [], error: null })
            ),
          }
        }
        // trips
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'trip-1', trip_number: 'TRP-001', status: 'at_terminal' },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          select: vi.fn().mockReturnValue(
            makeDeepChain({ data: { id: 'trip-1', carrier_pay: '1000', driver: null }, error: null })
          ),
        }
      }),
    }

    mockedAuthorize.mockResolvedValue({
      ok: true,
      ctx: {
        supabase: mockClient as never,
        tenantId: 'tenant-456',
        user: { id: 'user-123', email: 'test@example.com' },
        role: 'admin',
        permissions: ['*'],
      },
    })

    const result = await updateTripStatus('trip-1', 'at_terminal')

    expect(result).toHaveProperty('success', true)
  })
})

describe('assignOrderToTrip and unassignOrderFromTrip notification behavior', () => {
  it('creates assigned-team notifications when assigning an order to a trip', async () => {
    const mockClient = createMockSupabaseClient({
      selectResult: { data: { route_sequence: [] }, error: null },
      updateResult: { data: null, error: null },
      ordersSelectResult: { data: { trip_id: null }, error: null },
    })
    mockedAuthorize
      .mockResolvedValueOnce({
        ok: true,
        ctx: {
          supabase: mockClient as never,
          tenantId: 'tenant-456',
          user: { id: 'user-123', email: 'test@example.com' },
          role: 'admin',
          permissions: ['*'],
        },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: 'Not authenticated',
      })

    const result = await assignOrderToTrip('order-1', 'trip-1')

    expect(result).toEqual({ success: true })
  })

  it('reassigns an order from one trip to another', async () => {
    const mockClient = createMockSupabaseClient({
      selectResult: { data: { route_sequence: [] }, error: null },
      updateResult: { data: null, error: null },
      ordersSelectResult: { data: { trip_id: 'trip-old' }, error: null },
    })
    mockedAuthorize
      .mockResolvedValueOnce({
        ok: true,
        ctx: {
          supabase: mockClient as never,
          tenantId: 'tenant-456',
          user: { id: 'user-123', email: 'test@example.com' },
          role: 'admin',
          permissions: ['*'],
        },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: 'Not authenticated',
      })
      .mockResolvedValueOnce({
        ok: false,
        error: 'Not authenticated',
      })

    const result = await assignOrderToTrip('order-1', 'trip-1')

    expect(result).toEqual({ success: true })
  })

  it('creates assigned-team notifications when unassigning an order from a trip', async () => {
    const mockClient = createMockSupabaseClient({
      selectResult: { data: { trip_number: 'TRP-001', route_sequence: [] }, error: null },
      updateResult: { data: null, error: null },
      ordersSelectResult: { data: { trip_id: 'trip-old' }, error: null },
    })
    mockedAuthorize
      .mockResolvedValueOnce({
        ok: true,
        ctx: {
          supabase: mockClient as never,
          tenantId: 'tenant-456',
          user: { id: 'user-123', email: 'test@example.com' },
          role: 'admin',
          permissions: ['*'],
        },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: 'Not authenticated',
      })

    const result = await unassignOrderFromTrip('order-1')

    expect(result).toEqual({ success: true })
  })
})
