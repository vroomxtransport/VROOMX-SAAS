/**
 * Regression test for Samsara ilike sanitization (commit e1dde3a, C-1).
 *
 * Bug: syncDrivers() called .ilike('first_name', driverName) with names sourced
 * directly from the Samsara API without sanitizing. A malicious Samsara operator
 * can set driver names to arbitrary strings including PostgREST filter
 * metacharacters (%, ,, ., ;, :, ', ", \) to widen the .ilike() query beyond
 * its intended scope — potentially matching drivers from other tenants if the
 * tenant_id filter were ever relaxed.
 *
 * Fix: sanitizeSearch() is applied to both firstName and lastName before the
 * .ilike() calls.
 *
 * What this test guards:
 *   1. sanitizeSearch is called with the first name part before .ilike('first_name')
 *   2. sanitizeSearch is called with the last name part before .ilike('last_name')
 *   3. When sanitization reduces a name to empty, the driver is NOT auto-mapped
 *      (no .ilike() call issued) — prevents a match-all query
 *   4. When both parts sanitize to non-empty, the driver IS auto-mapped with
 *      the sanitized values passed to .ilike()
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module-level mocks — must be declared before any import of the module
// ---------------------------------------------------------------------------

vi.mock('@/lib/sanitize-search', () => ({
  sanitizeSearch: vi.fn((s: string) => s), // identity by default; overridden per test
}))

vi.mock('@/lib/authz', () => ({
  authorize: vi.fn(),
  safeError: vi.fn((_err: unknown, _ctx: string) => 'An unexpected error occurred. Please try again.'),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/audit-log', () => ({
  logAuditEvent: vi.fn().mockReturnValue(Promise.resolve()),
}))

vi.mock('@/lib/oauth-nonce', () => ({
  issueNonce: vi.fn().mockResolvedValue('nonce-abc'),
}))

vi.mock('@/lib/samsara/oauth', () => ({
  getSamsaraAuthUrl: vi.fn().mockResolvedValue('https://samsara.com/auth'),
  refreshAccessToken: vi.fn().mockResolvedValue({
    access_token: 'new-token',
    refresh_token: 'new-refresh',
    expires_in: 3600,
  }),
}))

// SamsaraClient mock.
//
// The constructor must be a real `function` (not arrow) because the production
// code calls `new SamsaraClient(token, callback)`. We attach a module-level
// `mockGetDrivers` vi.fn() to each instance so individual tests can control
// the driver list via `mockGetDrivers.mockResolvedValue(...)`.
const mockGetDrivers = vi.fn().mockResolvedValue([])

vi.mock('@/lib/samsara/client', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function MockSamsaraClient(this: any) {
    this.getDrivers = mockGetDrivers
  }
  return {
    SamsaraClient: MockSamsaraClient,
    SamsaraApiError: class SamsaraApiError extends Error {},
  }
})

// ---------------------------------------------------------------------------
// Deferred imports
// ---------------------------------------------------------------------------

import { authorize } from '@/lib/authz'
import { sanitizeSearch } from '@/lib/sanitize-search'
import { syncDrivers } from '../samsara'

const mockedAuthorize = vi.mocked(authorize)
const mockedSanitizeSearch = vi.mocked(sanitizeSearch)

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-regression-test'
const USER_ID = 'user-regression-test'
const INTEGRATION_ID = 'intg-regression-test'

// ---------------------------------------------------------------------------
// Supabase mock factory
//
// The syncDrivers function issues these queries:
//  1. samsara_integrations: .select(…).eq('tenant_id',…).single()    [getClientForTenant]
//  2. samsara_drivers: .upsert(…).select('id,driver_id').single()     [per driver]
//  3. drivers: .select('id').eq('tenant_id',…).ilike(first).ilike(last).single()
//  4. samsara_drivers: .update({driver_id}).eq(id).eq(tenant_id)      [if matched]
//  5. samsara_integrations: .update({last_sync_at,…})                 [final]
// ---------------------------------------------------------------------------

interface IlikeSpy {
  calls: Array<[string, string]> // [column, value]
}

function createMockSupabaseClient(opts: {
  upsertedDriverId?: string | null
  matchedVroomxDriverId?: string | null
  ilikes?: IlikeSpy
} = {}) {
  const {
    upsertedDriverId = null,
    matchedVroomxDriverId = null,
    ilikes = { calls: [] },
  } = opts

  // .ilike() is chainable and both calls share this same chain object.
  // The chain captures column+value pairs into ilikes.calls for assertions.
  const ilikeChain: {
    ilike: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
  } = {
    ilike: vi.fn(),
    single: vi.fn().mockResolvedValue(
      matchedVroomxDriverId
        ? { data: { id: matchedVroomxDriverId }, error: null }
        : { data: null, error: { code: 'PGRST116', message: 'No rows' } }
    ),
  }
  // Each .ilike() call records args and returns the same chain (for chaining)
  ilikeChain.ilike.mockImplementation((col: string, val: string) => {
    ilikes.calls.push([col, val])
    return ilikeChain
  })

  return {
    _ilikes: ilikes,
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'samsara_integrations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: INTEGRATION_ID,
                  access_token_encrypted: 'token-xyz',
                  refresh_token_encrypted: 'refresh-xyz',
                  token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
                  sync_status: 'active',
                },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }
      }

      if (table === 'samsara_drivers') {
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'samsara-row-1', driver_id: upsertedDriverId },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }
      }

      if (table === 'drivers') {
        // Actual chain: .select('id').eq('tenant_id', …).ilike(…).ilike(…).single()
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(ilikeChain),
          }),
        }
      }

      // Catch-all: other tables that just receive fire-and-forget updates
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      }
    }),
  }
}

function makeAuthSuccess(supabaseClient: ReturnType<typeof createMockSupabaseClient>) {
  mockedAuthorize.mockResolvedValue({
    ok: true,
    ctx: {
      supabase: supabaseClient as never,
      tenantId: TENANT_ID,
      user: { id: USER_ID, email: 'test@vroomx.dev' },
      role: 'admin',
      permissions: ['*'],
    },
  } as never)
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  // Default: sanitizeSearch is identity; tests override per-scenario
  mockedSanitizeSearch.mockImplementation((s: string) => s)
  // Default: no drivers from Samsara
  mockGetDrivers.mockResolvedValue([])
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncDrivers — C-1 sanitization regression', () => {
  it('calls sanitizeSearch on firstName and lastName before .ilike()', async () => {
    const ilikes: IlikeSpy = { calls: [] }
    const mockClient = createMockSupabaseClient({ ilikes })
    makeAuthSuccess(mockClient)

    mockGetDrivers.mockResolvedValue([
      {
        id: 'samsara-driver-1',
        name: 'Alice Johnson',
        email: 'alice@example.com',
        driverActivationStatus: 'active',
      },
    ])

    await syncDrivers()

    // sanitizeSearch must have been called with the split name parts
    expect(mockedSanitizeSearch).toHaveBeenCalledWith('Alice')
    expect(mockedSanitizeSearch).toHaveBeenCalledWith('Johnson')
  })

  it('passes the sanitizeSearch return value (not the raw name) to .ilike()', async () => {
    const ilikes: IlikeSpy = { calls: [] }
    const mockClient = createMockSupabaseClient({ ilikes })
    makeAuthSuccess(mockClient)

    // Override: sanitize strips % from both parts
    mockedSanitizeSearch.mockImplementation((s: string) => s.replace(/%/g, ''))

    mockGetDrivers.mockResolvedValue([
      {
        id: 'samsara-driver-2',
        name: 'Bo%b Smi%th',
        email: null,
        driverActivationStatus: 'active',
      },
    ])

    await syncDrivers()

    const firstNameCall = ilikes.calls.find(([col]) => col === 'first_name')
    const lastNameCall = ilikes.calls.find(([col]) => col === 'last_name')

    expect(firstNameCall).toBeDefined()
    expect(lastNameCall).toBeDefined()
    // Raw name was 'Bo%b' — after sanitization must be 'Bob'
    expect(firstNameCall?.[1]).toBe('Bob')
    // Raw name was 'Smi%th' — after sanitization must be 'Smith'
    expect(lastNameCall?.[1]).toBe('Smith')
  })

  it('skips .ilike() entirely when firstName sanitizes to empty string', async () => {
    const ilikes: IlikeSpy = { calls: [] }
    const mockClient = createMockSupabaseClient({ ilikes })
    makeAuthSuccess(mockClient)

    // The first name part is entirely special characters → sanitizes to ''
    mockedSanitizeSearch.mockImplementation((s: string) => {
      if (s === '%%%') return ''
      return s
    })

    mockGetDrivers.mockResolvedValue([
      {
        id: 'samsara-driver-3',
        name: '%%% Lastname',
        email: null,
        driverActivationStatus: 'active',
      },
    ])

    await syncDrivers()

    // No .ilike() queries issued — guard against a match-all scenario
    expect(ilikes.calls).toHaveLength(0)
  })

  it('skips .ilike() entirely when lastName sanitizes to empty string', async () => {
    const ilikes: IlikeSpy = { calls: [] }
    const mockClient = createMockSupabaseClient({ ilikes })
    makeAuthSuccess(mockClient)

    mockedSanitizeSearch.mockImplementation((s: string) => {
      if (s === '%%%') return ''
      return s
    })

    mockGetDrivers.mockResolvedValue([
      {
        id: 'samsara-driver-4',
        name: 'Firstname %%%',
        email: null,
        driverActivationStatus: 'active',
      },
    ])

    await syncDrivers()

    expect(ilikes.calls).toHaveLength(0)
  })

  it('issues .ilike() with sanitized values when both parts are non-empty', async () => {
    const ilikes: IlikeSpy = { calls: [] }
    const mockClient = createMockSupabaseClient({
      ilikes,
      matchedVroomxDriverId: 'driver-vroomx-1',
    })
    makeAuthSuccess(mockClient)

    mockedSanitizeSearch.mockImplementation((s: string) => s) // identity

    mockGetDrivers.mockResolvedValue([
      {
        id: 'samsara-driver-5',
        name: 'Carlos Mendez',
        email: null,
        driverActivationStatus: 'active',
      },
    ])

    const result = await syncDrivers()

    expect('error' in result ? result.error : null).toBeNull()
    expect(ilikes.calls).toHaveLength(2)
    expect(ilikes.calls.find(([col]) => col === 'first_name')?.[1]).toBe('Carlos')
    expect(ilikes.calls.find(([col]) => col === 'last_name')?.[1]).toBe('Mendez')
  })

  it('does not issue .ilike() for a driver with a single-word name', async () => {
    const ilikes: IlikeSpy = { calls: [] }
    const mockClient = createMockSupabaseClient({ ilikes })
    makeAuthSuccess(mockClient)

    mockGetDrivers.mockResolvedValue([
      {
        id: 'samsara-driver-6',
        name: 'Cher',
        email: null,
        driverActivationStatus: 'active',
      },
    ])

    await syncDrivers()

    // Single-word name → nameParts.length < 2 → no auto-map attempted
    expect(ilikes.calls).toHaveLength(0)
  })
})
