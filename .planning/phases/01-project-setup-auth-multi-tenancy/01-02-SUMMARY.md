---
phase: 01-project-setup-auth-multi-tenancy
plan: 02
subsystem: database
tags: [postgres, supabase, rls, drizzle, multi-tenancy, jwt, security]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Next.js 16 project scaffold with dependencies"
provides:
  - "Multi-tenant database schema with RLS policies"
  - "JWT custom access token hook for tenant isolation"
  - "Drizzle ORM schema with type-safe queries"
  - "Database client configured for Supabase PgBouncer"
affects: [01-03, 01-04, 01-05, auth, data-model, billing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RLS-based multi-tenancy with (SELECT ...) wrapper pattern"
    - "JWT app_metadata injection via custom access token hook"
    - "get_tenant_id() helper function for all RLS policies"
    - "Drizzle ORM with prepare: false for PgBouncer"

key-files:
  created:
    - supabase/migrations/00001_initial_schema.sql
    - src/db/schema.ts
    - src/db/index.ts
  modified: []

key-decisions:
  - "Use (SELECT public.get_tenant_id()) wrapper in RLS policies for performance (Supabase best practice)"
  - "GRANT execution to supabase_auth_admin for JWT hook (not SECURITY DEFINER)"
  - "No INSERT/DELETE policies on tenants table (service role only)"
  - "stripe_events table has no authenticated policies (service role only)"
  - "userId in tenant_memberships doesn't reference auth.users in Drizzle (cross-schema limitation)"

patterns-established:
  - "RLS Policy Pattern: All tables use (SELECT get_tenant_id()) wrapper for stable function caching"
  - "Multi-tenant Isolation: tenant_id injected into JWT, RLS enforces per-request isolation"
  - "Drizzle Schema Mirroring: Schema mirrors SQL exactly with camelCase TypeScript properties mapping to snake_case columns"
  - "Database Client: prepare: false, max: 1, idle_timeout: 20 for serverless + PgBouncer"

# Metrics
duration: 3min
completed: 2026-02-11
---

# Phase 01 Plan 02: Database Schema Summary

**Multi-tenant PostgreSQL schema with RLS isolation, JWT tenant context injection, and Drizzle ORM type-safe queries**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-11T21:42:15Z
- **Completed:** 2026-02-11T21:44:51Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created complete multi-tenant SQL schema with 3 core tables (tenants, tenant_memberships, stripe_events)
- Implemented RLS policies using (SELECT ...) wrapper pattern for performance
- Built custom_access_token_hook to inject tenant_id, role, plan, and subscription_status into JWT
- Created Drizzle ORM schema with full type inference for type-safe server queries
- Configured database client for Supabase PgBouncer compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SQL migration with tenants, memberships, stripe_events, RLS, and auth hook** - `e5733a7` (feat)
2. **Task 2: Create Drizzle ORM schema and database client** - `e7af791` (feat)

## Files Created/Modified

- `supabase/migrations/00001_initial_schema.sql` - Complete initial schema with 3 tables, RLS policies, JWT hook, triggers, and indexes (185 lines)
- `src/db/schema.ts` - Drizzle table definitions mirroring SQL schema with type exports
- `src/db/index.ts` - Database client with prepare: false for PgBouncer

## Decisions Made

**1. Use (SELECT ...) wrapper in RLS policies**
- Rationale: Supabase best practice for stable function optimization - enables result caching per transaction

**2. GRANT execution pattern for JWT hook (not SECURITY DEFINER)**
- Rationale: Explicit grants to supabase_auth_admin more secure than SECURITY DEFINER

**3. No INSERT/DELETE policies on tenants table**
- Rationale: Tenant creation/deletion must use service role during signup/offboarding flow for proper isolation

**4. stripe_events table has no authenticated policies**
- Rationale: Webhook processing is service-role only, prevents authenticated users from seeing/modifying webhook history

**5. Drizzle schema doesn't reference auth.users**
- Rationale: auth.users is Supabase-managed schema not in public, cross-schema references not supported in Drizzle

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - schema creation was straightforward following the plan specification.

## User Setup Required

**Manual Supabase configuration required.** The SQL migration file must be run in the Supabase Dashboard:

### Steps:
1. Create Supabase project at https://supabase.com/dashboard
2. Navigate to SQL Editor in dashboard
3. Copy contents of `supabase/migrations/00001_initial_schema.sql`
4. Paste and run in SQL Editor
5. Configure JWT hook in Dashboard > Authentication > Hooks > Custom Access Token Hook
   - Select function: `public.custom_access_token_hook`
6. Obtain credentials from Settings > API:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
7. Obtain database URLs from Settings > Database:
   - `DATABASE_URL` (connection pooler - transaction mode)
   - `DATABASE_URL_DIRECT` (direct connection)
8. Update `.env.local` with all values

### Verification:
- Check that tables exist: Run `SELECT * FROM pg_tables WHERE schemaname = 'public';` in SQL Editor
- Verify RLS enabled: Run `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`
- Confirm hook configured: Check Authentication > Hooks shows custom_access_token_hook enabled

## Next Phase Readiness

**Ready for next phase (01-03: Supabase Client Setup)**

### What's ready:
- Database schema complete with multi-tenant isolation
- RLS policies configured for automatic tenant filtering
- JWT hook ready to inject tenant context
- Drizzle schema ready for type-safe queries
- Migration file ready to run in Supabase Dashboard

### Blockers:
- Manual Supabase project setup required before auth can be tested
- Database credentials needed in .env.local before server can connect

### Technical foundation:
This schema establishes the security model for the entire application. All future tables will:
- Add `tenant_id UUID REFERENCES public.tenants(id)` column
- Enable RLS with `USING (tenant_id = (SELECT public.get_tenant_id()))`
- Follow the same RLS policy pattern established here

The JWT hook ensures that every authenticated request automatically has tenant context, making RLS policies work seamlessly without application-level filtering.

---
*Phase: 01-project-setup-auth-multi-tenancy*
*Completed: 2026-02-11*
