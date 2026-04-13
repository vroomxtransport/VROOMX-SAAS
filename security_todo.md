# Security TODO
Last Updated: 2026-04-12
Source: Security audit + PROJECT.md delta review
Legend: OPEN | PARTIAL | DONE

## Launch Blockers (High)

### SEC-001 — Lock down `send-bol-email` edge function auth/CORS/service-role misuse
- ID: `SEC-001`
- Status: `OPEN`
- Severity: `High`
- Risk: Unauthenticated callers can trigger email sends and potentially access private BOL files through service-role-backed fetch logic.
- Primary Files: `supabase/functions/send-bol-email/index.ts:9`, `supabase/functions/send-bol-email/index.ts:35`, `supabase/functions/send-bol-email/index.ts:39`, `supabase/functions/send-bol-email/index.ts:64`
- Required Change: Require authenticated caller, enforce tenant-scoped storage path checks, remove permissive `Access-Control-Allow-Origin: *`, and avoid direct service-role file fetch from untrusted input.
- Definition of Done: Endpoint rejects unauthenticated requests, enforces tenant ownership, and no longer relies on user-controlled storage paths with service-role access.
- Owner: `TBD`
- Target Date: `Pre-launch`
- Verification: Unauthenticated request returns `401`; cross-tenant path attempts return `403`; valid tenant-scoped call succeeds.

### SEC-002 — Fix invite acceptance flow (no state change on GET, enforce invite-email match)
- ID: `SEC-002`
- Status: `OPEN`
- Severity: `High`
- Risk: Invite acceptance mutates membership in a GET handler and does not verify the logged-in user email matches invited email.
- Primary Files: `src/app/(auth)/invite/accept/route.ts:6`, `src/app/(auth)/invite/accept/route.ts:16`, `src/app/(auth)/invite/accept/route.ts:59`, `src/app/(auth)/invite/accept/route.ts:74`
- Required Change: Move acceptance mutation to `POST`, add strict invite-token + user-email binding, and prevent account switching abuse.
- Definition of Done: Invite token can only be accepted by the invited email via non-GET state-changing route; mismatched account attempts fail.
- Owner: `TBD`
- Target Date: `Pre-launch`
- Verification: Logged-in user with different email cannot accept invite; same-email invited user can accept once; replay attempts fail.

### SEC-003 — Add RBAC checks to invoice routes (`invoices.view` / `invoices.send`)
- ID: `SEC-003`
- Status: `DONE`
- Severity: `High`
- Risk: Invoice PDF/send API routes currently gate by auth + tenant only, bypassing permission checks used in server actions.
- Primary Files: `src/app/api/invoices/[orderId]/pdf/route.ts:5`, `src/app/api/invoices/[orderId]/send/route.ts:7`, `src/lib/permissions.ts:23`
- Required Change: Add centralized authorization checks for invoice routes using `invoices.view` and `invoices.send`.
- Definition of Done: Users without invoice permissions receive `403`; authorized roles continue working.
- Owner: `TBD`
- Target Date: `Pre-launch`
- Verification: Role-based tests confirm deny-by-default for unauthorized users on both routes.

### SEC-004 — Enforce cross-tenant ownership checks + tenant-safe FK integrity
- ID: `SEC-004`
- Status: `OPEN`
- Severity: `High`
- Risk: FK relationships reference global IDs without tenant composite constraints, allowing risky cross-tenant linkage paths if ownership checks are missed.
- Primary Files: `supabase/migrations/00002_core_entities.sql:112`, `supabase/migrations/00002_core_entities.sql:113`, `supabase/migrations/00003_trips_and_dispatch.sql:31`, `supabase/migrations/00003_trips_and_dispatch.sql:32`, `supabase/migrations/00003_trips_and_dispatch.sql:73`, `src/app/actions/trips.ts:30`, `src/app/actions/trailers.ts:100`, `src/app/actions/trip-expenses.ts:20`
- Required Change: Add tenant-safe FK strategy (composite constraints and/or enforced ownership checks before write) for all linked entities.
- Definition of Done: Cross-tenant references are impossible at DB and application layers.
- Owner: `TBD`
- Target Date: `Pre-launch`
- Verification: Integration tests prove cross-tenant IDs cannot be linked by any action/route.

### SEC-005 — Harden CSP by removing `unsafe-eval` and minimizing/removing `unsafe-inline`
- ID: `SEC-005`
- Status: `PARTIAL`
- Severity: `High`
- Risk: CSP is present but weakened by permissive script/style directives.
- Primary Files: `next.config.ts:29`, `next.config.ts:32`, `next.config.ts:33`
- Required Change: Remove `unsafe-eval`, migrate to nonce/hash strategy where needed, and reduce or eliminate `unsafe-inline`.
- Definition of Done: Production CSP blocks eval and non-approved inline script/style usage while app functionality remains intact.
- Owner: `TBD`
- Target Date: `Pre-launch`
- Verification: Browser CSP violation checks and automated smoke tests pass under hardened policy.

## Important Follow-Ups (Medium)

