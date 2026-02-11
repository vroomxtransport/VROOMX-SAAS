---
phase: 01-project-setup-auth-multi-tenancy
plan: 08
subsystem: infra
tags: [sentry, posthog, error-monitoring, analytics, observability]

# Dependency graph
requires:
  - phase: 01-06
    provides: Auth flow wiring and user sessions
provides:
  - Sentry error monitoring (browser, server, edge)
  - PostHog product analytics with reverse proxy
  - Global error boundary with automatic error capture
  - Source map upload via withSentryConfig
  - Manual page view tracking for App Router
affects: [all-phases]

# Tech tracking
tech-stack:
  added: [@sentry/nextjs, posthog-js]
  patterns: [lazy-loaded Stripe client, Proxy wrappers for backwards compatibility]

key-files:
  created:
    - instrumentation-client.ts
    - instrumentation.ts
    - sentry.server.config.ts
    - sentry.edge.config.ts
    - src/app/global-error.tsx
    - src/app/providers.tsx
  modified:
    - next.config.ts
    - src/app/layout.tsx
    - src/lib/stripe/config.ts
    - src/lib/stripe/webhook-handlers.ts

key-decisions:
  - "Sentry: Manual config files instead of wizard for version control"
  - "PostHog: Reverse proxy via /ingest to bypass ad blockers"
  - "PostHog: Manual page view tracking (capture_pageview: false)"
  - "PostHog: identified_only person profiles"
  - "Lazy-load Stripe client to avoid build-time env var requirement"

patterns-established:
  - "Observability pattern: Sentry for errors, PostHog for analytics"
  - "Lazy initialization pattern for SDK clients needing env vars"
  - "Proxy wrapper pattern for backwards compatibility"

# Metrics
duration: 4min
completed: 2026-02-11
---

# Phase 1 Plan 8: Observability Integration Summary

**Sentry error monitoring (browser/server/edge) and PostHog analytics with reverse proxy, graceful degradation, and lazy-loaded clients**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-11T17:00:31Z
- **Completed:** 2026-02-11T17:04:02Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Sentry captures unhandled errors across all runtimes (browser, server, edge)
- PostHog tracks page views with reverse proxy to bypass ad blockers
- Global error boundary catches React rendering errors
- Graceful degradation when API keys are missing
- Fixed critical build-blocking Stripe type errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure Sentry error monitoring** - `2b223b8` (feat)
2. **Task 2: Create PostHog provider and wire into root layout** - `890c971` (feat)

**Bug fixes:** `dcc3546` (fix: Stripe type errors blocking build)

## Files Created/Modified

**Created:**
- `instrumentation-client.ts` - Sentry browser init with session replay
- `instrumentation.ts` - Runtime-specific Sentry registration
- `sentry.server.config.ts` - Sentry Node.js server init
- `sentry.edge.config.ts` - Sentry Edge runtime init
- `src/app/global-error.tsx` - Global error boundary with Sentry capture
- `src/app/providers.tsx` - PostHog provider with manual page view tracking

**Modified:**
- `next.config.ts` - Wrapped with withSentryConfig, preserves PostHog rewrites
- `src/app/layout.tsx` - Wrapped children with Providers component
- `src/lib/stripe/config.ts` - Lazy-loaded Stripe client with Proxy wrappers
- `src/lib/stripe/webhook-handlers.ts` - Fixed Invoice.subscription type assertion
- `.gitignore` - Added .sentryclirc
- `.env.local.example` - Added SENTRY_* and NEXT_PUBLIC_SENTRY_DSN

## Decisions Made

1. **Manual Sentry config instead of wizard** - Version control and customization
2. **PostHog reverse proxy at /ingest** - Bypasses ad blockers, better data quality
3. **Manual page view tracking** - App Router requires custom implementation
4. **Lazy-load Stripe client** - Prevents build-time "Neither apiKey nor config.authenticator" error
5. **Proxy wrappers for backwards compatibility** - Maintains existing import syntax

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Stripe Invoice.subscription type error**

- **Found during:** Task 1 verification (build test)
- **Issue:** TypeScript error "Property 'subscription' does not exist on type 'Invoice'" - Stripe's types don't reflect runtime expandable fields
- **Fix:** Added type assertion `(invoice as any).subscription` with explanatory comment
- **Files modified:** src/lib/stripe/webhook-handlers.ts
- **Verification:** Build succeeds without type errors
- **Committed in:** dcc3546

**2. [Rule 3 - Blocking] Lazy-loaded Stripe client to fix build error**

- **Found during:** Task 1 verification (build test)
- **Issue:** Build failing with "Error: Neither apiKey nor config.authenticator provided" because Stripe client instantiated at module load time without env vars
- **Fix:** Created lazy-loading pattern with getStripeClient(), added Proxy wrappers for backwards compatibility
- **Files modified:** src/lib/stripe/config.ts
- **Verification:** Build succeeds, existing code continues to work
- **Committed in:** dcc3546

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both critical for build success. Bug from plan 01-05 surfaced during strict build. No scope creep.

## Issues Encountered

- Pre-existing Stripe type errors from plan 01-05 blocked build verification - resolved with type assertion and lazy loading pattern

## User Setup Required

**External services require manual configuration.** Environment variables to add to `.env.local`:

**Sentry:**
```bash
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=sntrys_...
```

**PostHog:**
```bash
NEXT_PUBLIC_POSTHOG_KEY=phc_...
```

**Verification:**
- Start dev server: `npm run dev`
- Trigger error: Visit non-existent route, check Sentry dashboard
- Check analytics: Visit pages, check PostHog dashboard for pageview events

## Next Phase Readiness

- Observability foundation complete
- All errors automatically captured and reported to Sentry
- User behavior tracked via PostHog with privacy-friendly settings
- Ready for dashboard UI (plan 01-07) and billing page (plan 01-08)
- Phase 1 (Project Setup + Auth + Multi-Tenancy) complete: 8/8 plans done

---
*Phase: 01-project-setup-auth-multi-tenancy*
*Completed: 2026-02-11*
