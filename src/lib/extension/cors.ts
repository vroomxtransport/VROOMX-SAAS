/**
 * CORS helpers for Chrome extension API routes.
 *
 * Allows requests from Chrome extensions while blocking unknown origins.
 * The next.config.ts headers provide a fallback '*' for preflight,
 * but route handlers enforce the actual origin check.
 */

const ALLOWED_ORIGINS = [
  'chrome-extension://', // Allow any Chrome extension
]

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || ''
  const isAllowed = ALLOWED_ORIGINS.some((o) => origin.startsWith(o))
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}
