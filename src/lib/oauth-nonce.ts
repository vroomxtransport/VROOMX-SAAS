/**
 * OAuth nonce store — replay protection for state tokens.
 *
 * L3 fix. Every OAuth flow (QuickBooks today, Samsara future) generates a
 * random nonce and packs it into the state parameter sent to the provider.
 * Without server-side tracking, an attacker who captured a valid state
 * token (referer leak, session hijack, browser-history exfiltration) could
 * replay it against the callback at any time the JWT was still valid.
 *
 * `issueNonce()` writes the nonce to public.oauth_nonces with a 10-minute
 * TTL. `consumeNonce()` validates that the nonce exists, hasn't expired,
 * and matches the expected tenant — then deletes it (one-time use). A
 * second consume of the same nonce returns "not found".
 *
 * Both calls require the service-role client because the table is RLS-
 * locked (no policies for `authenticated` or `anon`, only the service-
 * role bypass can read or write).
 *
 * The schema is created by:
 * supabase/migrations/20260407120944_add_oauth_nonces.sql
 *
 * If the table does NOT exist (migration not yet applied), both functions
 * fail closed — issueNonce throws and consumeNonce returns false. This is
 * intentional: a missing table means OAuth flows cannot be safely tracked
 * for replay, so they should be blocked entirely until the migration is
 * applied. The error is logged loudly so operators notice immediately.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'

const NONCE_TTL_MS = 10 * 60 * 1000 // 10 minutes

export type OAuthProvider = 'quickbooks' | 'samsara'

/**
 * Persist a fresh nonce for the given tenant + provider. Call this from
 * the OAuth initiation action right after generating the random nonce
 * but before redirecting the user to the provider.
 *
 * Throws if the insert fails (table missing, DB unreachable, duplicate
 * nonce — the last is statistically near-impossible with 16 bytes of
 * randomness, but the unique PK constraint catches it).
 */
export async function issueNonce(
  nonce: string,
  tenantId: string,
  provider: OAuthProvider
): Promise<void> {
  const supabase = createServiceRoleClient()
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS).toISOString()

  const { error } = await supabase.from('oauth_nonces').insert({
    nonce,
    tenant_id: tenantId,
    provider,
    expires_at: expiresAt,
  })

  if (error) {
    console.error('[oauth-nonce] issueNonce failed', {
      provider,
      tenantId,
      code: error.code,
      message: error.message,
    })
    throw new Error('Failed to initialize OAuth flow')
  }
}

/**
 * Validate and consume a nonce. Returns true if the nonce existed,
 * matched the expected tenant + provider, and was not expired.
 *
 * On success the nonce is DELETED — any subsequent call with the same
 * nonce returns false (replay rejected).
 *
 * Also opportunistically deletes any nonces that have expired, to keep
 * the table small without a separate cron.
 */
export async function consumeNonce(
  nonce: string,
  tenantId: string,
  provider: OAuthProvider
): Promise<boolean> {
  const supabase = createServiceRoleClient()
  const nowIso = new Date().toISOString()

  // Opportunistic cleanup of any expired nonces. Failure here is non-fatal.
  void supabase
    .from('oauth_nonces')
    .delete()
    .lt('expires_at', nowIso)
    .then(({ error }) => {
      if (error) {
        console.warn('[oauth-nonce] cleanup failed', {
          code: error.code,
          message: error.message,
        })
      }
    })

  // Atomic validate-and-consume: delete the row only if it exists with
  // the expected tenant, provider, and not yet expired. The .select()
  // tells PostgREST to return the deleted row(s); if length === 1 the
  // delete matched and the nonce was valid.
  const { data, error } = await supabase
    .from('oauth_nonces')
    .delete()
    .eq('nonce', nonce)
    .eq('tenant_id', tenantId)
    .eq('provider', provider)
    .gte('expires_at', nowIso)
    .select('nonce')

  if (error) {
    console.error('[oauth-nonce] consumeNonce failed', {
      provider,
      tenantId,
      code: error.code,
      message: error.message,
    })
    // Fail closed: if we can't validate (e.g. table missing), reject.
    return false
  }

  return Array.isArray(data) && data.length === 1
}
