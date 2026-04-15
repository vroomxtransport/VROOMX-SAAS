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

vi.mock('@/lib/quickbooks/sync', () => ({
  syncPaymentToQB: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/webhooks/webhook-dispatcher', () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/webhooks/payload-sanitizer', () => ({
  sanitizePayload: vi.fn((p: unknown) => p),
}))

vi.mock('@/lib/async-safe', () => ({
  captureAsyncError: vi.fn(() => () => {}),
}))

import { authorize } from '@/lib/authz'
import { revalidatePath } from 'next/cache'
import { recordPayment, batchMarkPaid, recordCodPayment } from '../payments'

const mockedAuthorize = vi.mocked(authorize)
const mockedRevalidate = vi.mocked(revalidatePath)

// ---------------------------------------------------------------------------
// Mock Supabase client factory
// ---------------------------------------------------------------------------

function createMockSupabaseClient(overrides: {
  selectResult?: { data: unknown; error: unknown }
  insertResult?: { data: unknown; error: unknown }
  updateResult?: { data: unknown; error: unknown }
} = {}) {
  const selectResult = overrides.selectResult ?? {
    data: {
      order_number: 'ORD-001',
      carrier_pay: '2000',
      amount_paid: '0',
      payment_status: 'unpaid',
      payment_type: 'COP',
      billing_amount: null,
      cod_amount: null,
    },
    error: null,
  }

  const insertResult = overrides.insertResult ?? {
    data: { id: 'payment-1', amount: '500', order_id: 'order-1' },
    error: null,
  }

  const updateResult = overrides.updateResult ?? { data: null, error: null }

  // Build nested chains for the Supabase fluent API
  const client = {
    from: vi.fn().mockImplementation(() => ({
      // select chain: .select(...).eq(...).eq(...).single()
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(selectResult),
          }),
        }),
      }),
      // insert chain: .insert({}).select().single()
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(insertResult),
        }),
        // Some inserts don't chain .select()
        then: (resolve: (value: { error: unknown }) => void) =>
          resolve({ error: insertResult.error }),
      }),
      // update chain: .update({}).eq(...).eq(...)
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(updateResult),
        }),
      }),
      // delete chain (unused in payments but safe to include)
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    })),
  }
  return client
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validPaymentInput() {
  return {
    amount: 500,
    paymentDate: '2026-04-10',
    notes: 'Check payment',
  }
}

