import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
