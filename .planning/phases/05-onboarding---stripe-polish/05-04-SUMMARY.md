---
phase: 05-onboarding---stripe-polish
plan: 04
subsystem: auth
tags: [invites, react-email, resend, server-actions, team-management, settings, multi-tenancy]

# Dependency graph
requires:
  - phase: 05-onboarding---stripe-polish
    plan: 01
    provides: invites table, InviteStatus/InvitableRole types, invite Zod schema
  - phase: 05-onboarding---stripe-polish
    plan: 02
    provides: checkTierLimit and hasMinRole utility functions
  - phase: 05-onboarding---stripe-polish
    plan: 03
    provides: createBillingPortalSession Server Action, BillingSection component
  - phase: 01-project-setup
    provides: Supabase client factories, auth actions, login/signup pages, Resend client
provides:
  - sendInvite Server Action (validates, creates invite, sends React Email via Resend)
  - revokeInvite Server Action (marks invite as revoked)
  - InviteEmail React Email template for team invitations
  - Invite accept route at /invite/accept (token validation, membership creation, app_metadata update)
  - Login page with invite_token preservation and invite banner
  - Signup page with invite_token support (hides plan/company fields for invited users)
  - Auth actions with invite_token redirect to /invite/accept
  - Settings page with team members list and pending invites management
  - TeamSection component with invite form, member list, and pending invites
affects:
  - 05-05 (settings page may need onboarding wizard integration)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "React Email template with Resend react: prop (no @react-email/render needed)"
    - "invite_token flow through login/signup hidden inputs to auth actions"
    - "Invited signup skips tenant/Stripe creation, redirects to accept route"
    - "Service role for cross-tenant invite operations"

key-files:
  created:
    - src/app/actions/invites.ts
    - src/components/email/invite-email.tsx
    - src/app/(auth)/invite/accept/route.ts
    - src/app/(dashboard)/settings/team-section.tsx
  modified:
    - src/app/(auth)/login/page.tsx
    - src/app/(auth)/signup/page.tsx
    - src/app/actions/auth.ts
    - src/app/(dashboard)/settings/page.tsx

key-decisions:
  - "Use Resend react: prop instead of @react-email/render for email rendering"
  - "Skip tenant/Stripe creation for invited signups (cleaner than creating placeholder tenant)"
  - "NEXT_REDIRECT digest re-throw pattern in accept route try/catch"
  - "Preserve existing BillingSection/UsageSection, add TeamSection below"
  - "URL searchParams error display on login page for invite errors"
  - "Suspense wrapper required for useSearchParams in Next.js App Router"

patterns-established:
  - "invite_token hidden input through auth flow for post-auth redirect"
  - "Team management as settings sub-section with role-gated visibility"

# Metrics
duration: 4min
completed: 2026-02-12
---

# Phase 5 Plan 04: Team Invite Flow Summary

**Complete team invite flow with React Email template, accept route, invite_token wiring through login/signup, and settings page team management**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-12T09:27:24Z
- **Completed:** 2026-02-12T09:31:51Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Built sendInvite Server Action with role/permission checks, tier limit enforcement, duplicate detection, and Resend email delivery
- Created invite accept route that validates token/expiry, adds user to tenant_memberships, updates app_metadata with tenant_id/role
- Wired invite_token through login/signup pages via hidden form fields, preserving token across auth flow for automatic post-auth invite acceptance
- Extended existing settings page with TeamSection: invite form, team member list with avatars/badges, and pending invites with revoke capability

## Task Commits

Each task was committed atomically:

1. **Task 1: Invite Server Actions, email template, accept route, and invite_token wiring** - `bf77562` (feat)
2. **Task 2: Settings page with team management section** - `4b493cc` (feat)

## Files Created/Modified
- `src/app/actions/invites.ts` - sendInvite and revokeInvite Server Actions with tier/role checks
- `src/components/email/invite-email.tsx` - React Email template for team invitations
- `src/app/(auth)/invite/accept/route.ts` - GET route handler for invite token validation and acceptance
- `src/app/(auth)/login/page.tsx` - Added invite_token support, Suspense wrapper, invite banner
- `src/app/(auth)/signup/page.tsx` - Added invite_token support, hidden plan/company fields for invited users
- `src/app/actions/auth.ts` - loginAction and signUpAction redirect to /invite/accept when invite_token present
- `src/app/(dashboard)/settings/page.tsx` - Extended with team members, pending invites fetching, TeamSection
- `src/app/(dashboard)/settings/team-section.tsx` - Client component for invite form, member list, pending invites

## Decisions Made
- Used Resend `react:` prop directly instead of `@react-email/render` -- matches existing invoice email pattern, no extra dependency needed
- Invited signups skip tenant/Stripe creation entirely (steps 3-7) -- cleaner than creating unused placeholder tenant and Stripe customer
- NEXT_REDIRECT digest re-throw pattern in accept route catch block -- prevents swallowing Next.js redirect throws
- Preserved existing BillingSection and UsageSection on settings page, added TeamSection below the grid
- Added URL searchParams error display on login page for invite-related errors (expired, invalid tokens)
- Wrapped login and signup pages in Suspense -- required by useSearchParams in Next.js App Router client components

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing settings page with BillingSection and UsageSection**
- **Found during:** Task 2 (Settings page creation)
- **Issue:** Plan assumed settings page didn't exist; it already had BillingSection and UsageSection from Phase 05-03
- **Fix:** Extended existing page instead of replacing it; added TeamSection below the existing grid layout
- **Files modified:** src/app/(dashboard)/settings/page.tsx
- **Verification:** TypeScript compiles, existing components preserved
- **Committed in:** 4b493cc (Task 2 commit)

**2. [Rule 1 - Bug] NEXT_REDIRECT re-throw in accept route**
- **Found during:** Task 1 (Accept route creation)
- **Issue:** Plan's accept route had generic catch block that would swallow Next.js redirect() throws
- **Fix:** Added NEXT_REDIRECT digest detection and re-throw before error logging
- **Files modified:** src/app/(auth)/invite/accept/route.ts
- **Verification:** TypeScript compiles, redirect pattern matches billing.ts approach
- **Committed in:** bf77562 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - uses existing Resend and Supabase configuration from earlier phases.

## Next Phase Readiness
- Team invite flow fully functional: send, accept, revoke
- Settings page complete with billing, usage, and team management
- invite_token preserved through full login/signup flow
- All 8 existing tests pass
- TypeScript compiles cleanly
- Ready for Plan 05 (onboarding wizard or remaining polish)

---
*Phase: 05-onboarding---stripe-polish*
*Completed: 2026-02-12*
