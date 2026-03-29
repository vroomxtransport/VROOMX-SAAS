import { createHmac, timingSafeEqual } from 'crypto'

// ============================================================================
// QuickBooks Webhook HMAC-SHA256 Verification
// ============================================================================

/**
 * Verify a QuickBooks webhook request signature.
 *
 * QuickBooks signs webhook payloads with HMAC-SHA256 using the verifier token
 * configured in the QuickBooks Developer portal. The signature is sent in
 * the `intuit-signature` header as a Base64-encoded HMAC digest.
 *
 * @param payload       - Raw request body string
 * @param signature     - intuit-signature header value (Base64-encoded HMAC)
 * @param verifierToken - Webhook verifier token from QB Developer portal
 * @returns true if the signature is valid
 */
export function verifyQuickBooksWebhook(
  payload: string,
  signature: string,
  verifierToken: string
): boolean {
  // 1. Reject missing inputs
  if (!payload || !signature || !verifierToken) {
    return false
  }

  // 2. Compute HMAC-SHA256 of the payload using verifier token
  const expectedSignature = createHmac('sha256', verifierToken)
    .update(payload)
    .digest('base64')

  // 3. Constant-time comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature, 'base64')
  const expectedBuffer = Buffer.from(expectedSignature, 'base64')

  if (sigBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(sigBuffer, expectedBuffer)
}
