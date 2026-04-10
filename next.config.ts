import type { NextConfig } from 'next'
import bundleAnalyzer from '@next/bundle-analyzer'
import withSerwistInit from '@serwist/next'
import { withSentryConfig } from '@sentry/nextjs'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  // Disable the service worker in development to avoid confusing caching
  // behaviour while hot-reloading. The offline fallback and precaching
  // are production concerns only.
  disable: process.env.NODE_ENV === 'development',
})

// Static security headers. Content-Security-Policy is NOT in this list —
// it is set per-request by middleware.ts (H2 fix) so each response carries
// a fresh nonce. The static-headers approach was abandoned because it
// required `'unsafe-inline'` and `'unsafe-eval'` in `script-src`, which
// effectively disabled CSP as an XSS mitigation.
const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
]

const nextConfig: NextConfig = {
  // Force Next/Turbopack to re-resolve these packages through its own module
  // pipeline. Without this, in production builds Turbopack picks the wrong
  // `esm-env` export condition for client chunks (`production`/`development`
  // win over `browser`), so `BROWSER` resolves to `false` and the
  // `<number-flow-react>` custom element never gets registered via
  // `customElements.define()`. Result: the SSR fallback HTML (the full 0-9
  // digit tape that would normally be clipped by shadow DOM) leaks through
  // as plain text on the landing and pricing pages. Including `esm-env`
  // explicitly is the load-bearing piece.
  transpilePackages: ['@number-flow/react', 'number-flow', 'esm-env'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      // SCAN-004: /api/extension/* CORS is handled per-request inside each
      // route (OPTIONS + GET/POST) via `corsHeaders()` from
      // src/lib/extension/cors.ts, which enforces the EXTENSION_ALLOWED_IDS
      // allowlist. A previous static `Access-Control-Allow-Origin: *` rule
      // here silently overrode that allowlist and exposed extension
      // endpoints to any origin. Leave CORS to the route handlers.
    ]
  },
  async rewrites() {
    return [
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ]
  },
}

// Wrapper order (outermost → innermost):
//   withSentryConfig → withSerwist → withBundleAnalyzer → nextConfig
//
// withSerwist must wrap the core config (not Sentry) so that Sentry's
// sourcemap upload plugin runs on the already-compiled service worker output.
export default withSentryConfig(withSerwist(withBundleAnalyzer(nextConfig)), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
})
