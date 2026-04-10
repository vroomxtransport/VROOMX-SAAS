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

// MAPBOX-08: edge runtime previously had ZERO scrubbing. The middleware
// runs in Edge and could ship request URLs, headers, and breadcrumb data
// to Sentry without filtering. This file mirrors the scrubber from
// sentry.server.config.ts and instrumentation-client.ts to close that
// gap. Kept inline (not imported) so the edge bundle stays minimal.
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

const URL_KEY_PATTERNS = [
  /^url$/i,
  /^http\.url$/i,
  /^request\.url$/i,
  /^url\.full$/i,
  /^http\.target$/i,
]

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
  tracesSampleRate: 1.0,
  beforeSend(event) {
    return scrubEvent(event)
  },
  beforeSendTransaction(event) {
    return scrubEvent(event)
  },
})
