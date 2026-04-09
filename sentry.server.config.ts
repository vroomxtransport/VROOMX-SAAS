import * as Sentry from '@sentry/nextjs'

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
  // CFG-005 + HIGH-4: adaptive sampling. Webhooks and cron are always
  // traced (low volume, high criticality). Server actions get 50% to
  // catch auth/payment anomalies. Everything else stays at 10%.
  tracesSampler: ({ name, parentSampled }) => {
    if (parentSampled !== undefined) return parentSampled
    if (name?.includes('/api/webhooks') || name?.includes('/api/cron')) return 1.0
    if (name?.includes('/api/') || name?.includes('actions')) return 0.5
    return 0.1
  },
  // CFG-005: strip cookies, auth headers, and well-known PII keys from
  // every transaction before it leaves the server. Breadcrumbs/spans
  // containing HTTP headers are the primary leak surface on the server.
  beforeSendTransaction(event) {
    if (event.request) {
      // Sentry types cookies as Record<string, string>; scrub by replacing
      // each value with the [Filtered] marker rather than by assigning a
      // string to the whole field.
      if (event.request.cookies) {
        const cookies = event.request.cookies as Record<string, string>
        for (const key of Object.keys(cookies)) {
          cookies[key] = SCRUBBED
        }
      }
      if (event.request.headers) {
        const headers = event.request.headers as Record<string, string>
        for (const key of Object.keys(headers)) {
          const lower = key.toLowerCase()
          if (lower === 'cookie' || lower === 'authorization' || lower === 'x-api-key') {
            headers[key] = SCRUBBED
          }
        }
      }
      if (event.request.data) {
        event.request.data = scrubValue(event.request.data)
      }
    }
    return event
  },
  // CFG-005: strip PII from error events server-side. Shape mirrors
  // the client-side scrubber in instrumentation-client.ts so fields
  // that survive one layer are caught by the other.
  beforeSend(event) {
    if (event.extra) event.extra = scrubValue(event.extra) as typeof event.extra
    if (event.contexts) event.contexts = scrubValue(event.contexts) as typeof event.contexts
    if (event.request?.data) {
      event.request.data = scrubValue(event.request.data)
    }
    if (event.user) {
      event.user = scrubValue(event.user) as typeof event.user
    }
    // Breadcrumbs carry a `data` field with HTTP URLs, response bodies,
    // and console args — a TMS log line like "Loading order {vin:...}"
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
