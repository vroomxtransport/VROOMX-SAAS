import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module-level mocks — must be declared before any imports of the module
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation((url: string) => {
    // Next.js redirect() throws a special error to halt execution
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/stripe/config', () => ({
  getPriceMap: vi.fn().mockReturnValue({
    owner_operator: 'price_oo_test',
    starter_x: 'price_starter_test',
    pro_x: 'price_pro_test',
  }),
}))

// Stripe constructor mock — getStripe() calls `new Stripe(...)` directly in auth.ts.
// The mock must be a proper constructor (function, not arrow fn) so that `new Stripe()`
// works. The instance methods are attached to the shared vi.fn() refs declared below
// and exposed via a module-level variable so individual tests can override them.
const mockStripeCustomersCreate = vi.fn().mockResolvedValue({ id: 'cus_test_123' })
const mockStripeCheckoutSessionsCreate = vi.fn().mockResolvedValue({
  url: 'https://checkout.stripe.com/test',
})

vi.mock('stripe', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MockStripe = function (this: any) {
    this.customers = { create: mockStripeCustomersCreate }
    this.checkout = { sessions: { create: mockStripeCheckoutSessionsCreate } }
  }
  return { default: MockStripe }
})

// ---------------------------------------------------------------------------
// Import mocked modules + the actions under test
// ---------------------------------------------------------------------------

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { rateLimit } from '@/lib/rate-limit'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { loginAction, signUpAction, magicLinkAction } from '../auth'

const mockedCreateClient = vi.mocked(createClient)
const mockedCreateServiceRoleClient = vi.mocked(createServiceRoleClient)
const mockedRateLimit = vi.mocked(rateLimit)
const mockedHeaders = vi.mocked(headers)
const mockedRevalidatePath = vi.mocked(revalidatePath)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildFormData(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(data)) fd.append(key, value)
  return fd
}

const VALID_PASSWORD = 'SecurePass1!'

const VALID_SIGNUP_DATA: Record<string, string> = {
  full_name: 'Jane Doe',
  email: 'jane@example.com',
  password: VALID_PASSWORD,
  company_name: 'Acme Hauling',
  plan: 'starter_x',
}

/** Build a complete mock service-role admin client. */
function makeAdminClient(overrides: {
  inviteResult?: { data: unknown; error: unknown }
  rpcResult?: { data: unknown; error: unknown }
  tenantsInsertResult?: { data: unknown; error: unknown }
  membershipsInsertResult?: { error: unknown }
  updateUserResult?: { error: unknown }
  signInResult?: { error: unknown }
} = {}) {
  const invite = overrides.inviteResult ?? {
    data: {
      id: 'invite-1',
      email: 'jane@example.com',
      status: 'pending',
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    },
    error: null,
  }

  const tenantsInsert = overrides.tenantsInsertResult ?? {
    data: { id: 'tenant-1', name: 'Acme Hauling' },
    error: null,
  }

  const membershipsInsert = overrides.membershipsInsertResult ?? { error: null }

  // Build the invites query chain: .from('invites').select(...).eq(...).maybeSingle()
  const maybeSingleFn = vi.fn().mockResolvedValue(invite)
  const eqFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn })
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn })

  // RPC mock
  const rpcFn = vi.fn().mockResolvedValue(
    overrides.rpcResult ?? { data: null, error: null }
  )

  // auth.admin mocks
  const updateUserByIdFn = vi.fn().mockResolvedValue(
    overrides.updateUserResult ?? { error: null }
  )

  // Tenants insert chain: .from('tenants').insert(...).select().single()
  const singleFn = vi.fn().mockResolvedValue(tenantsInsert)
  const tenantsSelectFn = vi.fn().mockReturnValue({ single: singleFn })
  const insertFn = vi.fn().mockReturnValue({ select: tenantsSelectFn })

  // Memberships insert: .from('tenant_memberships').insert(...)
  const membershipsInsertFn = vi.fn().mockResolvedValue(membershipsInsert)

  const adminClient = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'invites') return { select: selectFn }
      if (table === 'tenants') return { insert: insertFn }
      if (table === 'tenant_memberships') return { insert: membershipsInsertFn }
      return { select: selectFn, insert: insertFn }
    }),
    rpc: rpcFn,
    auth: {
      admin: {
        updateUserById: updateUserByIdFn,
      },
    },
  }

  return { adminClient, updateUserByIdFn, rpcFn, maybeSingleFn, eqFn, insertFn, membershipsInsertFn }
}

