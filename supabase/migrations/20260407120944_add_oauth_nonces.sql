-- ============================================================================
-- L3 fix: OAuth nonce store for state-token replay protection
-- ============================================================================
-- The QuickBooks (and Samsara) OAuth flow generates a random `nonce` and
-- packs it into the state token sent to Intuit. On callback the previous
-- implementation only checked that the state token decoded and that the
-- tenant_id inside matched the authenticated user — it did NOT check that
-- the nonce had ever been issued, nor that it had not been used before.
-- An attacker who captured a valid state token (e.g. via referer leak,
-- browser history exfiltration, or session hijacking) could replay it
-- against the callback endpoint at any time the JWT was still valid.
--
-- This table stores every issued nonce with a 10-minute TTL. The callback
-- consumes the nonce (deletes it) on successful validation, and any
-- second use returns "not found" → replay rejected.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.oauth_nonces (
  nonce       TEXT        PRIMARY KEY,
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider    TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for the cleanup-on-consume DELETE to be O(log n).
CREATE INDEX IF NOT EXISTS idx_oauth_nonces_expires_at
  ON public.oauth_nonces (expires_at);

-- The table is service-role only — never exposed via PostgREST.
ALTER TABLE public.oauth_nonces ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies for `authenticated` or `anon`
-- means RLS denies everything by default. Only the service-role bypass
-- (used by server-side code in src/lib/oauth-nonce.ts) can read/write.
