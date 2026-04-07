# Security Auditor Agent Usage – Mandatory After Security-Sensitive Changes

The `security-auditor` agent (see CLAUDE.md → AGENTS) MUST be spawned after any completed feature or change whose surface touches security, before committing or pushing.

This rule sits alongside `.claude/rules/debugger-usage.md`. The debugger validates correctness; the security-auditor validates posture. Both can be needed for the same change.

## When to spawn — REQUIRED

A change is security-sensitive and requires a security-auditor pass if ANY of the following is true:

- **Authentication / session**: touches login, signup, magic link, invite acceptance, password reset, OAuth callbacks, JWT validation, session rotation, MFA, or anything in `src/app/actions/auth.ts`, `src/lib/supabase/proxy.ts`, `src/lib/admin-auth.ts`, or `src/app/(auth)/**`
- **Authorization**: modifies `authorize()`, the `SENSITIVE_PERMISSIONS` set, permission categories in `src/lib/permissions.ts`, custom-role logic, or any server action's permission string
- **RLS / migrations**: adds, drops, or modifies any `CREATE POLICY`, `ALTER TABLE … ENABLE ROW LEVEL SECURITY`, `SECURITY DEFINER` function, `GRANT`, or storage bucket policy. Also: any new `tenant_id` column or foreign key
- **Server actions**: new file in `src/app/actions/`, or any change that adds a new exported mutation, or that removes / reorders the mandated Zod → authorize → tenant_id filter → safeError sequence
- **API routes**: new `src/app/api/**/route.ts`, or any change to an existing one that affects the auth check, signature verification, cron secret, or rate limit
- **Storage / file upload**: new bucket, new upload or download path, signed URL generation, changes to `src/lib/storage.ts` or `src/lib/file-validation.ts`
- **Webhooks**: signature verification logic, idempotency checks, or anything under `src/app/api/webhooks/`
- **Cron endpoints**: `CRON_SECRET` handling or any change under `src/app/api/cron/`
- **Secrets / env**: new required env var in `src/lib/startup-checks.ts`, new secret in `.env.local.example`, changes to `netlify.toml` `SECRETS_SCAN_OMIT_KEYS`, or any new `createServiceRoleClient()` callsite
- **CORS / CSP / security headers**: any change to `next.config.ts`, `middleware.ts` CSP builder, `netlify.toml` headers, or `src/lib/extension/cors.ts`
- **Logging / telemetry**: changes to Sentry configs (`instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`), PostHog wiring, or any new `console.log` of user data
- **Rate limiting**: changes to `src/lib/rate-limit.ts`, any new `rateLimit()` callsite, or changes to IP-source derivation
- **Multi-tenant data access**: queries that add or remove a `tenant_id` filter, new `.from('tenants').select(...)` patterns, cross-tenant queries via service role
- **Dependencies**: `npm install` / package bump for any auth, crypto, DB, storage, or HTTP library

## When NOT required

- Pure UI changes (Tailwind tweaks, component props, design tokens)
- Marketing-page copy, landing pages, blog content
- Documentation-only changes
- Code comments and formatting
- Dev-tool / IDE config (`.vscode`, tsconfig path aliases with no security impact)
- Test file changes that only touch assertions, not mocks of auth/permission surfaces

When in doubt, spawn it. False-positive spawns are cheap; a missed security audit that ships a regression is not.

## What the security-auditor agent must receive

When spawning, brief the agent with:

1. **Summary of the change** — which files, what behavior changed, what security surface it touches
2. **Prior audit waves closed** — to avoid re-reporting. Enumerate the IDs closed in recent waves (SCAN-001 through SCAN-017, CFG-001 through CFG-012, AUTH-001 through AUTH-006, SEC-LEAK-01 through SEC-LEAK-05). The agent should focus on NEW exposure, not re-verify old fixes.
3. **Relevant file paths and line numbers** — don't delegate understanding; point the agent at the exact code
4. **The verification scope**:
   - For auth/authz changes: trace every callsite, verify the authorize() → tenant_id filter chain, check for privilege escalation paths
   - For RLS changes: verify WITH CHECK on UPDATE, verify policy names match app expectations, check for `raw_app_meta_data` anti-pattern
   - For new routes: confirm auth mechanism, rate limit, and signature/secret gating
   - For storage changes: verify tenant folder prefix in both write and read paths
   - For secrets: grep the diff for hardcoded values, confirm env vars are in `startup-checks.ts`

## What the security-auditor should do

- **Read the diff and adjacent unchanged code** — a fix can break a nearby callsite
- **Trace callsites** — for any modified exported function, find every caller
- **Test privilege escalation paths** — can a viewer do admin things? Can tenant A read tenant B data?
- **Check regressions against prior waves** — did the change re-introduce a closed finding?
- **Report findings** with file:line, severity (CRITICAL/HIGH/MEDIUM/LOW/INFO), and concrete remediation
- Do **NOT** auto-apply fixes for risky changes (auth, RLS, payments, migrations, crypto) without explicit confirmation — report and let the primary agent decide

## Workflow integration (order at task completion)

This rule extends the existing pre-commit workflow in CLAUDE.md. The order is:

1. Run lint + typecheck + relevant tests
2. Walk the **Pre-Commit Verification Checklist** in CLAUDE.md
3. **Spawn `debugger` agent** for end-to-end correctness (per `.claude/rules/debugger-usage.md`)
4. **Spawn `security-auditor` agent** for posture review (this rule) — ONLY if the change is security-sensitive per the "When to spawn" list above
5. Resolve any findings from either pass
6. Show BEFORE → AFTER diffs to user
7. Commit only after user confirmation

The debugger and security-auditor can run in parallel if the changes are independent. For intertwined changes (e.g., a new auth flow with a new RLS policy), run the debugger first to close correctness issues, then the security-auditor on the cleaned-up code.

## Why

Every prior audit wave in this codebase (5a/5b/6a/6b/6c/7) found issues that the original author thought were fine. Examples:
- Wave 5a SCAN-005: order attachments shipped with client-side writes that bypassed RBAC for a year before being caught
- Wave 6a CFG-002: seven more tables had the same `WITH CHECK` bug as Wave 5a's payments_update, in code written MONTHS after the original was fixed
- Wave 7 AUTH-001: an account-takeover primitive lived in `signUpAction` through the entire invite feature's lifetime

A dedicated security-auditor pass on feature completion is the only discipline that would have caught any of these at write time. The cost of the pass is trivial (a few minutes per agent spawn); the cost of shipping a regression is a hotfix or worse.