/** Build a mock Supabase regular client. */
function makeSupabaseClient(overrides: {
  signUpResult?: { data: { user: unknown }; error: unknown }
  signInResult?: { data: unknown; error: unknown }
  signInWithPasswordResult?: { data: unknown; error: unknown }
  otpResult?: { error: unknown }
} = {}) {
  const signUpResult = overrides.signUpResult ?? {
    data: { user: { id: 'user-new-123', email: 'jane@example.com' } },
    error: null,
  }

  const signInResult = overrides.signInWithPasswordResult ?? { data: {}, error: null }
  const otpResult = overrides.otpResult ?? { error: null }

  const client = {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue(signInResult),
      signUp: vi.fn().mockResolvedValue(signUpResult),
      signInWithOtp: vi.fn().mockResolvedValue(otpResult),
    },
  }

  mockedCreateClient.mockResolvedValue(client as never)
  return client
}

/** Set up IP headers mock (used by signUpAction) */
function setupHeaders(ip = '127.0.0.1') {
  const mockHeaderMap = new Map([['x-nf-client-connection-ip', ip]])
  mockedHeaders.mockResolvedValue(mockHeaderMap as unknown as Awaited<ReturnType<typeof headers>>)
}

// ---------------------------------------------------------------------------
// Global beforeEach / afterEach
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  // Default rate limit: allowed
  mockedRateLimit.mockResolvedValue({ allowed: true, remaining: 4 })
  setupHeaders()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ===========================================================================
// loginAction
// ===========================================================================

