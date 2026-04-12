/**
 * Tenant-scoped cache layer using Upstash Redis.
 *
 * N15: thin cache-aside wrapper for hot queries. Every cache key is
 * prefixed with the tenant ID so tenant A never reads tenant B's cached
 * data. Falls back gracefully to cache-miss (returns null) if Redis is
 * unavailable — no hard dependency on cache for correctness.
 *
 * Usage in queries:
 *   const cached = await cacheGet<FinancialSummary>(tenantId, 'financial-summary')
 *   if (cached) return cached
 *   const fresh = await fetchFromDb(...)
 *   await cacheSet(tenantId, 'financial-summary', fresh, 300)
 *   return fresh
 *
 * Invalidation from server actions:
 *   await cacheInvalidate(tenantId, 'financial-summary')
 */

import { Redis } from '@upstash/redis'

const CACHE_PREFIX = 'vroomx_cache:'

// ---------------------------------------------------------------------------
// Redis client (lazy singleton — same pattern as rate-limit.ts)
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function buildKey(tenantId: string, key: string): string {
  return `${CACHE_PREFIX}${tenantId}:${key}`
}

/**
 * Get a cached value. Returns null on cache miss or Redis unavailability.
 */
export async function cacheGet<T>(tenantId: string, key: string): Promise<T | null> {
  const redis = getRedis()
  if (!redis) return null

  try {
    const raw = await redis.get<string>(buildKey(tenantId, key))
    if (raw === null || raw === undefined) return null
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T
  } catch {
    // Redis failure → cache miss. DB query will handle it.
    return null
  }
}

/**
 * Store a value in cache with TTL (seconds).
 */
export async function cacheSet(
  tenantId: string,
  key: string,
  value: unknown,
  ttlSeconds: number = 300,
): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    await redis.set(buildKey(tenantId, key), JSON.stringify(value), {
      ex: ttlSeconds,
    })
  } catch {
    // Cache write failure is non-fatal — next request will re-fetch from DB
  }
}

/**
 * Invalidate a specific cache entry for a tenant.
 * Call this from server actions after mutations.
 */
export async function cacheInvalidate(tenantId: string, key: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    await redis.del(buildKey(tenantId, key))
  } catch {
    // Non-fatal
  }
}

/**
 * Invalidate all cache entries for a tenant.
 * Use sparingly — scans for matching keys.
 */
export async function cacheInvalidateAll(tenantId: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    const pattern = `${CACHE_PREFIX}${tenantId}:*`
    let cursor = 0
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 })
      cursor = Number(nextCursor)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } while (cursor !== 0)
  } catch {
    // Non-fatal
  }
}
