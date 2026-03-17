# Security & Authorization – VroomX TMS

YOU MUST treat tenant data leaks / broken access control as catastrophic.

## Multi-Tenancy (critical)
- EVERY table: MUST have tenant_id column + RLS policy enforcing it
- Queries: ALWAYS filter by tenant_id from authorize() ctx
- NEVER accept client-supplied tenant_id/user_id without re-validation

## Authorization (mandatory sequence)
- EVERY mutation/action: MUST call authorize('resource.action', { rateLimit? })
- authorize() provides: { supabase, tenantId, user, role, permissions }
- After: enforce `if (record.tenant_id !== tenantId) throw new Error("Unauthorized")`
- Admin-only: check role === 'admin' or hasPermission()
- Rate limit sensitive actions (auth, creates, emails) via token-bucket

## Supabase Clients
- Server: src/lib/supabase/server.ts
- Client: src/lib/supabase/client.ts
- Service-role: ONLY in controlled server contexts — NEVER expose
- NEVER bypass RLS "temporarily"

## Input / Abuse Protection
- ALL payloads: Zod schema from src/lib/validations/
- Search/ilike: sanitize-search.ts (strip filters, cap length)
- Rate limiting: via authorize() opts — strict for emails/batch

## Stripe / Payments
- Webhook: verify signature + idempotency check first
- NEVER store/process raw card data
- Only save customerId / subscriptionId

## NEVER EVER
- Bypass RLS / auth checks
- Log PII / full errors in prod
- Use raw SQL strings
- Commit secrets / .env

If a suggestion risks any of these → STOP and propose secure fix first.