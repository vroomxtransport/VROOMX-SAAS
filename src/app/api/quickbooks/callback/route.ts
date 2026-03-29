import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { exchangeCodeForTokens } from '@/lib/quickbooks/oauth'

// ---------------------------------------------------------------------------
// GET /api/quickbooks/callback
// ---------------------------------------------------------------------------
// QuickBooks OAuth 2.0 redirect handler.
// Intuit redirects here after the user authorizes. We exchange the
// authorization code for tokens, verify the tenant, and persist them.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const baseUrl = request.nextUrl.origin

  try {
    // 1. Extract OAuth params from URL
    const code = request.nextUrl.searchParams.get('code')
    const realmId = request.nextUrl.searchParams.get('realmId')
    const state = request.nextUrl.searchParams.get('state')

    if (!code || !realmId || !state) {
      console.error('[QB_CALLBACK] Missing required params:', { code: !!code, realmId: !!realmId, state: !!state })
      return NextResponse.redirect(
        new URL('/integrations/quickbooks?error=missing_params', baseUrl)
      )
    }

    // 2. Validate state token (base64-encoded JSON: { tenantId, nonce })
    //    This prevents CSRF — the state was generated when the user started
    //    the OAuth flow and should match the authenticated user's tenant.
    let statePayload: { tenantId: string; nonce: string }
    try {
      const decoded = Buffer.from(state, 'base64').toString('utf-8')
      statePayload = JSON.parse(decoded)
      if (!statePayload.tenantId || !statePayload.nonce) {
        throw new Error('Invalid state shape')
      }
    } catch {
      console.error('[QB_CALLBACK] Invalid state token')
      return NextResponse.redirect(
        new URL('/integrations/quickbooks?error=invalid_state', baseUrl)
      )
    }

    // 3. Get authenticated user via cookie-based Supabase client
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[QB_CALLBACK] User not authenticated:', authError?.message)
      return NextResponse.redirect(new URL('/login', baseUrl))
    }

    // 4. Verify the authenticated user's tenant matches the state token
    const tenantId = user.app_metadata?.tenant_id as string | undefined
    if (!tenantId || tenantId !== statePayload.tenantId) {
      console.error('[QB_CALLBACK] Tenant mismatch — possible CSRF')
      return NextResponse.redirect(
        new URL('/integrations/quickbooks?error=tenant_mismatch', baseUrl)
      )
    }

    // 5. Exchange authorization code for access + refresh tokens
    const tokens = await exchangeCodeForTokens(code, realmId)

    // 6. Compute token expiry timestamp
    const tokenExpiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString()

    const refreshTokenExpiresAt = new Date(
      Date.now() + tokens.x_refresh_token_expires_in * 1000
    ).toISOString()

    // 7. Upsert integration record
    //    Using service-role client because the quickbooks_integrations table
    //    may have RLS that restricts direct inserts from the user client.
    const serviceClient = createServiceRoleClient()

    const { error: upsertError } = await serviceClient
      .from('quickbooks_integrations')
      .upsert(
        {
          tenant_id: tenantId,
          realm_id: realmId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: tokenExpiresAt,
          refresh_token_expires_at: refreshTokenExpiresAt,
          status: 'active',
          connected_by: user.id,
          connected_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' }
      )

    if (upsertError) {
      console.error('[QB_CALLBACK] Failed to store tokens:', upsertError.message)
      return NextResponse.redirect(
        new URL('/integrations/quickbooks?error=storage_failed', baseUrl)
      )
    }

    // 8. Success — redirect to integrations page
    return NextResponse.redirect(
      new URL('/integrations/quickbooks?connected=true', baseUrl)
    )
  } catch (error) {
    console.error('[QB_CALLBACK] Unhandled error:', error instanceof Error ? error.message : 'Unknown')
    return NextResponse.redirect(
      new URL('/integrations/quickbooks?error=auth_failed', baseUrl)
    )
  }
}
