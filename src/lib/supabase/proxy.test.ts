import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { rateLimit } from '@/lib/rate-limit'
import { updateSession } from './proxy'

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
}))

const mockedCreateServerClient = vi.mocked(createServerClient)
const mockedRateLimit = vi.mocked(rateLimit)
const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const originalSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

function makeRequest(pathname: string, method = 'GET') {
  return new NextRequest(new Request(`https://example.com${pathname}`, { method }))
}

function mockGetUserResolved(result: {
  data: { user: { app_metadata?: Record<string, unknown> } | null }
  error: { code?: string; status?: number } | null
}) {
  mockedCreateServerClient.mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue(result),
    },
  } as unknown as ReturnType<typeof createServerClient>)
}

function mockGetUserRejected(error: unknown) {
  mockedCreateServerClient.mockReturnValue({
    auth: {
      getUser: vi.fn().mockRejectedValue(error),
    },
  } as unknown as ReturnType<typeof createServerClient>)
}

describe('updateSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockedRateLimit.mockReturnValue({ allowed: true, remaining: 9 })
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalSupabaseKey
  })

  it('redirects unauthenticated dashboard requests to /login when auth refresh succeeds', async () => {
    mockGetUserResolved({
      data: { user: null },
      error: null,
    })

    const response = await updateSession(makeRequest('/dashboard'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://example.com/login')
  })

  it('passes through /login when getUser throws', async () => {
    mockGetUserRejected(new Error('Network failure'))

    const response = await updateSession(makeRequest('/login'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(console.error).toHaveBeenCalledWith(
      '[AUTH_PROXY] Auth refresh failed',
      expect.objectContaining({
        path: '/login',
        reason: 'supabase_auth_exception',
      })
    )
  })

  it('redirects dashboard requests to /login with safe error when getUser throws', async () => {
    mockGetUserRejected(new Error('Upstream unavailable'))

    const response = await updateSession(makeRequest('/dashboard'))
    const location = response.headers.get('location')

    expect(response.status).toBe(307)
    expect(location).toBeTruthy()
    expect(new URL(location!).pathname).toBe('/login')
    expect(new URL(location!).searchParams.get('error')).toBe(
      'Authentication is temporarily unavailable. Please try again.'
    )
  })

  it('redirects dashboard requests to /login with safe error when getUser returns auth error', async () => {
    mockGetUserResolved({
      data: { user: null },
      error: { code: 'auth_service_down', status: 503 },
    })

    const response = await updateSession(makeRequest('/dashboard'))
    const location = response.headers.get('location')

    expect(response.status).toBe(307)
    expect(location).toBeTruthy()
    expect(new URL(location!).pathname).toBe('/login')
    expect(new URL(location!).searchParams.get('error')).toBe(
      'Authentication is temporarily unavailable. Please try again.'
    )
    expect(console.error).toHaveBeenCalledWith(
      '[AUTH_PROXY] Auth refresh failed',
      expect.objectContaining({
        path: '/dashboard',
        reason: 'supabase_auth_error',
        code: 'auth_service_down',
        status: 503,
      })
    )
  })
})
