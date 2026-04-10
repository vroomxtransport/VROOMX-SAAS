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

vi.mock('@/lib/geocoding-helpers', () => ({
  geocodeAndSaveOrder: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/activity-log', () => ({
  logOrderActivity: vi.fn().mockResolvedValue(undefined),
}))

import { authorize } from '@/lib/authz'
import { revalidatePath } from 'next/cache'
import { createOrder, updateOrder, deleteOrder, updateOrderStatus } from '../orders'

const mockedAuthorize = vi.mocked(authorize)
const mockedRevalidate = vi.mocked(revalidatePath)

type SelectResult = { data: unknown; error: unknown }
type SelectChain = {
  eq: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  then: (resolve: (value: SelectResult) => void) => void
}

// ---------------------------------------------------------------------------
// Mock Supabase client factory
// ---------------------------------------------------------------------------

function createMockSupabaseClient(overrides: {
  insertResult?: { data: unknown; error: unknown }
  updateResult?: { data: unknown; error: unknown }
  deleteResult?: { error: unknown }
  selectResult?: { data: unknown; error: unknown }
} = {}) {
  const insertResult = overrides.insertResult ?? { data: { id: 'order-1', order_number: 'ORD-001' }, error: null }
  const updateResult = overrides.updateResult ?? { data: { id: 'order-1', order_number: 'ORD-001', status: 'new' }, error: null }
  const deleteResult = overrides.deleteResult ?? { error: null }
  // Default select() returns a full-shaped order row so that refetch
  // calls after createOrder/updateOrder (added by the auto-computed
  // driver-pay refactor) resolve to an object with id + financial
  // fields, not just { status: 'new' }.
  const selectResult = overrides.selectResult ?? {
    data: {
      id: 'order-1',
      order_number: 'ORD-001',
      status: 'new',
      driver_id: null,
      revenue: '1500',
      broker_fee: '100',
      local_fee: '0',
      carrier_pay: '0',
      distance_miles: null,
      driver_pay_rate_override: null,
      vehicles: [{ year: 2024, make: 'Honda', model: 'Civic' }],
    },
    error: null,
  }
  const makeSelectChain = (result: { data: unknown; error: unknown }) => {
    const chain = {} as SelectChain
    chain.eq = vi.fn().mockReturnValue(chain)
    chain.single = vi.fn().mockResolvedValue(result)
    chain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve(result)
    return chain
  }

  const client = {
    from: vi.fn().mockReturnValue({
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
      select: vi.fn().mockReturnValue(makeSelectChain(selectResult)),
    }),
  }
  return client
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function validOrderInput() {
  return {
    vehicles: [
      { vin: '1HGBH41JXMN109186', year: 2024, make: 'Honda', model: 'Civic' },
    ],
    pickupLocation: '123 Main St',
    pickupCity: 'Miami',
    pickupState: 'FL',
    deliveryLocation: '456 Oak Ave',
    deliveryCity: 'Atlanta',
    deliveryState: 'GA',
    revenue: 1500,
    brokerFee: 100,
    localFee: 0,
    paymentType: 'COP' as const,
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

describe('createOrder', () => {
  it('returns success with valid input', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    const result = await createOrder(validOrderInput())

    // createOrder now returns the full refreshed row (after geocoding +
    // driver-pay recompute), not the raw insert result.
    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ id: 'order-1', order_number: 'ORD-001' }),
    })
    expect(mockedAuthorize).toHaveBeenCalledWith('orders.create', expect.objectContaining({
      rateLimit: expect.objectContaining({ key: 'createOrder' }),
    }))
    expect(mockedRevalidate).toHaveBeenCalledWith('/orders')
  })

  it('returns field errors for invalid Zod input', async () => {
    const result = await createOrder({
      // Missing required fields
      vehicles: [],
      pickupCity: '',
      deliveryCity: '',
    })

    expect(result).toHaveProperty('error')
    // Zod validation runs before authorize(), so authorize should not be called
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('returns error when unauthorized', async () => {
    mockAuthFailure()

    const result = await createOrder(validOrderInput())

    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('returns error when supabase insert fails', async () => {
    const mockClient = createMockSupabaseClient({
      insertResult: { data: null, error: { message: 'DB insert failed' } },
    })
    mockAuthSuccess(mockClient)

    const result = await createOrder(validOrderInput())

    expect(result).toEqual({ error: 'An unexpected error occurred. Please try again.' })
  })

  it('stores financial fields as strings', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    await createOrder(validOrderInput())

    // Verify .from('orders').insert() was called with stringified financials.
    // carrier_pay is initialized to '0' and overwritten later by the
    // applyComputedDriverPay post-insert step — it is no longer a form input.
    const fromCall = mockClient.from
    expect(fromCall).toHaveBeenCalledWith('orders')
    const insertFn = fromCall.mock.results[0].value.insert
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-456',
        revenue: '1500',
        carrier_pay: '0',
        broker_fee: '100',
        local_fee: '0',
      }),
    )
  })
})

