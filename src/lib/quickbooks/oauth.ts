import type { QBTokenResponse } from './types'

// ============================================================================
// QuickBooks Online OAuth 2.0 Helpers
// ============================================================================

const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

function getClientId(): string {
  const id = process.env.QUICKBOOKS_CLIENT_ID
  if (!id) throw new Error('QUICKBOOKS_CLIENT_ID is not set')
  return id
}

function getClientSecret(): string {
  const secret = process.env.QUICKBOOKS_CLIENT_SECRET
  if (!secret) throw new Error('QUICKBOOKS_CLIENT_SECRET is not set')
  return secret
}

function getRedirectUri(): string {
  const uri = process.env.QUICKBOOKS_REDIRECT_URI
  if (!uri) throw new Error('QUICKBOOKS_REDIRECT_URI is not set')
  return uri
}

/**
 * Build Basic auth header for Intuit OAuth token endpoint.
 * Format: Base64(client_id:client_secret)
 */
function getBasicAuthHeader(): string {
  const credentials = `${getClientId()}:${getClientSecret()}`
  return `Basic ${Buffer.from(credentials).toString('base64')}`
}

/**
 * Build the QuickBooks OAuth authorization URL.
 * The `state` parameter should be a signed, tenant-scoped token
 * to prevent CSRF and tie the callback to the requesting tenant.
 */
export function getQuickBooksAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    state,
  })
  return `${QB_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange an authorization code for access + refresh tokens.
 * Called from the OAuth callback route after QuickBooks redirects back.
 *
 * NOTE: The realmId (company ID) comes from the callback query params
 * and must be stored alongside the tokens for API calls.
 */
export async function exchangeCodeForTokens(
  code: string,
  _realmId: string
): Promise<QBTokenResponse> {
  const response = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: getBasicAuthHeader(),
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error')
    throw new Error(
      `QuickBooks token exchange failed (${response.status}): ${errorBody}`
    )
  }

  return response.json() as Promise<QBTokenResponse>
}

/**
 * Refresh an expired access token using the refresh token.
 *
 * CRITICAL: QuickBooks rotates refresh tokens on every refresh call.
 * The response includes a NEW refresh token that MUST be persisted immediately.
 * If the old refresh token is used again after rotation, the integration
 * will become permanently disconnected.
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<QBTokenResponse> {
  const response = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: getBasicAuthHeader(),
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error')
    throw new Error(
      `QuickBooks token refresh failed (${response.status}): ${errorBody}`
    )
  }

  return response.json() as Promise<QBTokenResponse>
}

/**
 * Alias for refreshAccessToken — used by sync orchestration layer.
 */
export { refreshAccessToken as refreshQuickBooksToken }
