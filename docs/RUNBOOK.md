# VroomX TMS — Incident Runbook

Last updated: 2026-04-12

This runbook covers the most likely production incidents and how to respond.
It assumes the reader has access to: Netlify dashboard, Supabase dashboard,
Sentry dashboard, Stripe dashboard, and GitHub.

---

## Quick Reference

| Service | Dashboard | What breaks if it's down |
|---|---|---|
| Netlify | app.netlify.com | Site unreachable, deploys fail |
| Supabase | supabase.com/dashboard | All data access, auth, realtime |
| Stripe | dashboard.stripe.com | Signups, billing, webhooks |
| Sentry | sentry.io | Error visibility (app still works) |
| Samsara | cloud.samsara.com | Telematics sync (app still works) |
| QuickBooks | developer.intuit.com | Accounting sync (app still works) |
| Resend | resend.com/dashboard | Email delivery (app still works) |
| Upstash | console.upstash.com | Rate limiting (falls back to in-memory) |

---

## 1. Site Is Down (503 / Unreachable)

**Check in order:**

1. **Netlify status**: https://www.netlifystatus.com — if Netlify is down, wait for their recovery. Nothing to do on our side.
2. **Health endpoint**: `curl https://app.vroomxtransport.com/api/health`
   - `200 {status: 'ok'}` — site is fine, issue is client-side or DNS
   - `503 {status: 'degraded', checks: {...}}` — read which check failed:
     - `database: false` → Supabase is down. Check https://status.supabase.com
     - `redis: false` → Upstash is down. Rate limiting falls back to in-memory. App still works but rate limits are per-instance, not global.
   - No response at all → Netlify function runtime is down. Check Netlify dashboard → Deploys → most recent deploy status.
3. **Recent deploy**: If a deploy just went out, it may have broken the build. Go to Netlify dashboard → Deploys → click the failing deploy → read the build log. **Rollback**: click any prior successful deploy → "Publish deploy."

**Do NOT:**
- Push more commits on top of a failing build (stacks deploys, wastes time)
- Restart Supabase project unless Supabase support tells you to

---

## 2. Stripe Webhooks Not Processing

**Symptoms:** New signups complete on Stripe but `subscription_status` stays `trialing` or `incomplete` in the app. Invoices not marked paid.

**Check:**

1. **Stripe dashboard** → Webhooks → click the endpoint → Events tab. Look for red (failed) events.
2. **Stripe retries automatically** with exponential backoff. If the endpoint was temporarily down, Stripe will retry for up to 3 days. Check if events are in "Pending" state — they'll resolve on their own.
3. **If events are failing with 500**: Check Sentry for errors in the `stripe-webhook` tag. The most common cause is a code regression in `src/app/api/webhooks/stripe/route.ts`.
4. **Idempotency**: The app stores processed event IDs in the `stripe_events` table. If you see duplicate processing, check that table for the event ID — if it's already there, the event was already handled.

**Manual recovery:**
- Go to Stripe dashboard → Webhooks → click the failed event → "Resend"
- The app will process it idempotently (same event ID = skip)

---

## 3. Cron Jobs Not Running

**Symptoms:** Scheduled reports not sending, alerts not firing, webhook retries not processing.

**Known cron jobs:**

| Job | Purpose | Expected frequency | Failure impact |
|---|---|---|---|
| `/api/cron/reports` | Email CSV reports | Every 15-60 min | Reports stop sending silently |
| `/api/cron/alerts` | Evaluate alert rules | Every 15-60 min | Alerts don't trigger |
| `/api/cron/webhook-retries` | Retry failed outbound webhooks | Every 1-5 min | Failed deliveries stay failed |
| `/api/cron/archive-audit-logs` | Archive old audit logs to storage | Monthly | Audit table grows, no immediate impact |
| `/api/cron/fuelcard-sync` | Sync fuel card transactions | Daily | Fuel data stale |

**Check:**

1. All cron endpoints require the `CRON_SECRET` header (timing-safe HMAC). If the secret was rotated, the external scheduler (Netlify scheduled functions, or a third-party cron service) must be updated.
2. Check the external scheduler dashboard to confirm jobs are firing.
3. Test manually: `curl -H "Authorization: Bearer <CRON_SECRET>" https://app.vroomxtransport.com/api/cron/alerts`
4. Check Sentry for cron-tagged errors.

**There is no built-in monitoring for missed cron runs.** If a job fails silently, you find out when a customer complains. This is a known ops gap — tracked as a follow-up item.

---

## 4. Database Migration Failed or Needs Rollback