function mockAuthSuccess(supabaseClient: ReturnType<typeof createMockSupabaseClient>) {
  mockedAuthorize.mockResolvedValue({
    ok: true,
    ctx: {
      supabase: supabaseClient as never,
      tenantId: 'tenant-1',
      user: { id: 'user-1', email: 'test@example.com' },
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

// ===========================================================================
// recordPayment
// ===========================================================================

describe('recordPayment', () => {
  it('returns field errors for invalid Zod input (missing amount)', async () => {
    const result = await recordPayment('order-1', {
      paymentDate: '2026-04-10',
      // amount missing
    })

    expect(result).toHaveProperty('error')
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('returns field errors when amount is negative', async () => {
    const result = await recordPayment('order-1', {
      amount: -100,
      paymentDate: '2026-04-10',
    })

    expect(result).toHaveProperty('error')
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('returns field errors when amount is zero', async () => {
    const result = await recordPayment('order-1', {
      amount: 0,
      paymentDate: '2026-04-10',
    })

    expect(result).toHaveProperty('error')
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('returns field errors when paymentDate is empty', async () => {
    const result = await recordPayment('order-1', {
      amount: 500,
      paymentDate: '',
    })

    expect(result).toHaveProperty('error')
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('returns error when unauthorized', async () => {
    mockAuthFailure()

    const result = await recordPayment('order-1', validPaymentInput())

    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('calls authorize with payments.create permission and rate limit', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    await recordPayment('order-1', validPaymentInput())

    expect(mockedAuthorize).toHaveBeenCalledWith('payments.create', expect.objectContaining({
      rateLimit: expect.objectContaining({ key: 'recordPayment' }),
    }))
  })

  it('returns success with valid input', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    const result = await recordPayment('order-1', validPaymentInput())

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ id: 'payment-1' }),
    })
  })

  it('stores payment amount as String()', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    await recordPayment('order-1', validPaymentInput())

    // The second .from() call is for payments insert
    // First call: orders select, Second call: payments insert, Third call: orders update
    const fromCalls = mockClient.from.mock.results
    // Verify insert was called with stringified amount
    const paymentsFromResult = fromCalls[1].value
    expect(paymentsFromResult.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-1',
        amount: '500',
        order_id: 'order-1',
        payment_date: '2026-04-10',
      }),
    )
  })

  it('updates payment_status to partially_paid when not fully paid', async () => {
    const mockClient = createMockSupabaseClient({
      selectResult: {
        data: {
          order_number: 'ORD-001',
          carrier_pay: '2000',
          amount_paid: '0',
          payment_status: 'unpaid',
          payment_type: 'COP',
          billing_amount: null,
          cod_amount: null,
        },
        error: null,
      },
    })
    mockAuthSuccess(mockClient)

    await recordPayment('order-1', { amount: 500, paymentDate: '2026-04-10' })

    // The update call should set payment_status to partially_paid
    const updateFromResult = mockClient.from.mock.results[2].value
    expect(updateFromResult.update).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_status: 'partially_paid',
      }),
    )
  })

  it('updates payment_status to paid when fully paid', async () => {
    const mockClient = createMockSupabaseClient({
      selectResult: {
        data: {
          order_number: 'ORD-001',
          carrier_pay: '2000',
          amount_paid: '1500',
          payment_status: 'partially_paid',
          payment_type: 'COP',
          billing_amount: null,
          cod_amount: null,
        },
        error: null,
      },
    })
    mockAuthSuccess(mockClient)

    await recordPayment('order-1', { amount: 500, paymentDate: '2026-04-10' })

    const updateFromResult = mockClient.from.mock.results[2].value
    expect(updateFromResult.update).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_status: 'paid',
        amount_paid: '2000.00',
      }),
    )
  })

  it('returns error when payment exceeds remaining balance', async () => {
    const mockClient = createMockSupabaseClient({
      selectResult: {
        data: {
          order_number: 'ORD-001',
          carrier_pay: '2000',
          amount_paid: '1800',
          payment_status: 'partially_paid',
          payment_type: 'COP',
          billing_amount: null,
          cod_amount: null,
        },
        error: null,
      },
    })
    mockAuthSuccess(mockClient)

    const result = await recordPayment('order-1', { amount: 300, paymentDate: '2026-04-10' })

    expect(result).toEqual({ error: 'Payment amount exceeds remaining balance' })
  })

  it('returns error when order not found', async () => {
    const mockClient = createMockSupabaseClient({
      selectResult: { data: null, error: { message: 'not found' } },
    })
    mockAuthSuccess(mockClient)

    const result = await recordPayment('order-999', validPaymentInput())

    expect(result).toHaveProperty('error')
  })

  it('returns error when payment insert fails', async () => {
    const mockClient = createMockSupabaseClient({
      insertResult: { data: null, error: { message: 'DB insert failed' } },
    })
    mockAuthSuccess(mockClient)

    const result = await recordPayment('order-1', validPaymentInput())

    expect(result).toEqual({ error: 'An unexpected error occurred. Please try again.' })
  })

  it('revalidates order detail and billing paths on success', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    await recordPayment('order-1', validPaymentInput())

    expect(mockedRevalidate).toHaveBeenCalledWith('/orders/order-1')
    expect(mockedRevalidate).toHaveBeenCalledWith('/billing')
  })

  it('filters by tenant_id when fetching order', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    await recordPayment('order-1', validPaymentInput())

    // First from('orders') call is the select to fetch order data
    expect(mockClient.from).toHaveBeenCalledWith('orders')
    // The chain should include .eq('tenant_id', 'tenant-1')
    const selectChain = mockClient.from.mock.results[0].value.select.mock.results[0].value
    expect(selectChain.eq).toHaveBeenCalledWith('id', 'order-1')
    const innerChain = selectChain.eq.mock.results[0].value
    expect(innerChain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1')
  })
})

// ===========================================================================
// batchMarkPaid
// ===========================================================================

