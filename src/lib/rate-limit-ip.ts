/**
 * IP-based rate limiter for unauthenticated (public portal) endpoints.
 *
 * Keyed on `${ip}:${key}` — distinct from the user-id-keyed rate limiter
 * in src/lib/rate-limit.ts which requires an authenticated session.
 *
 * Uses the same Upstash Redis backend when UPSTASH_REDIS_REST_URL +
 * UPSTASH_REDIS_REST_TOKEN are set. Falls back to an in-memory Map for
 * local dev / missing credentials.
 *
 * WARNING: In-memory fallback is process-local. On multi-instance deploys
 * (Netlify Edge, Vercel serverless) it does NOT provide distributed rate
 * limiting. Use Upstash in production.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ---------------------------------------------------------------------------
// Types (same shape as src/lib/rate-limit.ts for API consistency)
// ---------------------------------------------------------------------------

export interface RateLimitIpConfig {
  /** Client IP address */
  ip: string
  /** Logical key for the action (e.g. 'apply:create', 'apply:submit') */
  key: string
  /** Max requests allowed in the window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
}

export interface RateLimitIpResult {
  allowed: boolean
  remaining: number
}

// ---------------------------------------------------------------------------
// Upstash Redis client (lazy singleton — module-level is fine here because
// this is NOT a service-role client and contains no secrets beyond the
// rate-limit token which is already in env vars)
// ---------------------------------------------------------------------------

let _redis: Redis | null = null

function getRedis(): Redis | null {
  if (_redis) return _redis

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) return null

  _redis = new Redis({ url, token })
  return _redis
}

// Cache of Ratelimit instances keyed by "limit:windowMs" to avoid re-creating
const _limiters = new Map<string, Ratelimit>()

function getUpstashLimiter(limit: number, windowMs: number): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null

  const cacheKey = `${limit}:${windowMs}`
  let limiter = _limiters.get(cacheKey)
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: 'vroomx_ip_rl',
      analytics: false,
    })
    _limiters.set(cacheKey, limiter)
  }
  return limiter
}

// ---------------------------------------------------------------------------
// In-memory fallback (token bucket — same algorithm as rate-limit.ts)
// ---------------------------------------------------------------------------

interface InMemoryEntry {
  tokens: number
  lastRefill: number
}

const memoryStore = new Map<string, InMemoryEntry>()

// Clean stale entries every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [mapKey, entry] of memoryStore) {
      if (now - entry.lastRefill > 300_000) {
        memoryStore.delete(mapKey)
      }
    }
  }, 300_000)
}

function rateLimitInMemory(
  compositeKey: string,
  limit: number,
  windowMs: number
): RateLimitIpResult {
  const now = Date.now()
  const entry = memoryStore.get(compositeKey)

  if (!entry) {
    memoryStore.set(compositeKey, { tokens: limit - 1, lastRefill: now })
    return { allowed: true, remaining: limit - 1 }
  }

  const elapsed = now - entry.lastRefill
  const refill = Math.floor((elapsed / windowMs) * limit)

  if (refill > 0) {
    entry.tokens = Math.min(limit, entry.tokens + refill)
    entry.lastRefill = now
  }

  if (entry.tokens > 0) {
    entry.tokens--
    return { allowed: true, remaining: entry.tokens }
  }

  return { allowed: false, remaining: 0 }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check rate limit for the given IP + action key.
 *
 * Production: Upstash Redis sliding window (distributed, multi-instance safe).
 * Dev / fallback: in-memory token bucket scoped to the current process.
 *
 * @example
 *   const result = await rateLimitByIp({
 *     ip: headers().get('x-forwarded-for') ?? '127.0.0.1',
 *     key: 'apply:submit',
 *     limit: 5,
 *     windowMs: 60_000, // 5 submits per minute per IP
 *   })
 *   if (!result.allowed) return { error: 'Too many requests' }
 */
export async function rateLimitByIp(config: RateLimitIpConfig): Promise<RateLimitIpResult> {
  const compositeKey = `${config.ip}:${config.key}`
  const upstash = getUpstashLimiter(config.limit, config.windowMs)

  if (upstash) {
    const { success, remaining } = await upstash.limit(compositeKey)
    return { allowed: success, remaining }
  }

  return rateLimitInMemory(compositeKey, config.limit, config.windowMs)
}

/**
 * Returns which rate-limit backend is active.
 * Used by startup checks to confirm Upstash is in effect in production.
 */
export function rateLimitIpMode(): 'upstash' | 'in-memory' {
  return getRedis() != null ? 'upstash' : 'in-memory'
}
