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
