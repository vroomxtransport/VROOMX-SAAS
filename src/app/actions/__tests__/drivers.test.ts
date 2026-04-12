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

vi.mock('@/lib/tier', () => ({
  checkTierLimit: vi.fn(),
}))

vi.mock('@/lib/resend/client', () => ({
  getResend: vi.fn(),
}))

vi.mock('@/lib/audit-context', () => ({
  getAuditContext: vi.fn().mockResolvedValue({ ipAddress: 'test-ip', userAgent: 'test-agent' }),
}))

import { authorize } from '@/lib/authz'
import { revalidatePath } from 'next/cache'
import { checkTierLimit } from '@/lib/tier'
import { createDriver, updateDriver, deleteDriver } from '../drivers'

const mockedAuthorize = vi.mocked(authorize)
const mockedRevalidate = vi.mocked(revalidatePath)
const mockedCheckTierLimit = vi.mocked(checkTierLimit)

// ---------------------------------------------------------------------------
// Mock Supabase client factory
// ---------------------------------------------------------------------------

function createMockSupabaseClient(overrides: {
  insertResult?: { data: unknown; error: unknown }
  updateResult?: { data: unknown; error: unknown }
  deleteResult?: { error: unknown }
} = {}) {
  const insertResult = overrides.insertResult ?? { data: { id: '00000000-0000-4000-a000-000000000001', first_name: 'John', last_name: 'Doe' }, error: null }
  const updateResult = overrides.updateResult ?? { data: { id: '00000000-0000-4000-a000-000000000001', first_name: 'John', last_name: 'Doe' }, error: null }
  const deleteResult = overrides.deleteResult ?? { error: null }

  const snapshotRow = { data: { id: '00000000-0000-4000-a000-000000000001', first_name: 'John', last_name: 'Doe', email: 'john@example.com', phone: null, tenant_id: 'tenant-456' }, error: null }

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
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(snapshotRow),
          }),
        }),
      }),
    }),
  }
  return client
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function validDriverInput() {
  return {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '555-0100',
    driverType: 'company' as const,
    driverStatus: 'active' as const,
    payType: 'percentage_of_carrier_pay' as const,
    payRate: 25,
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
  // Default: tier limit not reached
  mockedCheckTierLimit.mockResolvedValue({ allowed: true, current: 2, limit: 10, plan: 'pro_x' })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createDriver', () => {
  it('returns success with valid input', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    const result = await createDriver(validDriverInput())

    expect(result).toEqual({
      success: true,
      data: { id: '00000000-0000-4000-a000-000000000001', first_name: 'John', last_name: 'Doe' },
    })
    expect(mockedAuthorize).toHaveBeenCalledWith('drivers.create', expect.objectContaining({
      rateLimit: expect.objectContaining({ key: 'createDriver' }),
    }))
    expect(mockedRevalidate).toHaveBeenCalledWith('/drivers')
  })

  it('returns field errors for invalid Zod input', async () => {
    const result = await createDriver({
      firstName: '', // required, min 1
      lastName: '',
    })

    expect(result).toHaveProperty('error')
    // Zod runs before authorize
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('returns error when unauthorized', async () => {
    mockAuthFailure()

    const result = await createDriver(validDriverInput())

    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('returns error when tier limit is reached', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)
    mockedCheckTierLimit.mockResolvedValue({ allowed: false, current: 3, limit: 3, plan: 'starter_x' })

    const result = await createDriver(validDriverInput())

    expect(result).toEqual({
      error: 'Team member limit reached (3/3). Upgrade your plan to add more team members.',
    })
  })

  it('returns suspension error when limit is 0', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)
    mockedCheckTierLimit.mockResolvedValue({ allowed: false, current: 0, limit: 0, plan: 'owner_operator' })

    const result = await createDriver(validDriverInput())

    expect(result).toEqual({
      error: 'Your account is suspended. Please update your payment method.',
    })
  })

  it('stores pay_rate as string', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    await createDriver(validDriverInput())

    const fromCall = mockClient.from
    expect(fromCall).toHaveBeenCalledWith('drivers')
    const insertFn = fromCall.mock.results[0].value.insert
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-456',
        pay_rate: '25',
        first_name: 'John',
        last_name: 'Doe',
      }),
    )
  })

  it('returns error when supabase insert fails', async () => {
    const mockClient = createMockSupabaseClient({
      insertResult: { data: null, error: { message: 'Unique constraint' } },
    })
    mockAuthSuccess(mockClient)

    const result = await createDriver(validDriverInput())

    expect(result).toEqual({ error: 'An unexpected error occurred. Please try again.' })
  })
})

describe('updateDriver', () => {
  it('returns success with valid update', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    const result = await updateDriver('00000000-0000-4000-a000-000000000001', validDriverInput())

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ id: '00000000-0000-4000-a000-000000000001' }),
    })
    expect(mockedAuthorize).toHaveBeenCalledWith('drivers.update', expect.objectContaining({
      rateLimit: expect.objectContaining({ key: 'updateDriver' }),
    }))
  })

  it('returns field errors for invalid input', async () => {
    const result = await updateDriver('00000000-0000-4000-a000-000000000001', {
      firstName: '', // required
      lastName: 'Doe',
    })

    expect(result).toHaveProperty('error')
    expect(mockedAuthorize).not.toHaveBeenCalled()
  })

  it('returns error when unauthorized', async () => {
    mockAuthFailure()

    const result = await updateDriver('00000000-0000-4000-a000-000000000001', validDriverInput())

    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('returns error when supabase update fails', async () => {
    const mockClient = createMockSupabaseClient({
      updateResult: { data: null, error: { message: 'Not found' } },
    })
    mockAuthSuccess(mockClient)

    const result = await updateDriver('00000000-0000-4000-a000-000000000001', validDriverInput())

    expect(result).toEqual({ error: 'An unexpected error occurred. Please try again.' })
  })
})

describe('deleteDriver', () => {
  it('returns success on successful deletion', async () => {
    const mockClient = createMockSupabaseClient()
    mockAuthSuccess(mockClient)

    const result = await deleteDriver('00000000-0000-4000-a000-000000000001')

    expect(result).toEqual({ success: true })
    expect(mockedAuthorize).toHaveBeenCalledWith('drivers.delete', expect.objectContaining({
      rateLimit: expect.objectContaining({ key: 'deleteDriver' }),
    }))
    expect(mockedRevalidate).toHaveBeenCalledWith('/drivers')
  })

  it('returns error when unauthorized', async () => {
    mockAuthFailure()

    const result = await deleteDriver('00000000-0000-4000-a000-000000000001')

    expect(result).toEqual({ error: 'Not authenticated' })
  })

  it('returns error when supabase delete fails', async () => {
    const mockClient = createMockSupabaseClient({
      deleteResult: { error: { message: 'FK constraint violation' } },
    })
    mockAuthSuccess(mockClient)

    const result = await deleteDriver('00000000-0000-4000-a000-000000000001')

    expect(result).toEqual({ error: 'An unexpected error occurred. Please try again.' })
  })
})
