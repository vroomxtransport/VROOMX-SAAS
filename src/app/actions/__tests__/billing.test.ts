import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module-level mocks — declared before any import of the module under test
// ---------------------------------------------------------------------------

vi.mock('@/lib/authz', () => ({
  authorize: vi.fn(),
  safeError: vi.fn((_err: unknown, _ctx: string) => 'An unexpected error occurred. Please try again.'),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation((url: string) => {
    // Next.js redirect() throws a special error to halt execution.
    // The real Next.js error has a `digest` property starting with
    // 'NEXT_REDIRECT'. We replicate that here so billing.ts's guard
    // (`error.digest.startsWith('NEXT_REDIRECT')`) re-throws correctly.
    const err = new Error(`NEXT_REDIRECT:${url}`) as Error & { digest: string }
    err.digest = `NEXT_REDIRECT:${url}`
    throw err
  }),
}))

vi.mock('@/lib/stripe/billing-portal', () => ({
  createPortalSession: vi.fn(),
}))

vi.mock('@/lib/stripe/config', () => ({
  getStripeClient: vi.fn(),
  getPriceMap: vi.fn().mockReturnValue({
    owner_operator: 'price_oo',
    starter_x: 'price_sx',
    pro_x: 'price_px',
  }),
}))

// ---------------------------------------------------------------------------
// Imports (after vi.mock declarations)
// ---------------------------------------------------------------------------

import { authorize } from '@/lib/authz'
import { createPortalSession } from '@/lib/stripe/billing-portal'
import { getStripeClient, getPriceMap } from '@/lib/stripe/config'
import { createBillingPortalSession, createCheckoutSession } from '../billing'

const mockedAuthorize = vi.mocked(authorize)
const mockedCreatePortalSession = vi.mocked(createPortalSession)
const mockedGetStripeClient = vi.mocked(getStripeClient)
const mockedGetPriceMap = vi.mocked(getPriceMap)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a minimal mock Supabase client whose `.from('tenants')` chain
 *  resolves to the provided `tenantRow`. */
function createMockSupabaseClient(tenantRow: { stripe_customer_id: string | null } | null = { stripe_customer_id: 'cus_test_123' }) {
  const singleFn = vi.fn().mockResolvedValue({ data: tenantRow, error: null })
  const eqFn = vi.fn().mockReturnValue({ single: singleFn })
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn })

  return {
    from: vi.fn().mockReturnValue({ select: selectFn }),
  }
}

/** Convenience: wire authorize() to succeed with the given supabase mock client. */
function mockAuthSuccess(mockClient: unknown) {
  mockedAuthorize.mockResolvedValue({
    ok: true,
    ctx: {
      supabase: mockClient as never,
      tenantId: 'tenant-1',
      user: { id: 'user-1', email: 'test@example.com' },
      role: 'admin',
      permissions: ['*'],
    },
  })
}

/** Convenience: wire authorize() to fail. */
function mockAuthFailure(message = 'Not authenticated') {
  mockedAuthorize.mockResolvedValue({
    ok: false,
    error: message,
  })
}

/** Build a mock Stripe checkout sessions object and wire getStripeClient(). */
function createMockStripeCheckoutSessions(sessionUrl: string | null = 'https://checkout.stripe.com/test') {
  const createFn = vi.fn().mockResolvedValue({ url: sessionUrl })
  mockedGetStripeClient.mockReturnValue({
    checkout: { sessions: { create: createFn } },
  } as never)
  return createFn
}

