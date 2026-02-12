---
phase: 07-polish-launch-prep
plan: 02
subsystem: ui
tags: [next.js, error-boundary, loading-state, 404, sentry, skeleton, app-router]

# Dependency graph
requires:
  - phase: 01-project-setup
    provides: "Sentry integration, shadcn/ui components (Button, Skeleton), App Router layout structure"
provides:
  - "Root 404 page with styled layout and home navigation"
  - "Root error boundary with Sentry reporting and retry"
  - "Dashboard error boundary with Sentry, retry, and dashboard fallback"
  - "Dashboard loading skeleton with card grid layout"
  - "Dashboard 404 page within layout context"
  - "Auth error boundary with Sentry and login fallback"
  - "Auth loading skeleton matching form layout"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Error boundaries with Sentry.captureException in useEffect"
    - "Loading skeletons using shadcn Skeleton component"
    - "Route-group-specific error/loading/404 using App Router file conventions"
    - "min-h-[400px] for dashboard content area (sidebar already provides full height)"
    - "min-h-screen for root/auth pages (no surrounding layout)"

key-files:
  created:
    - src/app/not-found.tsx
    - src/app/error.tsx
    - src/app/(dashboard)/error.tsx
    - src/app/(dashboard)/loading.tsx
    - src/app/(dashboard)/not-found.tsx
    - src/app/(auth)/error.tsx
    - src/app/(auth)/loading.tsx
  modified: []

key-decisions:
  - "Dashboard error/404 use min-h-[400px] since sidebar provides full height"
  - "Auth error uses min-h-screen to match auth layout centering"
  - "Error digest displayed in small muted text when available"
  - "Dashboard loading shows 2x2 card grid + content area skeleton"
  - "Auth loading shows card with form field skeletons matching login dimensions"

patterns-established:
  - "Error boundary pattern: 'use client', Sentry.captureException in useEffect, retry + fallback nav"
  - "Loading skeleton pattern: Server Component, Skeleton imports, layout-appropriate dimensions"
  - "Not-found pattern: Server Component, styled 404 heading, contextual back navigation"

# Metrics
duration: 2min
completed: 2026-02-12
---

# Phase 7 Plan 02: Error Boundaries, Loading States, and 404 Pages Summary

**7 App Router convention files for error boundaries (Sentry), loading skeletons (shadcn), and 404 pages across root, dashboard, and auth route groups**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-12T11:46:20Z
- **Completed:** 2026-02-12T11:48:10Z
- **Tasks:** 2
- **Files created:** 7

## Accomplishments
- Root-level 404 page and error boundary with Sentry reporting
- Dashboard route group: error boundary with Sentry + retry, skeleton loading state with card grid, contextual 404
- Auth route group: error boundary with Sentry + login fallback, form-shaped skeleton loading state
- All error boundaries automatically report to Sentry via captureException
- Existing global-error.tsx (Phase 1) left untouched

## Task Commits

Each task was committed atomically:

1. **Task 1: Root-level not-found and error pages** - `1bd3500` (feat)
2. **Task 2: Dashboard and auth route group error/loading pages** - `0e12e72` (feat)

## Files Created/Modified
- `src/app/not-found.tsx` - Global 404 page with styled layout and home link
- `src/app/error.tsx` - Root error boundary with Sentry, AlertTriangle icon, retry + home
- `src/app/(dashboard)/error.tsx` - Dashboard error boundary with Sentry, retry + dashboard link
- `src/app/(dashboard)/loading.tsx` - Dashboard skeleton: header bar, 2x2 card grid, content area
- `src/app/(dashboard)/not-found.tsx` - Dashboard 404 with dashboard navigation
- `src/app/(auth)/error.tsx` - Auth error boundary with Sentry, retry + login link
- `src/app/(auth)/loading.tsx` - Auth loading skeleton: card with form field placeholders

## Decisions Made
- Dashboard error/404 pages use `min-h-[400px]` instead of `min-h-screen` since the sidebar layout already provides full viewport height
- Auth error page uses `min-h-screen` to match the auth layout's full-screen centering pattern
- Error digest ID displayed in small muted text when available for debugging reference
- Dashboard loading skeleton renders a 2x2 card grid (responsive: 1 col mobile, 2 col lg) plus a large content area, matching typical dashboard page structure
- Auth loading skeleton renders a card with form field skeletons matching login/signup page dimensions (max-w-md)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All route groups now have graceful error handling, loading states, and 404 pages
- Sentry captures all unhandled errors automatically via error boundaries
- No blank white screens or React error stack traces will be shown to users
- Ready for further polish work in Phase 7

---
*Phase: 07-polish-launch-prep*
*Completed: 2026-02-12*