### SEC-006 — Add `WITH CHECK` to `payments_update` RLS policy
- ID: `SEC-006`
- Status: `DONE`
- Severity: `Medium`
- Risk: `UPDATE` policy allows row updates by tenant filter but lacks explicit `WITH CHECK` constraint to validate post-update row state.
- Primary Files: `supabase/migrations/00004_billing_invoicing.sql:76`
- Required Change: Add `WITH CHECK (tenant_id = (SELECT public.get_tenant_id()))` to `payments_update`.
- Definition of Done: Payment row updates cannot mutate into unauthorized tenant state.
- Owner: `TBD`
- Target Date: `Post-launch hardening sprint`
- Verification: Policy test attempts to change protected row context fail.

### SEC-007 — Codify storage bucket RLS/policies in migrations/runbook
- ID: `SEC-007`
- Status: `OPEN`
- Severity: `Medium`
- Risk: Storage security is documented in comments but not fully codified as repeatable infrastructure policy.
- Primary Files: `supabase/migrations/00006_driver_app_tables.sql:367`
- Required Change: Add explicit storage policy SQL/migration steps and an operational runbook for bucket permissions.
- Definition of Done: Fresh environment setup enforces identical private bucket policies without manual dashboard-only steps.
- Owner: `TBD`
- Target Date: `Post-launch hardening sprint`
- Verification: Reprovisioned environment passes storage policy validation checks.

### SEC-008 — Replace in-memory rate limit with shared store (Upstash/Redis)
- ID: `SEC-008`
- Status: `PARTIAL`
- Severity: `Medium`
- Risk: Current limiter is instance-local and can be bypassed in multi-instance/serverless deployments.
- Primary Files: `src/lib/rate-limit.ts:2`, `src/lib/authz.ts:50`, `src/lib/supabase/proxy.ts:15`
- Required Change: Implement distributed rate limiting backend and keep current per-action rules.
- Definition of Done: Rate limits are consistent across instances and restarts.
- Owner: `TBD`
- Target Date: `Post-launch hardening sprint`
- Verification: Multi-instance load test shows stable shared throttling behavior.

### SEC-009 — Add live membership verification in `authorize()`
- ID: `SEC-009`
- Status: `DONE`
- Severity: `Medium`
- Risk: Authorization primarily trusts JWT `app_metadata`; membership/role revocation may lag until token refresh.
- Primary Files: `src/lib/authz.ts:45`, `src/lib/authz.ts:59`
- Required Change: Verify active tenant membership and effective role from DB for sensitive operations.
- Definition of Done: Revoked users/roles lose access immediately without waiting for JWT rotation.
- Owner: `TBD`
- Target Date: `Post-launch hardening sprint`
- Verification: Membership removal test immediately blocks previously authorized action.

### SEC-010 — Move remaining client-side data writes behind server actions
- ID: `SEC-010`
- Status: `DONE`
- Severity: `Medium`
- Risk: Some writes still occur directly from client Supabase calls, reducing centralized server-side authorization enforcement.
- Primary Files: `src/app/(dashboard)/orders/_components/order-attachments.tsx:157`, `src/app/(dashboard)/orders/_components/order-attachments.tsx:207`
- Required Change: Move write/delete paths to server actions with explicit permission checks and safe error handling.
- Definition of Done: All state-changing operations pass through server-side authorization controls.
- Owner: `TBD`
- Target Date: `Post-launch hardening sprint`
- Verification: Static scan confirms no remaining direct client-side writes for protected entities.

## Already Implemented
- `DONE` Security headers baseline present (`next.config.ts`).
- `DONE` Central `authorize()` permission gate used across server actions (`src/lib/authz.ts`).
- `DONE` Broad RLS coverage across application tables (migrations under `supabase/migrations/`).
- `DONE` Zod input bounds + search sanitization (`src/lib/validations/*`, `src/lib/sanitize-search.ts`).
- `DONE` FMCSA endpoint now requires auth + rate limiting (`src/app/api/fmcsa/route.ts`).

## Per-Issue Template
- ID: `SEC-XXX`
- Status: `OPEN | PARTIAL | DONE`
- Severity: `High | Medium | Low`
- Risk: `One-sentence impact statement`
- Primary Files: ``path/to/file.ts:line``
- Required Change: `Concrete implementation task`
- Definition of Done: `Measurable acceptance condition`
- Owner: `TBD`
- Target Date: `YYYY-MM-DD or milestone`
- Verification: `Specific test or validation step`

## Verification Checklist
- [ ] Each high issue has a test case.
- [ ] Each issue references concrete files.
- [ ] Each issue has measurable DoD.
- [ ] No issue remains ambiguous without acceptance criteria.

## Test Cases and Scenarios
1. File creation test: `security_todo.md` exists at repo root and is tracked.
2. Content integrity test: file contains `SEC-001` through `SEC-010`.
3. Prioritization test: High items are separated from Medium items.
4. Traceability test: each item includes at least one concrete file reference.
5. Operability test: every item includes Definition of Done and Verification.

## Assumptions and Defaults
1. This file is the persistent, implementation-ready security backlog.
2. It tracks unresolved or partial risks and keeps implemented controls in a separate done section.
3. Priority order is launch blockers first, then medium follow-up hardening.
4. Snapshot baseline date for this version is February 15, 2026.