// ---------------------------------------------------------------------------
// Global lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})

  // Restore default getPriceMap after tests that override it
  mockedGetPriceMap.mockReturnValue({
    owner_operator: 'price_oo',
    starter_x: 'price_sx',
    pro_x: 'price_px',
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ===========================================================================
// createBillingPortalSession
// ===========================================================================

describe('createBillingPortalSession', () => {
  it('auth denied → returns { error }', async () => {
    mockAuthFailure('Not authenticated')

    const result = await createBillingPortalSession()

    expect(result).toEqual({ error: 'Not authenticated' })
    expect(mockedAuthorize).toHaveBeenCalledWith('billing.manage', { checkSuspension: false })
    expect(mockedCreatePortalSession).not.toHaveBeenCalled()
  })

  it('no stripe_customer_id on tenant → returns { error: "No billing account found..." }', async () => {
    const mockClient = createMockSupabaseClient({ stripe_customer_id: null })
    mockAuthSuccess(mockClient)

    const result = await createBillingPortalSession()

    expect(result).toEqual({ error: 'No billing account found. Please contact support.' })
    expect(mockedCreatePortalSession).not.toHaveBeenCalled()
  })

  it('tenant row is null → returns { error: "No billing account found..." }', async () => {
    const mockClient = createMockSupabaseClient(null)
    mockAuthSuccess(mockClient)

    const result = await createBillingPortalSession()

    expect(result).toEqual({ error: 'No billing account found. Please contact support.' })
  })

  it('happy path → calls createPortalSession with correct args and redirects', async () => {
    const mockClient = createMockSupabaseClient({ stripe_customer_id: 'cus_abc' })
    mockAuthSuccess(mockClient)
    mockedCreatePortalSession.mockResolvedValue('https://billing.stripe.com/portal/session_1')

    await expect(createBillingPortalSession()).rejects.toThrow(
      'NEXT_REDIRECT:https://billing.stripe.com/portal/session_1'
    )

    expect(mockedCreatePortalSession).toHaveBeenCalledWith(
      'cus_abc',
      expect.stringContaining('/settings')
    )
  })

  it('createPortalSession throws non-redirect error → returns { error: "Failed to open billing portal..." }', async () => {
    const mockClient = createMockSupabaseClient({ stripe_customer_id: 'cus_abc' })
    mockAuthSuccess(mockClient)
    mockedCreatePortalSession.mockRejectedValue(new Error('Stripe connection refused'))

    const result = await createBillingPortalSession()

    expect(result).toEqual({ error: 'Failed to open billing portal. Please try again.' })
  })

  it('queries tenants table with correct tenant_id filter', async () => {
    const mockClient = createMockSupabaseClient({ stripe_customer_id: 'cus_abc' })
    mockAuthSuccess(mockClient)
    mockedCreatePortalSession.mockResolvedValue('https://billing.stripe.com/portal/x')

    await createBillingPortalSession().catch(() => {/* redirect throws — expected */})

    expect(mockClient.from).toHaveBeenCalledWith('tenants')
    const selectFn = mockClient.from.mock.results[0].value.select
    expect(selectFn).toHaveBeenCalledWith('stripe_customer_id')
  })
})

// ===========================================================================
// createCheckoutSession
// ===========================================================================

describe('createCheckoutSession', () => {
  it('invalid plan (not in enum) → returns { error: "Invalid plan selected." } without calling authorize', async () => {
    // Cast needed to test runtime behaviour when TS types are bypassed (server action RPC call)
    const result = await createCheckoutSession('enterprise_xx' as never)

    expect(result).toEqual({ error: 'Invalid plan selected.' })
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('auth denied → returns { error }', async () => {
    mockAuthFailure('Unauthorized')
    createMockStripeCheckoutSessions()

    const result = await createCheckoutSession('starter_x')

    expect(result).toEqual({ error: 'Unauthorized' })
    expect(mockedGetStripeClient).not.toHaveBeenCalled()
  })

  it('auth called with billing.manage, checkSuspension:false, and rateLimit', async () => {
    mockAuthFailure() // bail early — we only care about what authorize was called with

    await createCheckoutSession('pro_x')

    expect(mockedAuthorize).toHaveBeenCalledWith(
      'billing.manage',
      expect.objectContaining({
        checkSuspension: false,
        rateLimit: expect.objectContaining({
          key: 'createCheckoutSession',
          limit: expect.any(Number),
          windowMs: expect.any(Number),
        }),
      })
    )
  })

  it('missing priceId in price map → returns { error: "Invalid plan selected." }', async () => {
    // Simulate an unconfigured env var resulting in undefined price
    mockedGetPriceMap.mockReturnValue({ owner_operator: 'price_oo' }) // starter_x and pro_x missing
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)
    createMockStripeCheckoutSessions()

    const result = await createCheckoutSession('starter_x')

    expect(result).toEqual({ error: 'Invalid plan selected.' })
    expect(mockedGetStripeClient).not.toHaveBeenCalled()
  })

  it('happy path → creates session with correct metadata (tenant_id, user_id) and trial_period_days, then redirects', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)
    const createFn = createMockStripeCheckoutSessions('https://checkout.stripe.com/pay/cs_test_1')

    await expect(createCheckoutSession('starter_x')).rejects.toThrow(
      'NEXT_REDIRECT:https://checkout.stripe.com/pay/cs_test_1'
    )

    expect(createFn).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        line_items: [{ price: 'price_sx', quantity: 1 }],
        metadata: {
          tenant_id: 'tenant-1',
          user_id: 'user-1',
        },
        subscription_data: expect.objectContaining({
          trial_period_days: 14,
        }),
      })
    )
  })

  it('happy path uses correct price IDs for each plan', async () => {
    for (const [plan, expectedPriceId] of [
      ['owner_operator', 'price_oo'],
      ['starter_x', 'price_sx'],
      ['pro_x', 'price_px'],
    ] as const) {
      vi.clearAllMocks()
      vi.spyOn(console, 'error').mockImplementation(() => {})
      mockedGetPriceMap.mockReturnValue({ owner_operator: 'price_oo', starter_x: 'price_sx', pro_x: 'price_px' })

      const mockClient = createMockSupabaseClient()
      mockAuthSuccess(mockClient)
      const createFn = createMockStripeCheckoutSessions(`https://checkout.stripe.com/${plan}`)

      await createCheckoutSession(plan).catch(() => {/* redirect throws */})

      expect(createFn).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: expectedPriceId, quantity: 1 }],
        })
      )
    }
  })

  it('session.url is null → returns { error: "Failed to create checkout session." }', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)
    createMockStripeCheckoutSessions(null)

    const result = await createCheckoutSession('pro_x')

    expect(result).toEqual({ error: 'Failed to create checkout session.' })
  })

  it('Stripe throws → returns { error: "Failed to start checkout..." }', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    const createFn = vi.fn().mockRejectedValue(new Error('Stripe API error'))
    mockedGetStripeClient.mockReturnValue({
      checkout: { sessions: { create: createFn } },
    } as never)

    const result = await createCheckoutSession('owner_operator')

    expect(result).toEqual({ error: 'Failed to start checkout. Please try again.' })
  })

  it('passes customer_email from authorized user to checkout session', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)
    const createFn = createMockStripeCheckoutSessions('https://checkout.stripe.com/x')

    await createCheckoutSession('pro_x').catch(() => {/* redirect */})

    expect(createFn).toHaveBeenCalledWith(
      expect.objectContaining({ customer_email: 'test@example.com' })
    )
  })
})