**How migrations are applied:**
- Script: `scripts/apply-migration.mjs` — connects directly to Postgres (bypasses PgBouncer pooler)
- Migrations are forward-only (no automatic rollback). Drizzle-kit does not generate down-migrations.

**If a migration broke something:**

1. **Identify the breaking migration** in `supabase/migrations/` — look at the most recent SQL file.
2. **Write a manual revert SQL** that undoes the change (DROP the column, remove the policy, etc.).
3. **Apply the revert** via the same `apply-migration.mjs` script or directly in Supabase SQL Editor.
4. **Verify** by running a SELECT on the affected table.

**Point-in-Time Recovery (PITR):**
- Available on Supabase Pro plan (check the LAUNCH-CHECKLIST.md for setup confirmation)
- Go to Supabase dashboard → Database → Backups → Point-in-Time Recovery
- Pick a timestamp BEFORE the bad migration
- **WARNING**: PITR restores the ENTIRE database to that point, not just one table. Any data written after that timestamp is lost. Use this as a last resort.

---

## 5. Auth / Login Broken

**Symptoms:** Users can't log in, get "Invalid email or password" on correct credentials, or stuck in redirect loop.

**Check:**

1. **Supabase dashboard** → Authentication → Users — is the user's account confirmed? Is their email_confirm date set?
2. **Supabase Auth service status**: Check https://status.supabase.com
3. **JWT issues**: If users are logged in but see "Not authenticated" on actions, the JWT may have expired. Check `app_metadata` on the user's auth record — `tenant_id` and `role` must be present.
4. **Rate limiting**: Signup is rate-limited at 5 attempts/min per IP. If a user is blocked, they need to wait 60 seconds.

**Common causes:**
- Supabase Auth service degradation (wait for recovery)
- Someone changed the `SUPABASE_SECRET_KEY` without redeploying (env var mismatch)
- A migration accidentally dropped or altered an RLS policy on `tenant_memberships`

---

## 6. External API Integration Down

**Samsara not syncing:**
- Check Samsara cloud dashboard for their status
- The VroomX client has a 5-second per-request timeout with 3 retries
- If Samsara is slow, users see an error message instead of a hung page (as of item #4 fix)
- Manual re-sync: users can click "Sync" again from the Samsara integration page

**QuickBooks not syncing:**
- Check Intuit developer dashboard for status
- Same 5-second timeout + 3 retries as Samsara
- QB OAuth tokens expire — if sync fails with 401, the user needs to re-authorize from Settings → Integrations

**Resend emails not delivering:**
- Check https://resend.com/dashboard for delivery status
- Common cause: Resend API key rotated without updating the env var
- The Resend client has an 8-second timeout wrapper (available but callsite wiring is a follow-up)

---

## 7. Secrets Rotation

If a secret is compromised, here's the rotation procedure for each:

| Secret | Where to update | Downtime? |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe dashboard → create new key → Netlify env vars → redeploy | ~2 min (during redeploy) |
| `STRIPE_WEBHOOK_SECRET` | Stripe dashboard → Webhooks → create new endpoint → Netlify env → redeploy | ~2 min |
| `SUPABASE_SECRET_KEY` | Supabase dashboard → Settings → API → regenerate → Netlify env → redeploy | ~2 min |
| `DATABASE_URL` | Supabase dashboard → Settings → Database → change password → update both `DATABASE_URL` and `DATABASE_URL_DIRECT` in Netlify env → redeploy | ~2 min |
| `CRON_SECRET` | Generate new value (`openssl rand -hex 32`) → Netlify env → update external scheduler → redeploy | ~2 min |
| `RESEND_API_KEY` | Resend dashboard → create new key → Netlify env → redeploy | ~2 min |

**General pattern:** Create new key in the service → update in Netlify dashboard → trigger redeploy → verify the health endpoint returns 200.

**Important:** VroomX does NOT support dual-key rotation (accepting both old and new key simultaneously). There will be a brief window (~2 min) where requests fail during redeploy.

---

## 8. Escalation

If you can't resolve the issue:

1. Check Sentry for the exact error + stack trace
2. Note the timestamp, affected tenant(s), and what the user was doing
3. Open a GitHub issue with the Sentry link + reproduction steps
4. For data-loss scenarios: do NOT attempt manual DB writes — use PITR or escalate to someone with Supabase admin access

---

## 9. Post-Incident

After every incident:
1. Write a brief postmortem (what happened, when, impact, root cause, fix, prevention)
2. If a code fix was needed, ensure it has a regression test before merging
3. Update this runbook if the incident revealed a gap
