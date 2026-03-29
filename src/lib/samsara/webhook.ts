import { createHmac, timingSafeEqual } from 'crypto'

// ============================================================================
// Samsara Webhook HMAC-SHA256 Verification
// ============================================================================

const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Verify a Samsara webhook request signature.
 *
 * @param body       - Raw request body string
 * @param signature  - X-Samsara-Signature header value (format: "v1=<hex>")
 * @param timestamp  - X-Samsara-Timestamp header value (Unix epoch seconds)
 * @param secret     - Per-tenant webhook secret (Base64 encoded)
 * @returns true if the signature is valid and the timestamp is recent
 */
export function verifySamsaraWebhook(
  body: string,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  // 1. Reject missing inputs
  if (!body || !signature || !timestamp || !secret) {
    return false
  }

  // 2. Replay protection — reject timestamps older than 5 minutes
  const timestampMs = parseInt(timestamp, 10) * 1000
  if (isNaN(timestampMs)) {
    return false
  }
  const age = Date.now() - timestampMs
  if (age > MAX_TIMESTAMP_AGE_MS || age < -MAX_TIMESTAMP_AGE_MS) {
    return false
  }

  // 3. Base64 decode the webhook secret
  const decodedSecret = Buffer.from(secret, 'base64')

  // 4. Build the signed message: "v1:<timestamp>:<body>"
  const message = `v1:${timestamp}:${body}`

  // 5. Compute HMAC-SHA256
  const expectedSignature =
    'v1=' + createHmac('sha256', decodedSecret).update(message).digest('hex')

  // 6. Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return false
  }
  const sigBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)
  return sigBuffer.length === expectedBuffer.length &&
    timingSafeEqual(sigBuffer, expectedBuffer)
}
