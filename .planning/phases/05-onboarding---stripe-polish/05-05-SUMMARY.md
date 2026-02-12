---
phase: 05-onboarding---stripe-polish
plan: 05
subsystem: ui
tags: [dashboard, onboarding, settings, billing, usage, dunning, grace-period, suspension, stripe, server-actions]

# Dependency graph
requires:
  - phase: 01-project-setup
    provides: dashboard page, layout, Supabase server client, shadcn/ui components
  - phase: 05-onboarding---stripe-polish
    plan: 01
    provides: tenant onboarding_completed_at column, grace_period_ends_at, is_suspended
  - phase: 05-onboarding---stripe-polish
    plan: 03
    provides: createBillingPortalSession Server Action, billing portal helper
provides:
  - Smart onboarding wizard on dashboard gated by onboarding_completed_at AND entity counts
  - dismissOnboarding Server Action
  - Real entity counts and MTD revenue on dashboard stat cards
  - Grace period amber banner and suspension red banner in layout
  - Settings page with BillingSection and UsageSection components
  - BillingSection with plan info and Manage Subscription button
  - UsageSection with color-coded progress bars and upgrade CTA
affects:
  - 05-04 (settings page created; team section will be added by 05-04)
  - future phases (dashboard and settings are key user-facing pages)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline server actions with dynamic import for conditional loading"
    - "Service role client for cross-table counts (tenant_memberships)"
    - "Smart onboarding gating: requires both null timestamp AND zero counts"

key-files:
  created:
    - src/app/actions/onboarding.ts
    - src/app/(dashboard)/settings/billing-section.tsx
    - src/app/(dashboard)/settings/usage-section.tsx
    - src/app/(dashboard)/settings/page.tsx
  modified:
    - src/app/(dashboard)/dashboard/page.tsx
    - src/app/(dashboard)/layout.tsx

key-decisions:
  - "Onboarding wizard requires BOTH onboarding_completed_at=null AND all entity counts=0"
  - "Inline server actions with dynamic import for billing portal to avoid loading Stripe on every page"
  - "SetupCompleteBanner replaced with inline setup complete banner in dashboard"
  - "Service role client for tenant_memberships count (RLS prevents authenticated user from counting)"
  - "Usage progress bars: blue (<70%), amber (70-90%), red (90%+)"

patterns-established:
  - "Inline server action with dynamic import pattern for conditional module loading"
  - "Color-coded progress bars for resource usage visualization"

# Metrics
duration: 3min
completed: 2026-02-12
---

# Phase 5 Plan 05: Onboarding Wizard + Settings Billing/Usage Summary

**Dashboard onboarding wizard gated by onboarding_completed_at + entity counts, settings page with billing/usage sections, and layout dunning banners with Stripe portal links**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-12T09:27:37Z
- **Completed:** 2026-02-12T09:30:57Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Dashboard shows smart onboarding CTA for new users (gated by onboarding_completed_at=null AND all entity counts=0), with dismiss button that permanently hides it
- Dashboard stat cards now show real truck/driver/order counts and month-to-date revenue instead of hardcoded zeros
- Layout displays amber grace period banner during 14-day dunning window and red suspension banner when account is suspended, both with "Update Payment" buttons linking to Stripe Billing Portal
- Settings page created with BillingSection (plan info, status badge, Manage Subscription button) and UsageSection (truck/user counts with color-coded progress bars and upgrade CTA)

## Task Commits

Each task was committed atomically:

1. **Task 1: Dashboard onboarding wizard, dismiss action, and layout dunning banners** - `00ce331` (feat)
2. **Task 2: Settings page billing and usage sections** - `315d740` (feat)

## Files Created/Modified
- `src/app/actions/onboarding.ts` - dismissOnboarding Server Action sets onboarding_completed_at on tenant
- `src/app/(dashboard)/dashboard/page.tsx` - Smart onboarding CTA, real entity counts, MTD revenue
- `src/app/(dashboard)/layout.tsx` - Grace period and suspension banners with Stripe portal buttons
- `src/app/(dashboard)/settings/billing-section.tsx` - Client component: plan info, status badge, Manage Subscription
- `src/app/(dashboard)/settings/usage-section.tsx` - Server component: truck/user counts with progress bars
- `src/app/(dashboard)/settings/page.tsx` - Settings page with billing and usage sections

## Decisions Made
- Onboarding wizard requires BOTH onboarding_completed_at=null AND all entity counts=0; once dismissed via button it never reappears even if entities are later deleted
- Used inline server actions with dynamic import for billing portal buttons in layout to avoid always loading Stripe code
- Replaced the old SetupCompleteBanner import with inline setup complete banner (the component file didn't exist)
- Used service role client for tenant_memberships count since RLS prevents authenticated user from counting across memberships
- Progress bar color coding: blue for normal (<70%), amber for warning (70-90%), red for critical (90%+)

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 5 is now complete (all 5 plans done)
- Dashboard shows smart onboarding for new users, real stats for existing users
- Settings page has billing management and usage monitoring
- Layout provides clear dunning messaging during grace periods and suspension
- All TypeScript compilation passes cleanly

---
*Phase: 05-onboarding---stripe-polish*
*Completed: 2026-02-12*
