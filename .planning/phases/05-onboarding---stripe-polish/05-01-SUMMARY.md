---
phase: 05-onboarding---stripe-polish
plan: 01
subsystem: database
tags: [sql, drizzle, rls, triggers, invites, tier-enforcement, zod, typescript]

# Dependency graph
requires:
  - phase: 01-project-setup
    provides: tenants table, tenant_memberships, handle_updated_at, get_tenant_id
  - phase: 02-data-model
    provides: trucks table for tier enforcement trigger
provides:
  - invites table for team member invitation flow
  - tenant dunning columns (grace_period_ends_at, is_suspended)
  - tenant onboarding tracking (onboarding_completed_at)
  - tier enforcement DB triggers on trucks and tenant_memberships
  - InviteStatus and InvitableRole TypeScript types
  - invite Zod validation schema
affects:
  - 05-02 (invite server actions depend on invites table and types)
  - 05-03 (onboarding wizard depends on onboarding_completed_at column)
  - 05-04 (billing portal/dunning depends on grace_period_ends_at, is_suspended)
  - 05-05 (tier enforcement UI depends on DB triggers)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER tier enforcement triggers"
    - "CHECK constraints on invite status and role columns"

key-files:
  created:
    - supabase/migrations/00005_phase5_invites_tier_enforcement.sql
    - src/lib/validations/invite.ts
  modified:
    - src/db/schema.ts
    - src/types/index.ts

key-decisions:
  - "CHECK constraints on invites role and status columns for DB-level validation"
  - "RLS SELECT + INSERT for authenticated on invites; UPDATE/DELETE via service role only"
  - "Trial plan uses starter limits in tier enforcement triggers"
  - "InvitableRole excludes owner (owner is always the tenant creator)"

patterns-established:
  - "Tier enforcement via BEFORE INSERT triggers with SECURITY DEFINER"
  - "Invite role CHECK constraint mirrors InvitableRole TypeScript type"

# Metrics
duration: 2min
completed: 2026-02-12
---

# Phase 5 Plan 01: DB Foundation Summary

**Invites table, tenant dunning/onboarding columns, and tier enforcement triggers with Drizzle schema and Zod validation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-12T09:18:33Z
- **Completed:** 2026-02-12T09:20:47Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created invites table with token-based acceptance flow (token, email, role, status, expiry)
- Added dunning columns to tenants (grace_period_ends_at, is_suspended) and onboarding tracking (onboarding_completed_at)
- Implemented tier enforcement triggers on trucks (5/20/unlimited) and tenant_memberships (3/10/unlimited) by plan
- RLS policies on invites with SELECT/INSERT for authenticated, service role for acceptance
- Drizzle schema mirrors SQL migration; TypeScript types and Zod validation compile cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: SQL migration for invites table, tenant columns, and tier enforcement triggers** - `a709cc7` (feat)
2. **Task 2: Drizzle schema, types, and Zod validation for Phase 5** - `8ad15a7` (feat)

## Files Created/Modified
- `supabase/migrations/00005_phase5_invites_tier_enforcement.sql` - SQL migration: invites table, tenant ALTER columns, RLS, triggers, grants
- `src/db/schema.ts` - Drizzle schema: invites table, tenants dunning/onboarding columns, Invite/NewInvite types
- `src/types/index.ts` - InviteStatus, InvitableRole types with const arrays
- `src/lib/validations/invite.ts` - Zod schema for invite creation (email + role enum)

## Decisions Made
- CHECK constraints on invites role ('admin','dispatcher','viewer') and status ('pending','accepted','expired','revoked') columns for DB-level validation
- RLS on invites: SELECT + INSERT for authenticated role; UPDATE/DELETE only via service role (acceptance flow handled server-side)
- Trial plan uses starter-tier limits in enforcement triggers (5 trucks, 3 users)
- InvitableRole type excludes 'owner' since owner is always the tenant creator, never invited

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Invites table and types ready for invite server actions (Plan 02)
- Tenant onboarding_completed_at column ready for onboarding wizard (Plan 03)
- Dunning columns (grace_period_ends_at, is_suspended) ready for billing portal (Plan 04)
- Tier enforcement triggers active on trucks and tenant_memberships inserts
- All existing tests pass (8/8)

---
*Phase: 05-onboarding---stripe-polish*
*Completed: 2026-02-12*