describe('loginAction', () => {
  it('happy path: login succeeds → calls revalidatePath and redirects to /dashboard', async () => {
    const supabaseClient = makeSupabaseClient({
      signInWithPasswordResult: { data: { user: { id: 'user-1' } }, error: null },
    })

    const fd = buildFormData({ email: 'jane@example.com', password: 'correctpassword' })

    await expect(loginAction(null, fd)).rejects.toThrow('NEXT_REDIRECT:/dashboard')
    expect(supabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'jane@example.com',
      password: 'correctpassword',
    })
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('invalid credentials → returns { error: "Invalid email or password" }', async () => {
    makeSupabaseClient({
      signInWithPasswordResult: {
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      },
    })

    const fd = buildFormData({ email: 'jane@example.com', password: 'wrongpassword' })
    const result = await loginAction(null, fd)

    expect(result).toEqual({ error: 'Invalid email or password' })
  })

  it('with invite_token → redirects to /invite/accept?token=...', async () => {
    makeSupabaseClient({
      signInWithPasswordResult: { data: { user: { id: 'user-1' } }, error: null },
    })

    const fd = buildFormData({
      email: 'jane@example.com',
      password: 'correctpassword',
      invite_token: 'tok_abc123',
    })

    await expect(loginAction(null, fd)).rejects.toThrow(
      'NEXT_REDIRECT:/invite/accept?token=tok_abc123'
    )
    // revalidatePath should have been called before the redirect
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('does NOT call revalidatePath when credentials are invalid', async () => {
    makeSupabaseClient({
      signInWithPasswordResult: {
        data: { user: null },
        error: { message: 'Invalid credentials' },
      },
    })

    const fd = buildFormData({ email: 'x@y.com', password: 'bad' })
    await loginAction(null, fd)
    expect(mockedRevalidatePath).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// signUpAction — validation layer
// ===========================================================================

describe('signUpAction — validation', () => {
  it('rate limit exceeded → returns rate-limit error', async () => {
    mockedRateLimit.mockResolvedValue({ allowed: false, remaining: 0 })

    const fd = buildFormData(VALID_SIGNUP_DATA)
    const result = await signUpAction(null, fd)

    expect(result).toEqual({
      error: 'Too many signup attempts. Please try again in a minute.',
    })
    // Should bail before touching supabase
    expect(mockedCreateClient).not.toHaveBeenCalled()
  })

  it('missing company_name → returns first Zod error', async () => {
    const fd = buildFormData({ ...VALID_SIGNUP_DATA, company_name: '' })
    const result = await signUpAction(null, fd)

    expect(result).toMatchObject({ error: expect.stringContaining('Company name') })
  })

  it('missing full_name → returns Zod error', async () => {
    const fd = buildFormData({ ...VALID_SIGNUP_DATA, full_name: '' })
    const result = await signUpAction(null, fd)

    expect(result).toMatchObject({ error: expect.stringContaining('Full name') })
  })

  it('invalid email → returns Zod error', async () => {
    const fd = buildFormData({ ...VALID_SIGNUP_DATA, email: 'not-an-email' })
    const result = await signUpAction(null, fd)

    expect(result).toMatchObject({ error: expect.stringContaining('email') })
  })

  it('invalid plan value → returns Zod error', async () => {
    const fd = buildFormData({ ...VALID_SIGNUP_DATA, plan: 'enterprise_xx' })
    const result = await signUpAction(null, fd)

    // Zod enum validation fails
    expect(result).toHaveProperty('error')
  })

  // AUTH-004 password policy tests
  it('AUTH-004: password too short (11 chars) → returns min-length error', async () => {
    const fd = buildFormData({ ...VALID_SIGNUP_DATA, password: 'Short1!abcd' }) // 11 chars
    const result = await signUpAction(null, fd)

    expect(result).toMatchObject({ error: expect.stringContaining('12 characters') })
  })

  it('AUTH-004: password missing uppercase → returns uppercase error', async () => {
    const fd = buildFormData({ ...VALID_SIGNUP_DATA, password: 'nouppercase1!' })
    const result = await signUpAction(null, fd)

    expect(result).toMatchObject({ error: expect.stringContaining('uppercase') })
  })

  it('AUTH-004: password missing lowercase → returns lowercase error', async () => {
    const fd = buildFormData({ ...VALID_SIGNUP_DATA, password: 'NOLOWERCASE1!' })
    const result = await signUpAction(null, fd)

    expect(result).toMatchObject({ error: expect.stringContaining('lowercase') })
  })

  it('AUTH-004: password missing digit → returns digit error', async () => {
    const fd = buildFormData({ ...VALID_SIGNUP_DATA, password: 'NoDigitInHere!' })
    const result = await signUpAction(null, fd)

    expect(result).toMatchObject({ error: expect.stringContaining('digit') })
  })

  it('AUTH-004: password missing symbol → returns symbol error', async () => {
    const fd = buildFormData({ ...VALID_SIGNUP_DATA, password: 'NoSymbolInHere1' })
    const result = await signUpAction(null, fd)

    expect(result).toMatchObject({ error: expect.stringContaining('symbol') })
  })

  it('AUTH-004: valid password with all requirements passes validation layer', async () => {
    // Just ensure validation passes — full flow mocked further below
    makeSupabaseClient({
      signUpResult: {
        data: { user: { id: 'user-1', email: 'jane@example.com' } },
        error: { message: 'Signup failed to keep test isolated' },
      },
    })

    const fd = buildFormData({ ...VALID_SIGNUP_DATA, password: 'ValidPass1!xyz' })
    // It proceeds past validation but hits a controlled error from our stub
    const result = await signUpAction(null, fd)
    // If we got a Zod error, password validation would say "12 characters" / "uppercase" etc.
    // Absence of password-policy error means validation passed.
    expect((result as { error: string }).error).not.toMatch(
      /12 characters|uppercase|lowercase|digit|symbol/
    )
  })
})

// ===========================================================================
// signUpAction — normal flow (no invite token)
// ===========================================================================

describe('signUpAction — normal flow', () => {
  it('happy path: creates user → Stripe customer → tenant → membership → app_metadata → checkout → redirects to session.url', async () => {
    const supabaseClient = makeSupabaseClient()
    const { adminClient, updateUserByIdFn, membershipsInsertFn } = makeAdminClient()
    mockedCreateServiceRoleClient.mockReturnValue(adminClient as never)

    const fd = buildFormData(VALID_SIGNUP_DATA)

    await expect(signUpAction(null, fd)).rejects.toThrow(
      'NEXT_REDIRECT:https://checkout.stripe.com/test'
    )

    // Supabase auth.signUp called
    expect(supabaseClient.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'jane@example.com',
        password: VALID_PASSWORD,
        options: { data: { full_name: 'Jane Doe' } },
      })
    )

    // Stripe customer created
    expect(mockStripeCustomersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'jane@example.com',
        name: 'Acme Hauling',
      })
    )

    // Tenant inserted
    expect(adminClient.from).toHaveBeenCalledWith('tenants')

    // Membership inserted
    expect(membershipsInsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-1',
        user_id: 'user-new-123',
        role: 'admin',
        full_name: 'Jane Doe',
        email: 'jane@example.com',
      })
    )

    // app_metadata set
    expect(updateUserByIdFn).toHaveBeenCalledWith(
      'user-new-123',
      expect.objectContaining({
        app_metadata: expect.objectContaining({
          tenant_id: 'tenant-1',
          role: 'admin',
          plan: 'starter_x',
        }),
      })
    )

    // Stripe checkout session created with the correct price ID
    expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_test_123',
        mode: 'subscription',
        line_items: [{ price: 'price_starter_test', quantity: 1 }],
      })
    )
  })

  it('supabase signUp fails → returns auth error message', async () => {
    makeSupabaseClient({
      signUpResult: {
        data: { user: null },
        error: { message: 'Email already registered' },
      },
    })

    const fd = buildFormData(VALID_SIGNUP_DATA)
    const result = await signUpAction(null, fd)

    // N3: signUpAction now returns a generic message to prevent email enumeration
    expect(result).toEqual({ error: 'Signup failed. Please try again or contact support.' })
    expect(mockStripeCustomersCreate).not.toHaveBeenCalled()
  })

  it('tenant creation fails → returns { error: "Failed to create organization" }', async () => {
    makeSupabaseClient()
    const { adminClient } = makeAdminClient({
      tenantsInsertResult: { data: null, error: { message: 'DB error' } },
    })
    mockedCreateServiceRoleClient.mockReturnValue(adminClient as never)

    const fd = buildFormData(VALID_SIGNUP_DATA)
    const result = await signUpAction(null, fd)

    expect(result).toEqual({ error: 'Failed to create organization' })
  })

  it('missing Stripe price ID for plan → returns billing config error', async () => {
    const { getPriceMap } = await import('@/lib/stripe/config')
    vi.mocked(getPriceMap).mockReturnValue({ owner_operator: 'price_oo_test' }) // starter_x missing

    makeSupabaseClient()
    const { adminClient } = makeAdminClient()
    mockedCreateServiceRoleClient.mockReturnValue(adminClient as never)

    const fd = buildFormData(VALID_SIGNUP_DATA) // plan: starter_x
    const result = await signUpAction(null, fd)

    expect(result).toMatchObject({ error: expect.stringContaining('Billing is not configured') })

    // Restore default mock
    vi.mocked(getPriceMap).mockReturnValue({
      owner_operator: 'price_oo_test',
      starter_x: 'price_starter_test',
      pro_x: 'price_pro_test',
    })
  })

  it('checkout session returns null url → returns checkout failure error', async () => {
    mockStripeCheckoutSessionsCreate.mockResolvedValue({ url: null })

    makeSupabaseClient()
    const { adminClient } = makeAdminClient()
    mockedCreateServiceRoleClient.mockReturnValue(adminClient as never)

    const fd = buildFormData(VALID_SIGNUP_DATA)
    const result = await signUpAction(null, fd)

    expect(result).toEqual({ error: 'Failed to create checkout session' })
  })

  it('IP extracted from x-nf-client-connection-ip header for rate limiting', async () => {
    const customIp = '203.0.113.55'
    const mockHeaderMap = new Map([['x-nf-client-connection-ip', customIp]])
    mockedHeaders.mockResolvedValue(
      mockHeaderMap as unknown as Awaited<ReturnType<typeof headers>>
    )

    makeSupabaseClient()
    const { adminClient } = makeAdminClient()
    mockedCreateServiceRoleClient.mockReturnValue(adminClient as never)

    const fd = buildFormData(VALID_SIGNUP_DATA)
    await signUpAction(null, fd).catch(() => {/* redirect throws */})

    expect(mockedRateLimit).toHaveBeenCalledWith(
      `signup-ip:${customIp}`,
      expect.objectContaining({ limit: 5, windowMs: 60_000 })
    )
  })

  it('falls back to x-forwarded-for when x-nf-client-connection-ip absent', async () => {
    const mockHeaderMap = new Map([['x-forwarded-for', '10.0.0.1, 10.0.0.2']])
    mockedHeaders.mockResolvedValue(
      mockHeaderMap as unknown as Awaited<ReturnType<typeof headers>>
    )

    makeSupabaseClient()
    const { adminClient } = makeAdminClient()
    mockedCreateServiceRoleClient.mockReturnValue(adminClient as never)

    const fd = buildFormData(VALID_SIGNUP_DATA)
    await signUpAction(null, fd).catch(() => {/* redirect throws */})

    expect(mockedRateLimit).toHaveBeenCalledWith(
      'signup-ip:10.0.0.1',
      expect.any(Object)
    )
  })
})