describe('batchMarkPaid', () => {
  it('returns error when no orders provided', async () => {
    const result = await batchMarkPaid([], '2026-04-10')

    expect(result).toEqual({ error: 'No orders selected' })
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('returns error when payment date is empty', async () => {
    const result = await batchMarkPaid(['order-1'], '')

    expect(result).toEqual({ error: 'Payment date is required' })
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('returns error when unauthorized', async () => {
    mockAuthFailure()

    const result = await batchMarkPaid(['order-1'], '2026-04-10')

    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('calls authorize with payments.create and batchMarkPaid rate limit', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    await batchMarkPaid(['order-1'], '2026-04-10')

    expect(mockedAuthorize).toHaveBeenCalledWith('payments.create', expect.objectContaining({
      rateLimit: expect.objectContaining({ key: 'batchMarkPaid', limit: 5 }),
    }))
  })

  it('returns success with processed count', async () => {
    const mockClient = createMockSupabaseClient({
      selectResult: {
        data: { carrier_pay: '2000', amount_paid: '0' },
        error: null,
      },
    })
    mockAuthSuccess(mockClient)

    const result = await batchMarkPaid(['order-1'], '2026-04-10')

    expect(result).toEqual(expect.objectContaining({
      success: true,
      processed: 1,
      total: 1,
    }))
  })

  it('revalidates billing and orders paths', async () => {
    const mockClient = createMockSupabaseClient({
      selectResult: {
        data: { carrier_pay: '1000', amount_paid: '0' },
        error: null,
      },
    })
    mockAuthSuccess(mockClient)

    await batchMarkPaid(['order-1'], '2026-04-10')

    expect(mockedRevalidate).toHaveBeenCalledWith('/billing')
    expect(mockedRevalidate).toHaveBeenCalledWith('/orders')
  })
})

// ===========================================================================
// recordCodPayment
// ===========================================================================

describe('recordCodPayment', () => {
  it('returns error when unauthorized', async () => {
    mockAuthFailure()

    const result = await recordCodPayment('order-1')

    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('returns error when order is not SPLIT type', async () => {
    const mockClient = createMockSupabaseClient({
      selectResult: {
        data: {
          carrier_pay: '2000',
          amount_paid: '0',
          payment_status: 'unpaid',
          payment_type: 'COP',
          cod_amount: null,
          billing_amount: null,
        },
        error: null,
      },
    })
    mockAuthSuccess(mockClient)

    const result = await recordCodPayment('order-1')

    expect(result).toEqual({ error: 'This order is not a SPLIT payment type or has no COD amount' })
  })

  it('returns error when COD already collected', async () => {
    const mockClient = createMockSupabaseClient({
      selectResult: {
        data: {
          carrier_pay: '2000',
          amount_paid: '500',
          payment_status: 'partially_paid',
          payment_type: 'SPLIT',
          cod_amount: '500',
          billing_amount: '1500',
        },
        error: null,
      },
    })
    mockAuthSuccess(mockClient)

    const result = await recordCodPayment('order-1')

    expect(result).toEqual({ error: 'COD amount has already been collected' })
  })

  it('returns success for valid SPLIT order with uncollected COD', async () => {
    const mockClient = createMockSupabaseClient({
      selectResult: {
        data: {
          carrier_pay: '2000',
          amount_paid: '0',
          payment_status: 'unpaid',
          payment_type: 'SPLIT',
          cod_amount: '500',
          billing_amount: '1500',
        },
        error: null,
      },
    })
    mockAuthSuccess(mockClient)

    const result = await recordCodPayment('order-1')

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ id: 'payment-1' }),
    })
  })

  it('revalidates order detail and billing paths on success', async () => {
    const mockClient = createMockSupabaseClient({
      selectResult: {
        data: {
          carrier_pay: '2000',
          amount_paid: '0',
          payment_status: 'unpaid',
          payment_type: 'SPLIT',
          cod_amount: '500',
          billing_amount: '1500',
        },
        error: null,
      },
    })
    mockAuthSuccess(mockClient)

    await recordCodPayment('order-1')

    expect(mockedRevalidate).toHaveBeenCalledWith('/orders/order-1')
    expect(mockedRevalidate).toHaveBeenCalledWith('/billing')
  })

  it('returns error when order not found', async () => {
    const mockClient = createMockSupabaseClient({
      selectResult: { data: null, error: { message: 'not found' } },
    })
    mockAuthSuccess(mockClient)

    const result = await recordCodPayment('order-1')

    expect(result).toHaveProperty('error')
  })
})
