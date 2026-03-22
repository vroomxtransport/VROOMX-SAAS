import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { authorize, safeError } from '@/lib/authz'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
}))

vi.mock('@/lib/tier', () => ({
  isAccountSuspended: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { isAccountSuspended } from '@/lib/tier'

const mockedCreateClient = vi.mocked(createClient)
const mockedRateLimit = vi.mocked(rateLimit)
const mockedIsAccountSuspended = vi.mocked(isAccountSuspended)

// Helper to build a mock Supabase client with auth.getUser() response
function mockSupabase(userResult: { data: { user: unknown }; error: unknown }, queryResult?: unknown) {
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue(userResult),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(queryResult ?? { data: null, error: null }),
          }),
        }),
      }),
    }),
  }
  mockedCreateClient.mockResolvedValue(client as never)
  return client
}

// Standard authenticated user
const validUser = {
  id: 'user-123',
  email: 'test@example.com',
  app_metadata: {
    tenant_id: 'tenant-456',
    role: 'admin',
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedRateLimit.mockResolvedValue({ allowed: true, remaining: 9 })
  mockedIsAccountSuspended.mockResolvedValue({ suspended: false, gracePeriodEndsAt: null })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('authorize()', () => {
  describe('authentication', () => {
    it('returns error when user not authenticated', async () => {
      mockSupabase({ data: { user: null }, error: null })

      const result = await authorize('orders.create')
      expect(result).toEqual({ ok: false, error: 'Not authenticated' })
    })

    it('returns error on auth error', async () => {
      mockSupabase({ data: { user: null }, error: { message: 'Session expired' } })

      const result = await authorize('orders.create')
      expect(result).toEqual({ ok: false, error: 'Not authenticated' })
    })

    it('returns error when user has no tenant_id', async () => {
      const noTenantUser = { ...validUser, app_metadata: { role: 'admin' } }
      mockSupabase({ data: { user: noTenantUser }, error: null })

      const result = await authorize('orders.create')
      expect(result).toEqual({ ok: false, error: 'No tenant found' })
    })
  })

  describe('permissions - built-in roles', () => {
    it('admin role passes any permission check', async () => {
      mockSupabase({ data: { user: validUser }, error: null })

      const result = await authorize('orders.create')
      expect(result.ok).toBe(true)
    })

    it('dispatcher role passes orders.create', async () => {
      const dispatcherUser = {
        ...validUser,
        app_metadata: { ...validUser.app_metadata, role: 'dispatcher' },
      }
      mockSupabase({ data: { user: dispatcherUser }, error: null })

      const result = await authorize('orders.create')
      expect(result.ok).toBe(true)
    })

    it('dispatcher role fails billing.manage', async () => {
      const dispatcherUser = {
        ...validUser,
        app_metadata: { ...validUser.app_metadata, role: 'dispatcher' },
      }
      mockSupabase({ data: { user: dispatcherUser }, error: null })

      const result = await authorize('billing.manage')
      expect(result).toEqual({ ok: false, error: 'Insufficient permissions' })
    })

    it('wildcard permission (*) passes for any authenticated user', async () => {
      const noRoleUser = {
        ...validUser,
        app_metadata: { ...validUser.app_metadata, role: '' },
      }
      mockSupabase({ data: { user: noRoleUser }, error: null })

      const result = await authorize('*')
      expect(result.ok).toBe(true)
    })
  })

  describe('permissions - custom roles', () => {
    it('fetches permissions from custom_roles table', async () => {
      const customUser = {
        ...validUser,
        app_metadata: { ...validUser.app_metadata, role: 'custom:role-789' },
      }
      mockSupabase(
        { data: { user: customUser }, error: null },
        { data: { permissions: ['orders.view', 'orders.create'] }, error: null }
      )

      const result = await authorize('orders.create')
      expect(result.ok).toBe(true)
    })

    it('returns empty permissions when custom role not found in DB', async () => {
      const customUser = {
        ...validUser,
        app_metadata: { ...validUser.app_metadata, role: 'custom:nonexistent' },
      }
      mockSupabase(
        { data: { user: customUser }, error: null },
        { data: null, error: null }
      )

      const result = await authorize('orders.create')
      expect(result).toEqual({ ok: false, error: 'Insufficient permissions' })
    })
  })

  describe('rate limiting', () => {
    it('returns error when rate limit exceeded', async () => {
      mockSupabase({ data: { user: validUser }, error: null })
      mockedRateLimit.mockResolvedValue({ allowed: false, remaining: 0 })

      const result = await authorize('orders.create', {
        rateLimit: { key: 'createOrder', limit: 30, windowMs: 60_000 },
      })
      expect(result).toEqual({
        ok: false,
        error: 'Too many requests. Please try again shortly.',
      })
    })

    it('passes when rate limit not exceeded', async () => {
      mockSupabase({ data: { user: validUser }, error: null })
      mockedRateLimit.mockResolvedValue({ allowed: true, remaining: 29 })

      const result = await authorize('orders.create', {
        rateLimit: { key: 'createOrder', limit: 30, windowMs: 60_000 },
      })
      expect(result.ok).toBe(true)
      expect(mockedRateLimit).toHaveBeenCalledWith('user-123:createOrder', {
        limit: 30,
        windowMs: 60_000,
      })
    })
  })

  describe('account suspension', () => {
    it('returns error when account is suspended', async () => {
      mockSupabase({ data: { user: validUser }, error: null })
      mockedIsAccountSuspended.mockResolvedValue({ suspended: true, gracePeriodEndsAt: null })

      const result = await authorize('orders.create')
      expect(result).toEqual({
        ok: false,
        error: 'Account suspended. Please update your payment method.',
      })
    })

    it('skips suspension check when checkSuspension: false', async () => {
      mockSupabase({ data: { user: validUser }, error: null })
      mockedIsAccountSuspended.mockResolvedValue({ suspended: true, gracePeriodEndsAt: null })

      const result = await authorize('orders.create', { checkSuspension: false })
      expect(result.ok).toBe(true)
      expect(mockedIsAccountSuspended).not.toHaveBeenCalled()
    })
  })

  describe('successful authorization', () => {
    it('returns full context with supabase, user, tenantId, role, permissions', async () => {
      mockSupabase({ data: { user: validUser }, error: null })

      const result = await authorize('orders.create')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.ctx.user).toEqual({ id: 'user-123', email: 'test@example.com' })
        expect(result.ctx.tenantId).toBe('tenant-456')
        expect(result.ctx.role).toBe('admin')
        expect(result.ctx.permissions).toEqual(['*'])
        expect(result.ctx.supabase).toBeDefined()
      }
    })
  })
})

describe('safeError()', () => {
  it('returns generic error message', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = safeError({ message: 'Sensitive DB error details' }, 'createOrder')
    expect(result).toBe('An unexpected error occurred. Please try again.')
  })

  it('logs the real error server-side', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    safeError({ message: 'DB connection failed' }, 'createOrder')
    expect(consoleSpy).toHaveBeenCalledWith('[createOrder]', 'DB connection failed')
  })
})