// ===========================================================================
// signUpAction — invite flow (AUTH-001 regression tests)
// ===========================================================================

describe('signUpAction — invite flow (AUTH-001)', () => {
  const INVITE_SIGNUP_DATA: Record<string, string> = {
    ...VALID_SIGNUP_DATA,
    invite_token: 'tok_valid_invite',
  }

  it('invalid invite token (not found in DB) → returns { error: "Invalid invite link" }', async () => {
    makeSupabaseClient()
    const { adminClient } = makeAdminClient({
      inviteResult: { data: null, error: null },
    })
    mockedCreateServiceRoleClient.mockReturnValue(adminClient as never)

    const fd = buildFormData(INVITE_SIGNUP_DATA)
    const result = await signUpAction(null, fd)

    expect(result).toEqual({ error: 'Invalid invite link' })
  })

  it('DB error on invite lookup → returns { error: "Invalid invite link" }', async () => {
    makeSupabaseClient()
    const { adminClient } = makeAdminClient({
      inviteResult: { data: null, error: { message: 'DB error' } },
    })
    mockedCreateServiceRoleClient.mockReturnValue(adminClient as never)

    const fd = buildFormData(INVITE_SIGNUP_DATA)
    const result = await signUpAction(null, fd)

    expect(result).toEqual({ error: 'Invalid invite link' })
  })

  it('already-used invite (status !== "pending") → returns used/revoked error', async () => {
    makeSupabaseClient()
    const { adminClient } = makeAdminClient({
      inviteResult: {
        data: {
          id: 'invite-1',
          email: 'jane@example.com',
          status: 'accepted',
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        },
        error: null,
      },
    })
    mockedCreateServiceRoleClient.mockReturnValue(adminClient as never)

    const fd = buildFormData(INVITE_SIGNUP_DATA)
    const result = await signUpAction(null, fd)

    expect(result).toMatchObject({
      error: expect.stringMatching(/already been used|revoked/i),
    })
  })

  it('revoked invite (status "revoked") → returns used/revoked error', async () => {
    makeSupabaseClient()
    const { adminClient } = makeAdminClient({
      inviteResult: {
        data: {
          id: 'invite-1',
          email: 'jane@example.com',
          status: 'revoked',
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        },
        error: null,
      },
    })
    mockedCreateServiceRoleClient.mockReturnValue(adminClient as never)

    const fd = buildFormData(INVITE_SIGNUP_DATA)
    const result = await signUpAction(null, fd)

    expect(result).toMatchObject({
      error: expect.stringMatching(/already been used|revoked/i),
    })
  })

  it('expired invite → returns { error: "...expired..." }', async () => {
    makeSupabaseClient()
    const { adminClient } = makeAdminClient({
      inviteResult: {
        data: {
          id: 'invite-1',
          email: 'jane@example.com',
          status: 'pending',
          expires_at: new Date(Date.now() - 86_400_000).toISOString(), // in the past
        },
        error: null,
      },
    })
    mockedCreateServiceRoleClient.mockReturnValue(adminClient as never)

    const fd = buildFormData(INVITE_SIGNUP_DATA)
    const result = await signUpAction(null, fd)

    expect(result).toMatchObject({ error: expect.stringContaining('expired') })
  })

  it('email mismatch (token belongs to different email) → returns generic "Invalid invite link"', async () => {
    makeSupabaseClient()
    const { adminClient } = makeAdminClient({
      inviteResult: {
        data: {
          id: 'invite-1',
          email: 'someone_else@example.com', // different from form email
          status: 'pending',
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        },
        error: null,
      },
    })
    mockedCreateServiceRoleClient.mockReturnValue(adminClient as never)

    const fd = buildFormData(INVITE_SIGNUP_DATA)
    const result = await signUpAction(null, fd)

    // Must return GENERIC error — must NOT reveal the real invited email
    expect(result).toEqual({ error: 'Invalid invite link' })
    // The real email must not appear in the error
    expect((result as { error: string }).error).not.toContain('someone_else@example.com')
  })

  it('AUTH-001 regression: no service-role auth writes before invite token is validated', async () => {
    makeSupabaseClient()
    const { adminClient, updateUserByIdFn } = makeAdminClient({
      inviteResult: { data: null, error: null }, // invalid token
    })
    mockedCreateServiceRoleClient.mockReturnValue(adminClient as never)

    const fd = buildFormData(INVITE_SIGNUP_DATA)
    await signUpAction(null, fd)

    // Critical: updateUserById must NOT have been called when token is invalid
    expect(updateUserByIdFn).not.toHaveBeenCalled()
  })

  it('pre-invited user (existing auth user) → calls updateUserById with password + email_confirm', async () => {
    const existingUserId = 'user-preinvited-456'

    makeSupabaseClient({
      signInWithPasswordResult: { data: {}, error: null },
    })
    const { adminClient, updateUserByIdFn } = makeAdminClient({
      rpcResult: { data: existingUserId, error: null },
    })
    mockedCreateServiceRoleClient.mockReturnValue(adminClient as never)

    const fd = buildFormData(INVITE_SIGNUP_DATA)

    await expect(signUpAction(null, fd)).rejects.toThrow(
      'NEXT_REDIRECT:/invite/accept?token=tok_valid_invite'
    )

    // AUTH-001 regression: must call updateUserById with the pre-existing user's ID
    expect(updateUserByIdFn).toHaveBeenCalledWith(
      existingUserId,
      expect.objectContaining({
        password: VALID_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: 'Jane Doe' },
      })
    )
  })

  it('new user (no pre-existing auth user) → confirms email only, no password update', async () => {
    const newUserId = 'user-new-123' // matches signUp mock default

    makeSupabaseClient({
      signInWithPasswordResult: { data: {}, error: null },
    })
    // RPC returns null → no pre-existing user
    const { adminClient, updateUserByIdFn } = makeAdminClient({
      rpcResult: { data: null, error: null },
    })
    mockedCreateServiceRoleClient.mockReturnValue(adminClient as never)

    const fd = buildFormData(INVITE_SIGNUP_DATA)

    await expect(signUpAction(null, fd)).rejects.toThrow(
      'NEXT_REDIRECT:/invite/accept?token=tok_valid_invite'
    )

    // For non-pre-invited users, only email_confirm is set (no password reset)
    expect(updateUserByIdFn).toHaveBeenCalledWith(
      newUserId,
      expect.objectContaining({
        email_confirm: true,
        app_metadata: { pending_invite: true },
      })
    )
    // password must NOT be in the call args for a new user
    const callArgs = updateUserByIdFn.mock.calls[0][1] as Record<string, unknown>
    expect(callArgs).not.toHaveProperty('password')
  })

  it('invite flow: sign-in after signup fails → returns sign-in error', async () => {
    makeSupabaseClient({
      signInWithPasswordResult: {
        data: {},
        error: { message: 'Sign in error' },
      },
    })
    const { adminClient } = makeAdminClient({
      rpcResult: { data: null, error: null },
    })
    mockedCreateServiceRoleClient.mockReturnValue(adminClient as never)

    const fd = buildFormData(INVITE_SIGNUP_DATA)
    const result = await signUpAction(null, fd)

    expect(result).toEqual({
      error: 'Account created but sign-in failed. Please try logging in.',
    })
  })

  it('invite flow: redirects to /invite/accept?token=... on success', async () => {
    makeSupabaseClient({
      signInWithPasswordResult: { data: {}, error: null },
    })
    const { adminClient } = makeAdminClient()
    mockedCreateServiceRoleClient.mockReturnValue(adminClient as never)

    const fd = buildFormData({ ...INVITE_SIGNUP_DATA, invite_token: 'tok_special' })

    await expect(signUpAction(null, fd)).rejects.toThrow(
      'NEXT_REDIRECT:/invite/accept?token=tok_special'
    )
  })

  it('invite flow: Stripe and tenant creation are SKIPPED', async () => {
    makeSupabaseClient({
      signInWithPasswordResult: { data: {}, error: null },
    })
    const { adminClient } = makeAdminClient()
    mockedCreateServiceRoleClient.mockReturnValue(adminClient as never)

    const fd = buildFormData(INVITE_SIGNUP_DATA)
    await signUpAction(null, fd).catch(() => {/* redirect throws */})

    // Stripe must not be called in invite path
    expect(mockStripeCustomersCreate).not.toHaveBeenCalled()
    expect(mockStripeCheckoutSessionsCreate).not.toHaveBeenCalled()
    // Tenant must not be created
    const tenantInsertCalls = adminClient.from.mock.calls.filter(
      (args: unknown[]) => args[0] === 'tenants'
    )
    expect(tenantInsertCalls).toHaveLength(0)
  })

  it('case-insensitive email matching for invite validation', async () => {
    makeSupabaseClient()
    const { adminClient } = makeAdminClient({
      inviteResult: {
        data: {
          id: 'invite-1',
          email: 'JANE@EXAMPLE.COM', // uppercase in DB
          status: 'pending',
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        },
        error: null,
      },
    })
    mockedCreateServiceRoleClient.mockReturnValue(adminClient as never)

    // signup with lowercase email
    makeSupabaseClient({
      signInWithPasswordResult: { data: {}, error: null },
    })
    mockedCreateServiceRoleClient.mockReturnValue(adminClient as never)

    const fd = buildFormData({ ...INVITE_SIGNUP_DATA, email: 'jane@example.com' })
    // Should succeed (not return email mismatch error)
    await expect(signUpAction(null, fd)).rejects.toThrow('NEXT_REDIRECT:/invite/accept')
  })
})

