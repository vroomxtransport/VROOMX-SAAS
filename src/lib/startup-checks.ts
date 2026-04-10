/**
 * Startup environment-variable validation.
 *
 * Called from instrumentation.ts on app boot. Hard-fails in production if
 * any required env var is missing — better to crash on boot than to fail
 * silently at request time (e.g. CRON_SECRET unset → all cron jobs return
 * 401 silently; UPSTASH_REDIS_REST_URL unset → rate limiter falls back to
 * in-memory across multiple serverless instances).
 *
 * In dev, missing vars log a warning but do not crash, so local development
 * doesn't require every integration credential.
 */

interface EnvCheck {
  /** Primary env var name. */
  name: string
  /**
   * Optional alternate names accepted as substitutes for `name`. Used for
   * vars that have been renamed historically (e.g. SUPABASE_SECRET_KEY vs
   * SUPABASE_SERVICE_ROLE_KEY — service-role.ts accepts either).
   */
  aliases?: string[]
  required: boolean
  description: string
}

const REQUIRED_ENV: EnvCheck[] = [
  // Core
  { name: 'NEXT_PUBLIC_SUPABASE_URL', required: true, description: 'Supabase project URL' },
  { name: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', required: true, description: 'Supabase anon key' },
  {
    name: 'SUPABASE_SECRET_KEY',
    aliases: ['SUPABASE_SERVICE_ROLE_KEY'],
    required: true,
    description: 'Supabase service-role key (either name accepted)',
  },
  { name: 'DATABASE_URL', required: true, description: 'Postgres pooled connection (PgBouncer 6543)' },

  // Stripe
  { name: 'STRIPE_SECRET_KEY', required: true, description: 'Stripe API key' },
  { name: 'STRIPE_WEBHOOK_SECRET', required: true, description: 'Stripe webhook signing secret' },
  // Tier price IDs — must match src/lib/stripe/config.ts getPriceMap() keys.
  // Missing these causes silent checkout failure: signUpAction's PRICE_MAP
  // captures undefined, createCheckoutSession returns 'Invalid plan selected.'
  { name: 'STRIPE_OWNER_OPERATOR_PRICE_ID', required: true, description: 'Stripe price ID for the Owner-Operator tier ($29/mo)' },
  { name: 'STRIPE_STARTER_X_PRICE_ID',      required: true, description: 'Stripe price ID for the Starter X tier ($49/mo)' },
  { name: 'STRIPE_PRO_X_PRICE_ID',          required: true, description: 'Stripe price ID for the Pro X tier ($149/mo)' },

  // Cron — added for M1 (CRON_SECRET silent failure)
  { name: 'CRON_SECRET', required: true, description: 'Bearer token for /api/cron/* endpoints' },

  // Rate limiting — added for M5 (in-memory fallback in multi-instance prod)
  { name: 'UPSTASH_REDIS_REST_URL', required: true, description: 'Upstash Redis URL for distributed rate limiting' },
  { name: 'UPSTASH_REDIS_REST_TOKEN', required: true, description: 'Upstash Redis token' },

  // EIA fuel pricing — added for C4 (was hardcoded DEMO_KEY)
  { name: 'EIA_API_KEY', required: true, description: 'EIA API key for fuel pricing endpoint' },

  // Chrome extension — added for C5 (was open CORS to any extension)
  {
    name: 'EXTENSION_ALLOWED_IDS',
    required: true,
    description: 'Comma-separated chrome-extension://<id> origins allowed to call /api/extension/*',
  },

  // QuickBooks webhook — referenced by route handler
  { name: 'QUICKBOOKS_WEBHOOK_VERIFIER', required: false, description: 'QB webhook HMAC verifier (only required if QB integration enabled)' },

  // CFG-006: these three would previously fail silently at runtime if
  // unset — now surfaced at boot so misconfigurations crash fast.
  //
  // NEXT_PUBLIC_APP_URL: used by src/app/actions/billing.ts to build
  //   Stripe checkout success/cancel redirects. Missing → Stripe
  //   receives `undefined/settings?...` and returns a cryptic error.
  // RESEND_API_KEY: used by src/lib/resend/client.ts for all email
  //   sends (invoices, invites, alerts). Missing → silent failure
  //   the first time we try to email a customer.
  // NEXT_PUBLIC_SENTRY_DSN: used by sentry.server.config.ts and
  //   instrumentation-client.ts. Sentry init silently no-ops if the
  //   DSN is absent — production error tracking goes dark without
  //   any indication anything is wrong.
  { name: 'NEXT_PUBLIC_APP_URL', required: true, description: 'Canonical app URL for Stripe checkout redirects' },
  { name: 'RESEND_API_KEY', required: true, description: 'Resend API key for transactional email' },
  { name: 'NEXT_PUBLIC_SENTRY_DSN', required: true, description: 'Sentry DSN for error tracking' },

  // PLATFORM_ADMIN_EMAILS: gates /admin route access. If unset the
  // admin panel is fully locked out (safe-by-default), so this is a
  // warning rather than a hard fail. The warning is printed in
  // assertRequiredEnvVars() below.
  { name: 'PLATFORM_ADMIN_EMAILS', required: false, description: 'Comma-separated admin email allowlist — admin panel locked out if unset' },

  // Web Push (PWA push notifications) — optional, push silently skipped if unset
  { name: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', required: false, description: 'VAPID public key for web push notifications' },
  { name: 'VAPID_PRIVATE_KEY', required: false, description: 'VAPID private key for web push notifications' },

  // Mapbox — optional, geocoding + distance calc skipped if unset. Orders
  // continue to work without it; distance_miles stays null until entered
  // manually. Warning printed below.
  { name: 'MAPBOX_ACCESS_TOKEN', required: false, description: 'Mapbox token for geocoding + driving-distance calculation on orders' },
]

/**
 * Assert that all required env vars are present.
 *
 * Production: throws on any missing required var (fail-fast on boot).
 * Development: logs warning for missing vars but does not throw.
 */
function isCheckSatisfied(check: EnvCheck): boolean {
  if (process.env[check.name]) return true
  if (check.aliases) {
    for (const alias of check.aliases) {
      if (process.env[alias]) return true
    }
  }
  return false
}

export function assertRequiredEnvVars(): void {
  const isProd = process.env.NODE_ENV === 'production'
  const missing: EnvCheck[] = []

  for (const check of REQUIRED_ENV) {
    if (check.required && !isCheckSatisfied(check)) {
      missing.push(check)
    }
  }

  if (missing.length === 0) {
    if (!isProd) {
      console.info('[startup] All required env vars present')
    }
    // Log which rate-limit backend is active so operators can confirm
    // Upstash is wired up in production (vs. the in-memory fallback that
    // is bypassable across multi-instance deploys). M5 visibility fix.
    void import('./rate-limit').then(({ rateLimitMode }) => {
      console.info(`[startup] rate-limit backend: ${rateLimitMode()}`)
    })
    // CFG-006: warn (don't throw) when optional-but-impactful vars are
    // missing. PLATFORM_ADMIN_EMAILS is the main one — its absence
    // silently locks the admin panel, which is safe but surprising.
    if (!process.env.PLATFORM_ADMIN_EMAILS) {
      console.warn(
        '[startup] PLATFORM_ADMIN_EMAILS unset — /admin panel is locked out for all users',
      )
    }
    if (!process.env.MAPBOX_ACCESS_TOKEN) {
      console.warn(
        '[startup] MAPBOX_ACCESS_TOKEN unset — order geocoding + driving-distance auto-calc disabled',
      )
    }
    return
  }

  const lines = missing.map((m) => `  - ${m.name}: ${m.description}`)
  const message = `[startup] Missing required environment variables:\n${lines.join('\n')}`

  if (isProd) {
    // Fail-fast: prevent server from accepting any traffic with broken config
    throw new Error(message)
  }

  // Dev: warn loudly but allow boot
  console.warn(message)
  console.warn('[startup] Continuing in development mode — these vars are required in production')
}
