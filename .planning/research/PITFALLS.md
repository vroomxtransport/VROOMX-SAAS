# Domain Pitfalls: VroomX SaaS TMS

**Domain:** Multi-tenant SaaS TMS for vehicle transport carriers
**Researched:** 2026-02-11

## Critical Pitfalls

Mistakes that cause rewrites, security incidents, or major issues.

### Pitfall 1: RLS Policies Without Function Caching

**What goes wrong:** RLS policies that call `auth.uid()` or `auth.jwt()` directly (without wrapping in a `SELECT`) execute the function for every single row evaluated. On a table with 100K+ rows, this turns a 2ms query into a 3-minute query.

**Why it happens:** The pattern `USING (tenant_id = auth.uid())` looks correct and works functionally. The performance issue only appears at scale, often months after launch.

**Consequences:** Dashboard pages time out. Users report "the app is slow." Developers blame the frontend or Supabase, not realizing the issue is in the RLS policy definition.

**Prevention:**
```sql
-- ALWAYS wrap auth functions in SELECT
CREATE POLICY tenant_isolation ON orders
  TO authenticated
  USING (tenant_id = (SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid);
--                    ^^^^^^^^                                         ^^^^^^^^
-- The SELECT wrapper causes PostgreSQL to cache the function result
```

**Detection:** Run `EXPLAIN ANALYZE` on queries with RLS enabled. Look for "Filter" rows showing function calls with high row counts. If you see `auth.uid()` in the Filter without "SubPlan" or "InitPlan," the function is being called per row.

### Pitfall 2: Missing Tenant Isolation on Lookup Tables

**What goes wrong:** Developers add RLS to "obvious" tables (orders, trips, invoices) but forget lookup/reference tables (custom statuses, tags, expense categories, notification preferences). A carrier can see another carrier's custom categories, or worse, modify them.

**Why it happens:** Lookup tables feel "generic" and developers assume they are shared. In a multi-tenant SaaS, EVERY table that contains tenant-specific data must have `tenant_id` and RLS.

**Consequences:** Data leakage between tenants. Trust violation. Potential legal liability if a carrier discovers they can see another carrier's data.

**Prevention:** Establish a rule: every table in the schema MUST have one of:
1. A `tenant_id` column with RLS policy (tenant-specific data)
2. An explicit `-- SHARED: no tenant_id, global reference data` comment (only for truly global data like US states, vehicle makes/models)

Create a CI check or migration script that verifies every table either has `tenant_id` or is explicitly marked as shared.

**Detection:** Periodic audit: `SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' GROUP BY table_name HAVING NOT bool_or(column_name = 'tenant_id');` -- this returns all tables without `tenant_id`. Review each one.

### Pitfall 3: Service Role Key Exposure

**What goes wrong:** The Supabase `service_role` key (which bypasses all RLS) is accidentally exposed in client-side code, environment variables without the `NEXT_PUBLIC_` prefix distinction, or server component code that gets serialized to the client.

**Why it happens:** Next.js App Router blurs the line between server and client. A component that starts as a Server Component gets refactored to a Client Component, and the `service_role` key comes along for the ride.

**Consequences:** Complete bypass of all tenant isolation. Any user can read/write any tenant's data. This is a catastrophic, company-ending security incident for a SaaS product.