// ===========================================================================
// magicLinkAction
// ===========================================================================

describe('magicLinkAction', () => {
  it('empty email → returns { error: "Please enter a valid email address" }', async () => {
    const fd = buildFormData({ email: '' })
    const result = await magicLinkAction(null, fd)

    expect(result).toEqual({ error: 'Please enter a valid email address' })
    expect(mockedCreateClient).not.toHaveBeenCalled()
  })

  it('email without @ → returns validation error', async () => {
    const fd = buildFormData({ email: 'notanemail' })
    const result = await magicLinkAction(null, fd)

    expect(result).toEqual({ error: 'Please enter a valid email address' })
  })

  it('happy path → returns { success: true, message: "..." }', async () => {
    makeSupabaseClient({ otpResult: { error: null } })

    const fd = buildFormData({ email: 'jane@example.com' })
    const result = await magicLinkAction(null, fd)

    expect(result).toMatchObject({ success: true, message: expect.stringContaining('email') })
  })

  it('happy path: calls signInWithOtp with shouldCreateUser: false', async () => {
    const supabaseClient = makeSupabaseClient({ otpResult: { error: null } })

    const fd = buildFormData({ email: 'jane@example.com' })
    await magicLinkAction(null, fd)

    expect(supabaseClient.auth.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'jane@example.com',
        options: expect.objectContaining({ shouldCreateUser: false }),
      })
    )
  })

  it('no account found (Signups not allowed error) → returns "sign up first" error', async () => {
    makeSupabaseClient({
      otpResult: { error: { message: 'Signups not allowed for otp' } },
    })

    const fd = buildFormData({ email: 'newuser@example.com' })
    const result = await magicLinkAction(null, fd)

    expect(result).toMatchObject({ error: expect.stringContaining('sign up first') })
  })

  it('generic OTP error → returns the error message directly', async () => {
    makeSupabaseClient({
      otpResult: { error: { message: 'Rate limit exceeded' } },
    })

    const fd = buildFormData({ email: 'jane@example.com' })
    const result = await magicLinkAction(null, fd)

    expect(result).toEqual({ error: 'Rate limit exceeded' })
  })
})
