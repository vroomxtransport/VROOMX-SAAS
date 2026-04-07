/**
 * CORS helpers for Chrome extension API routes.
 *
 * SECURITY: Only allows requests from extensions whose full origin
 * (chrome-extension://<id>) is listed in the EXTENSION_ALLOWED_IDS env var.
 * Previously this allowed ANY chrome-extension:// origin, which let any
 * extension installed on a user's browser call the extension API endpoints
 * (/api/extension/auth, /api/extension/import-pdf, /api/extension/confirm),
 * steal session tokens, and create fraudulent orders.
 *
 * Configure EXTENSION_ALLOWED_IDS as a comma-separated list of full origins:
 *   EXTENSION_ALLOWED_IDS=chrome-extension://abc123...,chrome-extension://def456...
 *
 * In dev (NODE_ENV !== 'production') and EXTENSION_ALLOWED_IDS is unset,
 * the helper falls back to allowing any chrome-extension:// origin so that
 * local development with an unpacked extension still works. Production MUST
 * set the env var (enforced by assertRequiredEnvVars in startup-checks.ts).
 */

function getAllowedExtensionOrigins(): string[] {
  const raw = process.env.EXTENSION_ALLOWED_IDS ?? ''
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
}

function isAllowedOrigin(origin: string): boolean {
  if (!origin.startsWith('chrome-extension://')) return false

  const allowed = getAllowedExtensionOrigins()

  // Production: strict allowlist enforcement
  if (allowed.length > 0) {
    return allowed.includes(origin)
  }

  // Dev fallback: allow any chrome-extension:// origin so local unpacked
  // extensions can be tested without env config. Production startup checks
  // ensure EXTENSION_ALLOWED_IDS is always set in prod.
  if (process.env.NODE_ENV !== 'production') return true

  return false
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || ''
  const allowed = isAllowedOrigin(origin)
  return {
    'Access-Control-Allow-Origin': allowed ? origin : '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}
