import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

const AUTH_PATHS = ['/login', '/signup']
const DASHBOARD_PATH_PREFIX = '/dashboard'
const AUTH_REFRESH_FAILURE_MESSAGE = 'Authentication is temporarily unavailable. Please try again.'

function handleAuthRefreshFailure(
  request: NextRequest,
  reason: string,
  details?: Record<string, string | number | null | undefined>
) {
  console.error('[AUTH_PROXY] Auth refresh failed', {
    method: request.method,
    path: request.nextUrl.pathname,
    reason,
    ...details,
  })

  if (request.nextUrl.pathname.startsWith(DASHBOARD_PATH_PREFIX)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', AUTH_REFRESH_FAILURE_MESSAGE)
    return NextResponse.redirect(url)
  }

  return NextResponse.next({ request })
}

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request })
  }

  // Rate limit auth endpoints (POST only = form submissions)
  if (request.method === 'POST' && AUTH_PATHS.some(p => request.nextUrl.pathname === p)) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? 'unknown'
    const { allowed } = rateLimit(`auth:${ip}`, { limit: 10, windowMs: 60_000 })
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Use getUser(), NOT getSession()
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      return handleAuthRefreshFailure(request, 'supabase_auth_error', {
        code: error.code,
        status: error.status,
      })
    }
    user = data.user
  } catch (error) {
    return handleAuthRefreshFailure(request, 'supabase_auth_exception', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    })
  }

  // Redirect unauthenticated users from protected routes to login
  if (
    !user &&
    request.nextUrl.pathname.startsWith(DASHBOARD_PATH_PREFIX)
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users without tenant to onboarding
  if (
    user &&
    !user.app_metadata?.tenant_id &&
    request.nextUrl.pathname.startsWith(DASHBOARD_PATH_PREFIX)
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/onboarding'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (
    user &&
    user.app_metadata?.tenant_id &&
    (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