**Prevention:**
1. Store `service_role` key ONLY in `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix)
2. Create separate Supabase client factories: `createBrowserClient()` (anon key) and `createServerClient()` (can use service role)
3. Add ESLint rule to flag `service_role` usage in any file under `/app` that is not an API route or server action
4. Audit: search codebase for `service_role` string periodically

**Detection:** If any client-side network request includes the `service_role` key in the Authorization header, your security model is broken.

### Pitfall 4: Stripe Webhook Idempotency Failures

**What goes wrong:** Webhook handler processes the same event multiple times, leading to duplicate subscription activations, double-counting revenue, or inconsistent plan state.

**Why it happens:** Stripe retries webhooks that do not receive a 200 response within 20 seconds. Network timeouts, serverless cold starts, or application errors cause retries. Without idempotency, each retry creates a duplicate side effect.

**Consequences:** Tenants get charged twice, or their plan state becomes inconsistent (database says "free" but Stripe says "pro").

**Prevention:**
```typescript
// Store processed event IDs
export async function POST(req: Request) {
  const event = stripe.webhooks.constructEvent(body, sig, secret)

  // Check if already processed
  const { data: existing } = await supabase
    .from('stripe_events')
    .select('id')
    .eq('event_id', event.id)
    .single()

  if (existing) return NextResponse.json({ received: true }) // Skip duplicate

  // Process event
  await handleEvent(event)

  // Mark as processed
  await supabase.from('stripe_events').insert({ event_id: event.id })

  return NextResponse.json({ received: true })
}
```

**Detection:** Monitor for duplicate `stripe_events` entries. Alert on webhook handler errors in Sentry.

### Pitfall 5: Tenant Data in JWT Without Refresh Strategy

**What goes wrong:** `tenant_id` and `plan` are stored in the JWT's `app_metadata`. When a tenant upgrades their plan, the JWT still contains the old plan until it expires and is refreshed.

**Why it happens:** JWTs are stateless. Once issued, they contain a snapshot of the user's metadata at issuance time. Supabase JWTs have a default 1-hour expiry.

**Consequences:** After a plan upgrade, the user does not get access to new features for up to 1 hour. Or worse, after a downgrade/cancellation, the user retains access for up to 1 hour.

**Prevention:**
1. For plan changes, force a token refresh after the Stripe webhook updates the database: `await supabase.auth.refreshSession()`
2. For critical feature gating (not just "can they see this UI" but "should this API call succeed"), check the database directly in Server Actions rather than relying solely on JWT claims
3. Set JWT expiry to a reasonable duration (1 hour is fine for most cases; reduce to 15 minutes if billing-sensitive features require faster propagation)

**Detection:** Test the upgrade/downgrade flow end-to-end. Verify that feature access changes take effect within the expected time window.

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or degraded user experience.

### Pitfall 6: Building the Dispatch Board Too Early

**What goes wrong:** Team spends weeks building a beautiful drag-and-drop dispatch board with real-time updates before core CRUD (orders, trips, drivers) is stable.

**Prevention:** Ship a filterable list view first. Validate with 5 real carriers that the dispatch workflow is correct. Then invest in the drag-and-drop UI. The list view will remain useful even after the board exists (mobile, accessibility, search).

### Pitfall 7: Not Enforcing Tier Limits at the Database Level

**What goes wrong:** Tier limits (max trucks, max users, max orders/month) are enforced only in the UI. A savvy user calls the API directly and bypasses limits.

**Prevention:** Enforce limits in Server Actions AND in database triggers/RLS policies. The database is the last line of defense.

```sql
-- Example: Enforce max trucks per tenant
CREATE OR REPLACE FUNCTION enforce_truck_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_trucks INTEGER;
BEGIN
  SELECT t.max_trucks INTO max_trucks
  FROM tenants t WHERE t.id = NEW.tenant_id;

  SELECT COUNT(*) INTO current_count
  FROM trucks WHERE tenant_id = NEW.tenant_id;

  IF current_count >= max_trucks THEN
    RAISE EXCEPTION 'Truck limit reached for your plan. Please upgrade.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Pitfall 8: Ignoring Supabase Connection Limits

**What goes wrong:** Serverless functions (Vercel) create a new database connection per invocation. At scale, you hit Supabase's connection limit (e.g., 60 direct connections on Pro plan).

**Prevention:** Use Supabase's **pooled connection string** (port 6543) for all serverless contexts. Use the **direct connection** (port 5432) only for migrations and long-running scripts. Configure Drizzle ORM to use the pooled connection in production.

### Pitfall 9: RLS Policies with Subqueries on Unindexed Tables

**What goes wrong:** An RLS policy checks team membership with a subquery like `user_id IN (SELECT user_id FROM tenant_members WHERE tenant_id = ...)` but `tenant_members` does not have an index on `(tenant_id, user_id)`.

