---
phase: 01-project-setup-auth-multi-tenancy
plan: 03
subsystem: auth
tags: [supabase, ssr, auth, next16, proxy, session-management]

# Dependency graph
requires:
  - phase: 01-01
    provides: Next.js 16 scaffold with app directory structure
provides:
  - Browser Supabase client factory for client components
  - Server Supabase client factory for Server Components and Server Actions
  - Service role client factory for admin operations (bypasses RLS)
  - Next.js 16 proxy with auth session refresh on every request
  - Route protection logic (login, onboarding, dashboard redirects)
affects: [01-04, 01-05, 01-06, 01-07, 01-08, auth, api, dashboard]

# Tech tracking
tech-stack:
  added: [@supabase/ssr, @supabase/supabase-js]
  patterns: [Supabase client factories, Next.js 16 proxy pattern, server-side token validation with getUser()]

key-files:
  created:
    - src/lib/supabase/client.ts
    - src/lib/supabase/server.ts
    - src/lib/supabase/service-role.ts
    - src/lib/supabase/proxy.ts
    - proxy.ts
  modified: []

key-decisions:
  - "Use NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (new naming convention for projects created after Nov 2025)"
  - "Use getUser() not getSession() in proxy for server-side token validation"
  - "Next.js 16 proxy.ts at root (replaces middleware.ts) with proxy export function"
  - "Exclude PostHog /ingest path from proxy matcher to avoid auth checks on analytics"

patterns-established:
  - "Three-tier client pattern: browser (client components), server (Server Components/Actions), service-role (admin)"
  - "Async cookies() in Next.js 16 server client with try/catch in setAll for Server Component compatibility"
  - "Route protection: unauthenticated → /login, authenticated without tenant → /onboarding, authenticated with tenant away from auth pages"

# Metrics
duration: 2min
completed: 2026-02-11
---

# Phase 01 Plan 03: Supabase Client Factories & Proxy Summary

**Supabase SSR client factories (browser, server, service-role) and Next.js 16 proxy with session refresh and three-tier route protection**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-11T21:42:57Z
- **Completed:** 2026-02-11T21:44:24Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Three Supabase client factories: browser (createBrowserClient), server (createServerClient with async cookies), service-role (bypasses RLS)
- Next.js 16 proxy.ts at project root with session update logic
- Token refresh on every request to protected routes
- Three route protection rules: /dashboard requires auth and tenant, authenticated users with tenant redirected away from /login and /signup, authenticated users without tenant redirected to /onboarding

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Supabase client factories (browser, server, service-role)** - `487b95f` (feat)
2. **Task 2: Create Next.js 16 proxy.ts for auth session refresh and route protection** - `cb474c4` (feat)

## Files Created/Modified
- `src/lib/supabase/client.ts` - Browser client factory using createBrowserClient (for client components)
- `src/lib/supabase/server.ts` - Server client factory with async cookies() (for Server Components and Server Actions)
- `src/lib/supabase/service-role.ts` - Service role client with SUPABASE_SECRET_KEY (admin operations, bypasses RLS)
- `src/lib/supabase/proxy.ts` - Session update logic with token refresh and route protection
- `proxy.ts` - Next.js 16 proxy at project root (replaces middleware.ts)

## Decisions Made
- **NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:** Used new naming convention (replaces ANON_KEY for projects created after Nov 2025)
- **getUser() not getSession():** Server-side token validation in proxy uses getUser() for proper token verification
- **Next.js 16 proxy pattern:** File named proxy.ts at root (not middleware.ts) with export named proxy (not middleware)
- **PostHog path exclusion:** /ingest excluded from proxy matcher to avoid auth checks on analytics reverse proxy
- **Async cookies():** Next.js 16 requires await cookies() in server client factory
- **try/catch in setAll:** Server Components can read but not set cookies, so setAll has try/catch (proxy handles refresh)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required in this plan. Environment variables (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY) will be configured in plan 01-02.

## Next Phase Readiness

**Ready for:**
- Plan 01-04 (Login/Signup pages) can now use browser client factory
- Plan 01-05+ (Server Actions, API routes) can use server client factory
- Admin operations can use service-role client to bypass RLS

**Auth plumbing complete:**
- Token refresh happens automatically on every request via proxy
- Route protection enforces auth + tenant requirements
- Three client tiers enable proper separation of concerns

**No blockers or concerns.**

---
*Phase: 01-project-setup-auth-multi-tenancy*
*Completed: 2026-02-11*
