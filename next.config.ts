import type { NextConfig } from 'next'

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
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us.i.posthog.com https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://randomuser.me",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://us.i.posthog.com https://api.stripe.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
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

export default nextConfig

// Sentry temporarily disabled to isolate 500 error
// import { withSentryConfig } from '@sentry/nextjs'
// export default withSentryConfig(nextConfig, {
//   org: process.env.SENTRY_ORG,
//   project: process.env.SENTRY_PROJECT,
//   silent: !process.env.CI,
//   widenClientFileUpload: true,
//   tunnelRoute: '/monitoring',
// })
