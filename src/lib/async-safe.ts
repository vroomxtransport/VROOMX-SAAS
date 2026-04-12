/**
 * Fire-and-forget error handler for async side-effects.
 *
 * N10: replaces the `.catch(() => {})` anti-pattern across 79 callsites.
 * Instead of silently swallowing errors, this logs them server-side and
 * reports to Sentry so ops has visibility into integration failures
 * (QB sync, webhook dispatch, audit logging, geocoding, etc.).
 *
 * Usage:
 *   void syncBrokerToQB(supabase, tenantId, id).catch(captureAsyncError('QB broker sync'))
 *
 * The returned function is a no-op catch handler that never re-throws,
 * so it's safe for fire-and-forget patterns where the caller doesn't
 * care about the result.
 */
export function captureAsyncError(context: string): (error: unknown) => void {
  return (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[${context}] async side-effect failed:`, message)

    // Lazy-import Sentry to avoid bundling it in client components that
    // might accidentally import this module. The dynamic import is cached
    // by the runtime after the first call.
    void import('@sentry/nextjs').then((Sentry) => {
      Sentry.captureException(error, {
        tags: { context, source: 'async-safe' },
      })
    }).catch(() => {
      // If Sentry itself fails to load (edge case: bundle issue),
      // the console.error above already has the message. Don't recurse.
    })
  }
}
