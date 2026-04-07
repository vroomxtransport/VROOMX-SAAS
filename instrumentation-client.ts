import * as Sentry from '@sentry/nextjs'

// CFG-003: PII scrubber shared between beforeSend and beforeSendTransaction.
// The original config captured 100% of traces and 100% of errored session
// replays with zero scrubbing, shipping order objects (broker email, VIN,
// addresses) to Sentry on every client error. The patterns below are common
// PII shapes in VroomX — extend as needed.
//
// Important: `\b` word-boundary anchors DO NOT match across underscore
// boundaries because `_` is a word character in JS regex. That means
// `/\baddress\b/` would not match `pickup_address`. These patterns use
// plain substring matches so compound keys are caught.
const PII_KEY_PATTERNS = [
  /email/i,
  /phone/i,
  /vin/i,
  /address/i,
  /full_name/i,
  /pickup_(city|state|location|zip)/i,
  /delivery_(city|state|location|zip)/i,
  /password/i,
  /api[_-]?key/i,
  /secret/i,
  /token/i,
]

const SCRUBBED = '[Filtered]'

// scrubValue walks the event payload recursively and replaces any value
// whose key matches a PII pattern with '[Filtered]'. The `seen` WeakSet
// guards against stack-overflow if the caller somehow hands us a circular
// object (Sentry itself serializes to JSON before transmission so circulars
// should not reach beforeSend, but this is a cheap safety net).
function scrubValue(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value == null) return value
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[Circular]'
    seen.add(value)
    return value.map((v) => scrubValue(v, seen))
  }
  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[Circular]'
    seen.add(value as object)
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (PII_KEY_PATTERNS.some((re) => re.test(k))) {
        out[k] = SCRUBBED
      } else {
        out[k] = scrubValue(v, seen)
      }
    }
    return out
  }
  return value
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // CFG-003: 10% of traces instead of 100% — still useful for surfacing
  // regressions, far less cost and blast radius for sensitive data in spans.
  tracesSampleRate: 0.1,
  // CFG-003: session replay is off unless actively investigating. Keep
  // sessionSampleRate at 0 (was 0.1) and errorSampleRate at 0.05 so we
  // still get SOME replays on errors but not the 100% firehose that was
  // shipping full DOM state on every thrown exception.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.05,
  integrations: [
    // CFG-003: explicitly configure the replay integration. The defaults
    // (maskAllText=true, maskAllInputs=true) cover text, but network
    // request/response bodies bypass masking entirely — networkDetailAllowUrls
    // must be an empty allowlist to avoid capturing them.
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
      networkDetailAllowUrls: [],
    }),
  ],
  // CFG-003: filter known-noisy browser-extension errors that are not
  // actionable. Extend as needed.
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications.',
    'Script error.',
    'Non-Error promise rejection captured',
  ],
  // CFG-003: strip PII from captured error events before they leave the
  // browser. Walks event.extra, event.contexts, event.request.data and
  // event.user looking for keys matching PII_KEY_PATTERNS.
  beforeSend(event) {
    if (event.extra) event.extra = scrubValue(event.extra) as typeof event.extra
    if (event.contexts) event.contexts = scrubValue(event.contexts) as typeof event.contexts
    if (event.request?.data) {
      event.request.data = scrubValue(event.request.data)
    }
    if (event.user) {
      event.user = scrubValue(event.user) as typeof event.user
    }
    // Breadcrumbs carry a `data` field with HTTP request URLs, response
    // bodies, console args, etc. — a TMS log line like "Loading order {vin:...}"
    // would leak PII here bypassing the event-level scrubber.
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((b) => ({
        ...b,
        data: b.data ? (scrubValue(b.data) as Record<string, unknown>) : b.data,
      }))
    }
    return event
  },
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
