import * as Sentry from '@sentry/nextjs'

// Permissive event shape — see sentry.server.config.ts for rationale.
type ScrubbableEvent = {
  extra?: unknown
  contexts?: unknown
  user?: unknown
  request?: {
    url?: string
    cookies?: Record<string, string>
    headers?: Record<string, string>
    data?: unknown
  }
  spans?: Array<{ data?: unknown } & Record<string, unknown>>
  breadcrumbs?: Array<{ data?: Record<string, unknown> } & Record<string, unknown>>
}

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
  /authorization/i,
  /cookie/i,
]

const SCRUBBED = '[Filtered]'

// MAPBOX-01: Keys whose string values are URLs. We strip the query string
// from these values before they reach Sentry so that third-party API tokens
// passed as query params never leak into breadcrumbs or span attributes.
// Defense-in-depth mirror of the server-side scrubber in
// sentry.server.config.ts — client bundles don't currently hit Mapbox
// directly, but this closes the class of bug for future integrations.
// Includes `url.full` / `http.target` for parity even though browser SDK
// uses `http.url` — keeps drift between configs to zero.
const URL_KEY_PATTERNS = [
  /^url$/i,
  /^http\.url$/i,
  /^request\.url$/i,
  /^url\.full$/i,
  /^http\.target$/i,
]

// MAPBOX-06: Keys whose string values are RAW query strings. Sentry's
// browser fetch instrumentation writes the parsed query string under a
// separate `http.query` key, bypassing the `url` strip above. The whole
// VALUE is sensitive here, so we replace with [Filtered].
const QUERY_KEY_PATTERNS = [
  /^http\.query$/i,
  /^http\.fragment$/i,
  /^url\.query$/i,
  /^url\.fragment$/i,
  /^query[_.-]?string$/i,
]

function stripQueryString(urlString: string): string {
  const idx = urlString.indexOf('?')
  if (idx === -1) return urlString
  return urlString.slice(0, idx)
}

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
      } else if (QUERY_KEY_PATTERNS.some((re) => re.test(k)) && typeof v === 'string') {
        out[k] = SCRUBBED
      } else if (URL_KEY_PATTERNS.some((re) => re.test(k)) && typeof v === 'string') {
        out[k] = stripQueryString(v)
      } else {
        out[k] = scrubValue(v, seen)
      }
    }
    return out
  }
  return value
}

// MAPBOX-07: Centralized event scrubber covering ALL leak surfaces.
// See sentry.server.config.ts::scrubEvent for the full rationale.
function scrubEvent<T>(input: T): T {
  const event = input as unknown as ScrubbableEvent
  if (event.extra) {
    event.extra = scrubValue(event.extra)
  }
  if (event.contexts) {
    event.contexts = scrubValue(event.contexts)
  }
  if (event.user) {
    event.user = scrubValue(event.user)
  }
  if (event.request) {
    if (event.request.cookies) {
      for (const key of Object.keys(event.request.cookies)) {
        event.request.cookies[key] = SCRUBBED
      }
    }
    if (event.request.headers) {
      for (const key of Object.keys(event.request.headers)) {
        const lower = key.toLowerCase()
        if (lower === 'cookie' || lower === 'authorization' || lower === 'x-api-key') {
          event.request.headers[key] = SCRUBBED
        }
      }
    }
    if (event.request.data) {
      event.request.data = scrubValue(event.request.data)
    }
    if (typeof event.request.url === 'string') {
      event.request.url = stripQueryString(event.request.url)
    }
  }
  if (Array.isArray(event.spans)) {
    event.spans = event.spans.map((s) => {
      if (s && typeof s === 'object' && s.data) {
        return { ...s, data: scrubValue(s.data) }
      }
      return s
    })
  }
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      data: b.data ? (scrubValue(b.data) as Record<string, unknown>) : b.data,
    }))
  }
  return input
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
  // CFG-003 + MAPBOX-01/06/07: strip PII and tokens from captured error
  // events before they leave the browser. Covers all leak surfaces:
  // event.extra, event.contexts, event.request.{data,url}, event.user,
  // event.spans[*].data, event.breadcrumbs[*].data.
  beforeSend(event) {
    return scrubEvent(event)
  },
  // MAPBOX-07: scrub transaction events the same way as errors.
  // Previously transactions bypassed all scrubbing, so any HTTP span
  // attached to a sampled transaction (10% rate) would ship http.url
  // and http.query unscrubbed.
  beforeSendTransaction(event) {
    return scrubEvent(event)
  },
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
