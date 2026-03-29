// ============================================================================
// Samsara OAuth 2.0 Helpers
// ============================================================================

const SAMSARA_AUTH_URL = 'https://api.samsara.com/oauth2/authorize'
const SAMSARA_TOKEN_URL = 'https://api.samsara.com/oauth2/token'

function getClientId(): string {
  const id = process.env.SAMSARA_CLIENT_ID
  if (!id) throw new Error('SAMSARA_CLIENT_ID is not set')
  return id
}

function getClientSecret(): string {
  const secret = process.env.SAMSARA_CLIENT_SECRET
  if (!secret) throw new Error('SAMSARA_CLIENT_SECRET is not set')
  return secret
}

function getRedirectUri(): string {
  const uri = process.env.SAMSARA_REDIRECT_URI
  if (!uri) throw new Error('SAMSARA_REDIRECT_URI is not set')
  return uri
}

export interface SamsaraTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

/**
 * Build the Samsara OAuth authorization URL.
 * The `state` parameter should be a signed, tenant-scoped token
 * to prevent CSRF and tie the callback to the requesting tenant.
 */
export function getSamsaraAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    state,
  })
  return `${SAMSARA_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange an authorization code for access + refresh tokens.
 * Called from the OAuth callback route after Samsara redirects back.
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<SamsaraTokenResponse> {
  const response = await fetch(SAMSARA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error')
    throw new Error(
      `Samsara token exchange failed (${response.status}): ${errorBody}`
    )
  }

  return response.json() as Promise<SamsaraTokenResponse>
}

/**
 * Refresh an expired access token using the refresh token.
 * The response includes a new refresh token that should be persisted.
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<SamsaraTokenResponse> {
  const response = await fetch(SAMSARA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: getClientId(),
      client_secret: getClientSecret(),
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error')
    throw new Error(
      `Samsara token refresh failed (${response.status}): ${errorBody}`
    )
  }

  return response.json() as Promise<SamsaraTokenResponse>
}
