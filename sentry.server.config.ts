import * as Sentry from '@sentry/nextjs'

// Permissive event shape covering both ErrorEvent and TransactionEvent
// fields we touch. Sentry's @sentry/nextjs package doesn't re-export
// the strict union types, so we use an inferred shape that's compatible
// with both — the beforeSend / beforeSendTransaction callbacks below
// pass real Sentry events at runtime.
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

// CFG-005: server-side PII scrubber. Walks arbitrary nested objects
// looking for keys that match common PII shapes in VroomX order/driver
// data. Kept in this file rather than imported from instrumentation-client
// so the server bundle doesn't pull in the client's replay helpers.
//
// Important: `\b` word-boundary anchors DO NOT match across underscore
// boundaries because `_` is a word character in JS regex. Plain substring
// matches are used so compound keys like `pickup_address` and
// `driver_full_name` are caught.
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
// from these values before they reach Sentry because third-party APIs like
// Mapbox and EIA accept their token as a query param (`?access_token=...`,
// `?api_key=...`) and Sentry's default httpIntegration captures the full
// URL in breadcrumbs and span attributes. Without this strip, any order
// that hits a Mapbox error path leaks the token to Sentry.
//
// Coverage:
//   - `url`               — Sentry browser fetch breadcrumb shape, generic
//   - `http.url`          — Sentry browser fetch span shape (semconv legacy)
//   - `request.url`       — Sentry inbound request top-level
//   - `url.full`          — OTEL undici instrumentation (Node fetch),
//                            Sentry v10's primary URL attribute on server
//                            spans. THIS WAS MISSING — leaked the Mapbox
//                            token through every server-side fetch span.
//   - `http.target`       — OTEL inbound request span (pathname + query),
//                            leaks tokens passed via inbound query params
const URL_KEY_PATTERNS = [
  /^url$/i,
  /^http\.url$/i,
  /^request\.url$/i,
  /^url\.full$/i,
  /^http\.target$/i,
]

// MAPBOX-06: Keys whose string values are RAW query strings or fragments
// (e.g. `?access_token=pk...`). Sentry's Node fetch instrumentation writes
// the parsed query string under a separate `http.query` key, bypassing the
// `url` strip above. The whole VALUE is sensitive here, so we replace with
// [Filtered] rather than slicing.
const QUERY_KEY_PATTERNS = [
  /^http\.query$/i,
  /^http\.fragment$/i,
  /^url\.query$/i,
  /^url\.fragment$/i,
  /^query[_.-]?string$/i,
]

function stripQueryString(urlString: string): string {
  // Fast path — no query string, no allocation
  const idx = urlString.indexOf('?')
  if (idx === -1) return urlString
  return urlString.slice(0, idx)
}

// scrubValue walks the event payload recursively and replaces any value
// whose key matches a PII pattern with '[Filtered]'. The `seen` WeakSet
// guards against stack-overflow on circular objects.
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
        // The whole value IS the secret (e.g. `?access_token=pk...`).
        out[k] = SCRUBBED
      } else if (URL_KEY_PATTERNS.some((re) => re.test(k)) && typeof v === 'string') {
        // Strip query string from URL-bearing fields to prevent token leaks.
        out[k] = stripQueryString(v)
      } else {
        out[k] = scrubValue(v, seen)
      }
    }
    return out
  }
  return value
}

// MAPBOX-07: Centralized event scrubber covering ALL leak surfaces:
//   - event.spans[*].data — auto-fetch instrumentation writes http.url,
//     http.query, server.address here. Spans are a top-level sibling of
//     contexts, NOT inside it, so a contexts walk doesn't reach them.
//   - event.request.url — top-level inbound request URL.
//   - event.request.data — request body / form data.
//   - event.breadcrumbs[*].data — fetch breadcrumbs carry url + http.query.
//   - event.contexts.trace.data — root span attributes at capture time.
//   - event.extra / event.user — explicit captures from app code.
//
// Used by both beforeSend (errors) and beforeSendTransaction (perf events)
// so transactions and errors get identical scrubbing.
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
    // MAPBOX-07: top-level request URL can carry tokens for routes like
    // `/api/foo?download_token=...`. Strip the query string.
    if (typeof event.request.url === 'string') {
      event.request.url = stripQueryString(event.request.url)
    }
  }
  // MAPBOX-07: walk every span's data attribute bag. This is where the
  // auto-fetch instrumentation puts http.url, http.query, server.address,
  // etc. The spans array is a top-level sibling of contexts.
  if (Array.isArray(event.spans)) {
    event.spans = event.spans.map((s) => {
      if (s && typeof s === 'object' && s.data) {
        return { ...s, data: scrubValue(s.data) }
      }
      return s
    })
  }
  // Breadcrumbs carry a `data` field with HTTP URLs, response bodies,
  // and console args. Walked in BOTH beforeSend and beforeSendTransaction
  // (the previous version only walked them in beforeSend, leaving
  // transaction-event breadcrumbs unscrubbed).
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      data: b.data ? (scrubValue(b.data) as Record<string, unknown>) : b.data,
    }))
  }
  return input
}

// N22: sampling rates configurable via env vars so operators can adjust
// without a code change + redeploy. Defaults match the previous hard-coded
// values. Set SENTRY_SAMPLE_RATE_API=1.0 to trace all server actions during
// an incident, then reset to 0.5 after.
const SENTRY_SAMPLE_RATE_DEFAULT = parseFloat(process.env.SENTRY_SAMPLE_RATE ?? '0.1')
const SENTRY_SAMPLE_RATE_API = parseFloat(process.env.SENTRY_SAMPLE_RATE_API ?? '0.5')

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // CFG-005 + HIGH-4: adaptive sampling. Webhooks and cron are always
  // traced (low volume, high criticality). Server actions get the API rate.
  // Everything else gets the default rate.
  tracesSampler: ({ name, parentSampled }) => {
    if (parentSampled !== undefined) return parentSampled
    if (name?.includes('/api/webhooks') || name?.includes('/api/cron')) return 1.0
    if (name?.includes('/api/') || name?.includes('actions')) return SENTRY_SAMPLE_RATE_API
    return SENTRY_SAMPLE_RATE_DEFAULT
  },
  // CFG-005: strip cookies, auth headers, well-known PII keys, and
  // third-party API tokens from every transaction before it leaves the
  // server. Breadcrumbs / spans / request URLs are the primary leak
  // surfaces on the server.
  beforeSendTransaction(event) {
    return scrubEvent(event)
  },
  // CFG-005 + MAPBOX-01/06/07: strip PII and tokens from error events.
  beforeSend(event) {
    return scrubEvent(event)
  },
})
