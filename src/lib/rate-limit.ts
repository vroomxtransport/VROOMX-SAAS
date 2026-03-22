/**
 * Rate limiter with Upstash Redis (production) and in-memory fallback (dev).
 *
 * Uses Upstash sliding window when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * are set. Falls back to a module-level Map for local dev / missing credentials.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ---------------------------------------------------------------------------
// Types (exported — keep exact same shape for consumers)
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
}

// ---------------------------------------------------------------------------
// Upstash Redis client (lazy singleton)
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

function getUpstashLimiter(config: RateLimitConfig): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null

  const cacheKey = `${config.limit}:${config.windowMs}`
  let limiter = _limiters.get(cacheKey)
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.limit, `${config.windowMs} ms`),
      prefix: 'vroomx_rl',
      analytics: false,
    })
    _limiters.set(cacheKey, limiter)
  }
  return limiter
}

// ---------------------------------------------------------------------------
// In-memory fallback (used when Upstash env vars are not set)
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
    for (const [key, entry] of memoryStore) {
      if (now - entry.lastRefill > 300_000) {
        memoryStore.delete(key)
      }
    }
  }, 300_000)
}

function rateLimitInMemory(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const entry = memoryStore.get(key)

  if (!entry) {
    memoryStore.set(key, { tokens: config.limit - 1, lastRefill: now })
    return { allowed: true, remaining: config.limit - 1 }
  }

  // Refill tokens based on elapsed time
  const elapsed = now - entry.lastRefill
  const refill = Math.floor((elapsed / config.windowMs) * config.limit)

  if (refill > 0) {
    entry.tokens = Math.min(config.limit, entry.tokens + refill)
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
 * Check rate limit for the given key.
 *
 * Production: Upstash Redis sliding window (distributed, multi-instance safe).
 * Dev / fallback: in-memory token bucket scoped to the current process.
 */
export async function rateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const upstash = getUpstashLimiter(config)

  if (upstash) {
    const { success, remaining } = await upstash.limit(key)
    return { allowed: success, remaining }
  }

  // Fallback: in-memory (single-instance, suitable for dev / preview deploys)
  return rateLimitInMemory(key, config)
}
