import type { NextConfig } from 'next'
import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
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

import { withSentryConfig } from '@sentry/nextjs'

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
})
