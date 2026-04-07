import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/extension/cors'
import { createClient } from '@/lib/supabase/server'

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json(null, { status: 204, headers: corsHeaders(request) })
}

export async function GET(request: NextRequest) {
  const cors = corsHeaders(request)

  try {
    // This route uses cookie-based auth (called from the VroomX dashboard
    // domain context via fetch with credentials: 'include'). It's the
    // bootstrap endpoint that the Chrome extension hits to obtain an
    // access token to use for subsequent /api/extension/* calls.
    const supabase = await createClient()

    // STEP 1 — Auth source of truth. getUser() validates the JWT against
    // Supabase Auth and returns null/error if revoked. This is the only
    // call that decides whether the request is authenticated.
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { authenticated: false },
        { status: 200, headers: cors }
      )
    }

    const tenantId = user.app_metadata?.tenant_id
    if (!tenantId) {
      return NextResponse.json(
        { authenticated: false },
        { status: 200, headers: cors }
      )
    }

    // STEP 2 — Token relay (NOT an auth check). After getUser() has proven
    // the user is valid, we still need the access_token to hand back to the
    // Chrome extension so it can call /api/extension/import-pdf and
    // /api/extension/confirm with `Authorization: Bearer <token>`.
    //
    // Per .claude/rules/security.md, getSession() must NEVER be used as an
    // auth gate because it returns the cookie value without re-validating
    // against the auth server. That rule is satisfied here: getUser() above
    // is the auth gate. getSession() below is strictly a cookie-store
    // reader for token extraction. Any TOCTOU race between the two calls
    // is microseconds and benign — if the session is revoked between calls,
    // the relayed token simply fails on the extension's next request and
    // it re-auths.
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        { authenticated: false },
        { status: 200, headers: cors }
      )
    }

    return NextResponse.json(
      {
        authenticated: true,
        accessToken: session.access_token,
        user: {
          email: user.email,
          tenantId,
        },
      },
      { status: 200, headers: cors }
    )
  } catch {
    return NextResponse.json(
      { authenticated: false },
      { status: 200, headers: cors }
    )
  }
}
