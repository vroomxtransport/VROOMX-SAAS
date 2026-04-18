import type { NextConfig } from 'next'
import bundleAnalyzer from '@next/bundle-analyzer'
import withSerwistInit from '@serwist/next'
import { withSentryConfig } from '@sentry/nextjs'

// ---------------------------------------------------------------------------
// Build-time environment variable validation
// ---------------------------------------------------------------------------
// CodeAuditX #9: catch missing env vars during `next build` instead of at
// runtime. Prior to this, `instrumentation.ts` called assertRequiredEnvVars()
// on the first serverless cold-start — which meant a broken Netlify deploy
// could complete successfully and only fail on the first real request.
//
// This block runs ONLY for production builds (`NEXT_PHASE === 'phase-production-build'`).
// Dev / test / runtime evaluations of next.config.ts skip it so local `npm run
// dev` doesn't require every integration credential. Runtime boot is still
// covered by instrumentation.ts -> assertRequiredEnvVars().
//
// The list below is a STRICT subset of src/lib/startup-checks.ts's REQUIRED_ENV:
// only the vars whose absence would break a build in a way the runtime check
// can't recover from. The runtime check still enforces the full list.
//
// Don't use a static `import` from src/lib here — next.config.ts runs in a
// different module resolution context than the src/ tree and static imports
// cross that boundary inconsistently across Next.js versions. Inline is safer.
// ---------------------------------------------------------------------------

interface BuildTimeEnvCheck {
  name: string
  aliases?: string[]
  description: string
}

const BUILD_TIME_REQUIRED: BuildTimeEnvCheck[] = [
  { name: 'NEXT_PUBLIC_SUPABASE_URL', description: 'Supabase project URL' },
  { name: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', description: 'Supabase anon key' },
  {
    name: 'SUPABASE_SECRET_KEY',
    aliases: ['SUPABASE_SERVICE_ROLE_KEY'],
    description: 'Supabase service-role key (either name accepted)',
  },
  { name: 'DATABASE_URL', description: 'Postgres pooled connection (PgBouncer 6543)' },
  { name: 'STRIPE_SECRET_KEY', description: 'Stripe API key' },
  { name: 'STRIPE_WEBHOOK_SECRET', description: 'Stripe webhook signing secret' },
  { name: 'NEXT_PUBLIC_APP_URL', description: 'Canonical app URL for Stripe checkout redirects' },
  { name: 'NEXT_PUBLIC_SENTRY_DSN', description: 'Sentry DSN for error tracking' },
]

function validateBuildTimeEnv(): void {
  // Only enforce during production builds. NEXT_PHASE is set by Next.js
  // during `next build`; local dev server (`next dev`) sets it to
  // 'phase-development-server' and runtime evaluations have no phase set.
  if (process.env.NEXT_PHASE !== 'phase-production-build') return

  const missing: BuildTimeEnvCheck[] = []
  for (const check of BUILD_TIME_REQUIRED) {
    if (process.env[check.name]) continue
    if (check.aliases?.some((alias) => process.env[alias])) continue
    missing.push(check)
  }

  if (missing.length === 0) return

  const lines = missing.map((m) => `  - ${m.name}: ${m.description}`)
  const message = [
    '[next.config] Build-time env var check failed — missing required variables:',
    ...lines,
    '',
    'Set these in your Netlify dashboard (Site → Environment variables) or .env.local before running `next build`.',
    'The runtime assertRequiredEnvVars() in src/lib/startup-checks.ts enforces a broader list on first boot.',
  ].join('\n')

  throw new Error(message)
}

validateBuildTimeEnv()

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
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'api.mapbox.com' },
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
