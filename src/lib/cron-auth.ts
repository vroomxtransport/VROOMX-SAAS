import { timingSafeEqual, createHmac } from 'crypto'

/**
 * Verify the CRON_SECRET header using constant-time comparison.
 *
 * Both values are HMAC'd before comparison so the resulting digests are
 * always 32 bytes regardless of input length. This eliminates the length
 * oracle that a plain `timingSafeEqual` with a length pre-check would
 * expose (an attacker could binary-search the secret length in ~7 requests).
 */
export function verifyCronSecret(provided: string | null): boolean {
  const expected = process.env.CRON_SECRET
  if (!provided || !expected) return false

  const hmac = (val: string) =>
    createHmac('sha256', 'vroomx-cron-verify').update(val).digest()

  return timingSafeEqual(hmac(provided), hmac(expected))
}