describe('updateOrder', () => {
  it('returns success with valid partial update', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    const result = await updateOrder('order-1', { revenue: 2000 })

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ id: 'order-1' }),
    })
    // updateOrder now passes a rate limit config to authorize().
    expect(mockedAuthorize).toHaveBeenCalledWith('orders.update', expect.objectContaining({
      rateLimit: expect.objectContaining({ key: 'updateOrder' }),
    }))
  })

  it('returns field errors for invalid input', async () => {
    const result = await updateOrder('order-1', {
      revenue: -500, // negative not allowed
    })

    expect(result).toHaveProperty('error')
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('returns error when unauthorized', async () => {
    mockAuthFailure()

    const result = await updateOrder('order-1', { revenue: 2000 })

    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('updates financial fields correctly', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    // carrierPay is no longer accepted by the form schema — it's
    // recomputed server-side from the driver config after update.
    await updateOrder('order-1', {
      revenue: 3000,
      brokerFee: 200,
      localFee: 50,
    })

    const fromCall = mockClient.from
    expect(fromCall).toHaveBeenCalledWith('orders')
    const updateFn = fromCall.mock.results[0].value.update
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        revenue: '3000',
        broker_fee: '200',
        local_fee: '50',
      }),
    )
  })

  it('returns error when supabase update fails', async () => {
    const mockClient = createMockSupabaseClient({
      updateResult: { data: null, error: { message: 'DB update failed' } },
    })
    mockAuthSuccess(mockClient)

    const result = await updateOrder('order-1', { revenue: 2000 })

    expect(result).toEqual({ error: 'An unexpected error occurred. Please try again.' })
  })
})

describe('deleteOrder', () => {
  it('returns success on successful deletion', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    const result = await deleteOrder('order-1')

    expect(result).toEqual({ success: true })
    expect(mockedAuthorize).toHaveBeenCalledWith('orders.delete')
    expect(mockedRevalidate).toHaveBeenCalledWith('/orders')
  })

  it('returns error when unauthorized', async () => {
    mockAuthFailure()

    const result = await deleteOrder('order-1')

    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('returns error when supabase delete fails', async () => {
    const mockClient = createMockSupabaseClient({
      deleteResult: { error: { message: 'FK constraint' } },
    })
    mockAuthSuccess(mockClient)

    const result = await deleteOrder('order-1')

    expect(result).toEqual({ error: 'An unexpected error occurred. Please try again.' })
  })
})

describe('updateOrderStatus', () => {
  it('returns success with valid status transition', async () => {
    const mockClient = createMockSupabaseClient({
      selectResult: { data: { status: 'new' }, error: null },
      updateResult: { data: { id: 'order-1', order_number: 'ORD-001', status: 'assigned' }, error: null },
    })
    mockAuthSuccess(mockClient)

    const result = await updateOrderStatus('order-1', 'assigned')

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ status: 'assigned' }),
    })
  })

  it('rejects invalid status', async () => {
    const result = await updateOrderStatus('order-1', 'invalid_status')

    expect(result).toEqual({ error: 'Invalid status: invalid_status' })
    // Should reject before calling authorize
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('requires reason when cancelling', async () => {
    const result = await updateOrderStatus('order-1', 'cancelled')

    expect(result).toEqual({ error: 'A reason is required when cancelling an order' })
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('allows cancellation with reason', async () => {
    const mockClient = createMockSupabaseClient({
      selectResult: { data: { status: 'assigned' }, error: null },
      updateResult: { data: { id: 'order-1', order_number: 'ORD-001', status: 'cancelled' }, error: null },
    })
    mockAuthSuccess(mockClient)

    const result = await updateOrderStatus('order-1', 'cancelled', 'Customer requested cancellation')

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ status: 'cancelled' }),
    })
  })

  it('returns error when unauthorized', async () => {
    mockAuthFailure()

    const result = await updateOrderStatus('order-1', 'assigned')

    expect(result).toEqual({ error: 'Not authenticated' })
  })
})
