/**
 * Distributed lock for cron routes using Upstash Redis.
 *
 * N16: prevents overlapping cron invocations from processing the same
 * tenants simultaneously. Uses Redis SET NX EX (atomic set-if-not-exists
 * with TTL) so the lock automatically expires if the holder crashes.
 *
 * Falls back to a no-op (always-acquired) lock when Upstash is not
 * configured (local dev). This matches the rate-limit fallback pattern.
 */

import { Redis } from '@upstash/redis'

const LOCK_PREFIX = 'vroomx_cron_lock:'

/** Default TTL: 60 seconds. Cron should complete well within this. */
const DEFAULT_TTL_SECONDS = 60

let _redis: Redis | null = null

function getRedis(): Redis | null {
  if (_redis) return _redis

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) return null

  _redis = new Redis({ url, token })
  return _redis
}

export interface CronLock {
  acquired: boolean
  release: () => Promise<void>
}

/**
 * Attempt to acquire a distributed lock for a cron job.
 *
 * @param name — unique cron identifier (e.g. 'cron:alerts', 'cron:fuelcard-sync')
 * @param ttlSeconds — lock TTL; auto-expires if holder crashes (default 60s)
 * @returns `{ acquired: true, release }` if lock acquired, `{ acquired: false }` otherwise
 */
export async function acquireCronLock(
  name: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<CronLock> {
  const redis = getRedis()
  const key = `${LOCK_PREFIX}${name}`

  // No Redis → always acquire (safe for single-instance local dev)
  if (!redis) {
    return { acquired: true, release: async () => {} }
  }

  // SET key value NX EX ttl — atomic set-if-not-exists with expiry
  const result = await redis.set(key, Date.now().toString(), {
    nx: true,
    ex: ttlSeconds,
  })

  if (result !== 'OK') {
    return {
      acquired: false,
      release: async () => {},
    }
  }

  return {
    acquired: true,
    release: async () => {
      try {
        await redis.del(key)
      } catch {
        // Lock will auto-expire via TTL if delete fails
      }
    },
  }
}
