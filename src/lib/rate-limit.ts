/**
 * Simple in-memory sliding window rate limiter.
 * For production with multiple serverless instances, replace with Upstash Redis.
 */

interface RateLimitEntry {
  tokens: number
  lastRefill: number
}

const store = new Map<string, RateLimitEntry>()

// Clean stale entries every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (now - entry.lastRefill > 300_000) {
        store.delete(key)
      }
    }
  }, 300_000)
}

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
}

export function rateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry) {
    store.set(key, { tokens: config.limit - 1, lastRefill: now })
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
