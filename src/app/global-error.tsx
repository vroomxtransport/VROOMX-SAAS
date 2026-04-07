'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // CFG-010: explicit Sentry capture instead of console.error. Routes
    // through the PII scrubber in instrumentation-client.ts.
    Sentry.captureException(error, {
      tags: { boundary: 'global-error' },
      extra: { digest: error.digest },
    })
  }, [error])

  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Something went wrong</h2>
            <p className="mt-2 text-muted-foreground">
              An unexpected error occurred. Our team has been notified.
            </p>
            <button onClick={reset} className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground">
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