**Prevention:** For every RLS policy that references another table, ensure:
1. The referenced table has appropriate indexes
2. Use a `SECURITY DEFINER` function to encapsulate the lookup (allows the query planner to optimize better)
3. Consider caching the result in a session variable if checked frequently

### Pitfall 10: Hardcoding Stripe Price IDs

**What goes wrong:** Stripe Price IDs (`price_1234...`) are hardcoded throughout the application. When prices change (new tier, price adjustment, promotional pricing), code changes are required in multiple places.

**Prevention:** Store Price IDs in environment variables or a configuration table. Reference them by logical name (`STARTER_MONTHLY`, `PRO_ANNUAL`), not by Stripe ID.

### Pitfall 11: Not Handling Supabase Realtime Reconnection

**What goes wrong:** When a user's network drops and reconnects, Supabase Realtime channels may not automatically rejoin with the correct state. The dispatch board shows stale data without any indication.

**Prevention:** Listen for channel status changes. On reconnection, invalidate TanStack Query caches to force a fresh fetch.

```typescript
channel.on('system', { event: 'reconnect' }, () => {
  queryClient.invalidateQueries() // Refresh all data on reconnect
})
```

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

### Pitfall 12: Generated Supabase Types Not Regenerated After Migrations

**What goes wrong:** TypeScript types from `supabase gen types` are stale after a migration. New columns exist in the database but not in the type definitions. The app compiles without errors but runtime behavior is wrong (missing fields).

**Prevention:** Add type generation to the post-migration workflow. Consider a CI step that generates types and fails if they differ from the committed types.

### Pitfall 13: Supabase Storage URLs Without Signed URLs for Private Files

**What goes wrong:** BOL documents, inspection photos, and financial documents are stored with public URLs. Anyone with the URL can access them, including tenants who should not have access.

**Prevention:** Use Supabase Storage's private buckets with signed URLs (time-limited). Generate signed URLs in Server Actions, never in client components.

### Pitfall 14: Date/Time Handling Without Timezone Awareness

**What goes wrong:** Orders have pickup_date and dropoff_date stored as DATE type. A carrier in Pacific time creates an order, and a driver in Eastern time sees the wrong date because the app does not handle timezone conversion.

**Prevention:** Store all timestamps as `timestamptz` (timestamp with timezone). Store dates as `date` only when the timezone is irrelevant (e.g., driver's birth date). Display dates/times in the tenant's configured timezone, stored as a tenant setting.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Multi-tenancy foundation | Pitfall 1 (RLS function caching) | Establish `(SELECT ...)` pattern in project template from day 1 |
| Multi-tenancy foundation | Pitfall 2 (missing tenant isolation) | Create checklist of all tables, verify each has `tenant_id` or is explicitly shared |
| Auth + Stripe integration | Pitfall 4 (webhook idempotency) | Implement `stripe_events` table for deduplication from the start |
| Auth + Stripe integration | Pitfall 5 (JWT stale plan data) | Force token refresh on plan change webhook |
| Core TMS features | Pitfall 6 (dispatch board too early) | Ship list view first, iterate based on carrier feedback |
| Tier enforcement | Pitfall 7 (UI-only limits) | Database triggers + Server Action checks, not just frontend |
| Scaling | Pitfall 8 (connection limits) | Use pooled connections for all serverless paths |
| Reporting | Pitfall 14 (timezone handling) | Establish timezone convention before any date-heavy features |

## Sources
- [Supabase: RLS Performance and Best Practices (Official)](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [MakerKit: Supabase RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Stripe: Build Subscriptions Integration](https://docs.stripe.com/billing/subscriptions/build-subscriptions)
- [AntStack: Optimizing RLS Performance](https://www.antstack.com/blog/optimizing-rls-performance-with-supabase/)
- [MakerKit: E2E Testing SaaS with Playwright](https://makerkit.dev/blog/tutorials/playwright-testing)
