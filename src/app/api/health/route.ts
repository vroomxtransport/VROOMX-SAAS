import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { Redis } from '@upstash/redis'
import { rateLimitByIp } from '@/lib/rate-limit-ip'
import { getClientIp } from '@/lib/client-ip'

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------
// Lightweight liveness/readiness probe for monitoring, Netlify deploy
// previews, and load balancers. Unauthenticated by design — external
// monitors need to hit it without credentials. Deliberately does NOT leak
// any sensitive information: no version strings, no DB connection details,
// no env var names, just per-check status and a timestamp.
//
// Checks:
//   - database: service-role SELECT on `tenants` table (cheap, always-exists)
//   - redis:    Upstash PING (only run when credentials are configured; in
//               dev without Upstash the in-memory rate-limit fallback is
//               active and this check reports "not-configured" → still OK)
//
// Each check has a 2-second timeout so the endpoint can never hang longer
// than ~4 seconds in the worst case. A slow DB doesn't stall monitoring.
//
// HTTP status:
//   200 + {status: 'ok'}      — all required checks passed
//   503 + {status: 'degraded'} — at least one required check failed
//
// `redis: not-configured` does NOT degrade the response because this code
// path (no Upstash) is a valid dev/local mode. In production, `startup-checks.ts`
// already requires UPSTASH_REDIS_REST_URL + _TOKEN and fails boot if absent,
// so reaching this endpoint in prod guarantees credentials are set.
// ---------------------------------------------------------------------------

type CheckStatus = 'ok' | 'error' | 'not-configured'

interface HealthResponse {
  status: 'ok' | 'degraded'
  checks: {
    database: CheckStatus
    redis: CheckStatus
  }
  timestamp: string
}

const CHECK_TIMEOUT_MS = 2000

/**
 * Race a thenable against a timeout. Returns the literal 'timeout' if the
 * timer wins, otherwise returns the thenable's resolved value. Accepts
 * `PromiseLike<T>` (not `Promise<T>`) so Supabase's PostgrestFilterBuilder —
 * which is thenable but not a real Promise — can be passed directly without
 * an extra await + wrap.
 */
async function withTimeout<T>(
  thenable: PromiseLike<T>,
  timeoutMs: number
): Promise<T | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs)
  })
  try {
    return await Promise.race([Promise.resolve(thenable), timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function checkDatabase(): Promise<CheckStatus> {
  try {
    const supabase = createServiceRoleClient()
    // Cheapest possible "am I alive" query: HEAD request against a table
    // that always exists. `head: true` tells PostgREST to return only
    // the response headers (row count) and no row bodies, so we transfer
    // zero tenant data even though the query uses the service-role
    // client. No tenant_id scoping needed — we're only verifying
    // connectivity, not reading data.
    const result = await withTimeout(
      supabase.from('tenants').select('id', { count: 'exact', head: true }),
      CHECK_TIMEOUT_MS
    )

    if (result === 'timeout') return 'error'
    // Narrow via `in` check rather than an unsafe cast (L2 from the
    // security-auditor review): the Supabase response is a discriminated
    // shape with `error` present on both success and failure paths.
    if ('error' in result && result.error) return 'error'
    return 'ok'
  } catch {
    return 'error'
  }
}

async function checkRedis(): Promise<CheckStatus> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return 'not-configured'

  try {
    const redis = new Redis({ url, token })
    const result = await withTimeout(redis.ping(), CHECK_TIMEOUT_MS)
    if (result === 'timeout') return 'error'
    // L1 from the security-auditor review: accept any non-empty,
    // case-insensitive 'PONG' response so a future Upstash SDK bump that
    // normalizes casing or returns a boolean doesn't false-alert every
    // monitor. The `!== 'timeout'` is implied by the guard above.
    if (typeof result === 'string') {
      return result.toUpperCase() === 'PONG' ? 'ok' : 'error'
    }
    // Non-string truthy response (future SDK) → treat as OK.
    return result ? 'ok' : 'error'
  } catch {
    return 'error'
  }
}

export async function GET() {
  // M1 from the security-auditor review: the endpoint is unauthenticated
  // and each call runs a service-role DB query + an Upstash PING, both of
  // which are metered. Without a limit, a botnet or a hostile webpage
  // firing GETs from visitors' browsers could burn both Upstash commands
  // and Supabase egress at essentially zero cost to the attacker.
  //
  // 60 req/min/IP is ~10x any legitimate monitor's poll frequency
  // (Uptime Robot defaults to every 5 min, Pingdom to every 1 min) while
  // still capping amplification to ~1 RPS per IP. On limit hit, return
  // 429 BEFORE running the checks — the whole point of the rate limit is
  // to not incur the dependency cost.
  const ip = await getClientIp()
  const rl = await rateLimitByIp({
    ip,
    key: 'health:probe',
    limit: 60,
    windowMs: 60_000,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { status: 'rate_limited' },
      {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': '60',
        },
      }
    )
  }

  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()])

  // `redis: not-configured` is acceptable in dev/local; only real failures
  // degrade the response. The prod startup checks guarantee Upstash is
  // wired up before any request reaches the handler, so this branch only
  // fires in development.
  const redisOk = redis === 'ok' || redis === 'not-configured'
  const allOk = database === 'ok' && redisOk

  const body: HealthResponse = {
    status: allOk ? 'ok' : 'degraded',
    checks: { database, redis },
    timestamp: new Date().toISOString(),
  }

  return NextResponse.json(body, {
    status: allOk ? 200 : 503,
    headers: {
      // Monitoring hits this endpoint frequently; short cache OK but not
      // stale — keep it fresh.
      'Cache-Control': 'no-store',
    },
  })
}
