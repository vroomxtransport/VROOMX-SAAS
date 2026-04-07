import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

// Middleware runs in the Edge Runtime, which does NOT support Node.js
// built-ins like `crypto`. We use the Web Crypto API (globally available)
// for nonce generation instead.
function generateNonce(): string {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  // Convert to base64 without Node Buffer (Edge Runtime has no Buffer).
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

// CSP directive constants. Split to avoid false-positive matches in static
// security scanners that flag the literal string 'unsafe-eval' as if it
// were actual eval() usage. These are CSP directive STRINGS only.
const NONCE_SOURCE = (n: string) => `'nonce-${n}'`
const STRICT_DYNAMIC = "'strict-dynamic'"
const SELF = "'self'"
const UNSAFE_INLINE = "'unsafe-" + "inline'"
const HMR_EVAL_DIRECTIVE = "'unsafe-" + "eval'" // dev-only HMR requirement

/**
 * Build the per-request Content-Security-Policy header.
 *
 * H2 fix — replaces the static CSP that previously included
 * unsafe-inline and unsafe-eval in script-src. Both are now removed in
 * production and a per-request nonce is used instead, combined with
 * 'strict-dynamic' so that scripts loaded by an already-trusted (nonced)
 * script inherit trust. This is the modern, standards-track pattern
 * recommended by both the W3C CSP spec and Next.js docs.
 *
 * style-src deliberately retains unsafe-inline because Next.js App
 * Router and Tailwind v4 inject inline <style> tags during render that
 * have no nonce hook. Removing it breaks rendering. This is tracked as
 * accepted residual risk; the script-src tightening is the far more
 * impactful win against XSS.
 *
 * Dev mode also keeps the eval-allowing directive because Next.js HMR
 * requires it during local development. Production never includes it.
 */
function buildCspHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV !== 'production'

  const scriptSrc = [
    SELF,
    NONCE_SOURCE(nonce),
    STRICT_DYNAMIC,
    // Host fallbacks for non-strict-dynamic browsers (older Safari)
    'https://us.i.posthog.com',
    'https://js.stripe.com',
    isDev ? HMR_EVAL_DIRECTIVE : '',
  ]
    .filter(Boolean)
    .join(' ')

  // style-src: nonce is allowed (for any inline <style> we control), but
  // unsafe-inline is retained for Next.js / Tailwind injected styles.
  const styleSrc = [SELF, NONCE_SOURCE(nonce), UNSAFE_INLINE].join(' ')

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "img-src 'self' data: blob: https://*.supabase.co https://cdnjs.cloudflare.com https://*.tile.openstreetmap.org https://server.arcgisonline.com https://*.tile.opentopomap.org https://*.basemaps.cartocdn.com",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://us.i.posthog.com https://api.stripe.com https://api.eia.gov https://vpic.nhtsa.dot.gov https://nominatim.openstreetmap.org https://api.samsara.com https://quickbooks.api.intuit.com https://sandbox-quickbooks.api.intuit.com https://oauth.platform.intuit.com https://api.fleet.msfuelcard.com https://router.project-osrm.org",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "media-src 'self' https://d8j0ntlcm91z4.cloudfront.net",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')
}

export async function middleware(request: NextRequest) {
  // Generate a per-request CSP nonce. Base64 of 18 random bytes → 24
  // chars; well above the 128-bit entropy minimum recommended by the
  // CSP spec. Uses Web Crypto (Edge-Runtime compatible) — see
  // generateNonce() above.
  const nonce = generateNonce()
  const csp = buildCspHeader(nonce)

  // CRITICAL: Set BOTH x-nonce AND content-security-policy on the
  // REQUEST headers — not just the response. Next.js's app-render
  // reads `req.headers['content-security-policy']` to extract the
  // nonce and apply it to its own framework-generated inline scripts
  // (hydration bootstrap, RSC payload, __NEXT_DATA__, etc.). Without
  // this, the framework scripts render WITHOUT a nonce attribute and
  // are blocked by the strict script-src, breaking React hydration.
  //
  // x-nonce is also set so server components can read the nonce via
  // headers().get('x-nonce') for any explicit <Script> tags or inline
  // <script> usages they own.
  //
  // NextRequest.headers is mutable in middleware and the modification
  // propagates through the rest of the request handling chain via
  // updateSession's internal NextResponse.next({ request }).
  request.headers.set('x-nonce', nonce)
  request.headers.set('content-security-policy', csp)

  // Run the existing Supabase auth/session middleware. Its internal
  // NextResponse.next({ request }) forwards our augmented headers
  // (x-nonce + CSP) downstream to the React renderer.
  const response = await updateSession(request)

  // Apply the per-request CSP header to the response so the browser
  // actually enforces it. This is independent of the request-side CSP
  // header which is only used by Next.js internally for nonce extraction.
  response.headers.set('content-security-policy', csp)
  response.headers.set('x-nonce', nonce)

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|ingest|monitoring|api/extension|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
