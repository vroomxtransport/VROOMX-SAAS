# Domain Pitfalls: VroomX SaaS TMS

**Domain:** Multi-tenant SaaS Transportation Management System
**Researched:** 2026-02-11
**Confidence:** HIGH (verified across official docs, OWASP, Supabase docs, Stripe docs, and multiple corroborating sources)

---

## Table of Contents

1. [Critical Pitfalls](#critical-pitfalls) -- Mistakes that cause data breaches, rewrites, or business failure
2. [Moderate Pitfalls](#moderate-pitfalls) -- Mistakes that cause delays, tech debt, or lost revenue
3. [Minor Pitfalls](#minor-pitfalls) -- Mistakes that cause friction but are fixable
4. [Lessons from Horizon Star](#lessons-from-horizon-star) -- Patterns to explicitly NOT carry forward
5. [Phase-Specific Warnings](#phase-specific-warnings)

---

## Critical Pitfalls

Mistakes that cause data breaches, full rewrites, or business-ending failures. These are non-negotiable to get right.

---

### CRIT-1: Cross-Tenant Data Leakage via Missing RLS Policies

**What goes wrong:** A table is created without RLS enabled, or RLS is enabled but no policies are created. Any authenticated user can read/write any tenant's data. This is the #1 cause of data breaches in Supabase-backed SaaS.

**Why it happens:** RLS is disabled by default when creating tables in Supabase. Developers add tables during feature work and forget to enable RLS + create policies. In January 2025, 170+ apps built with Lovable were found to have exposed databases (CVE-2025-48757) because developers did not enable RLS.

**Consequences:** Complete data breach. Tenant A sees Tenant B's orders, drivers, financial data. For a TMS handling carrier operations and payments, this is catastrophic -- legal liability, lost trust, dead company.

**Prevention:**
1. **Database-level safety net:** Create a CI check or pre-deploy script that verifies ALL tables in the `public` schema have RLS enabled.
2. **Migration template:** Every new migration must include `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and at least one policy.
3. **Automated test:** Run a test as an authenticated user from Tenant A that attempts to access Tenant B data -- must return empty results for SELECT, error for INSERT.

```sql
-- ANTI-PATTERN: Table without RLS
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  vehicle_vin TEXT,
  revenue DECIMAL
);
-- DANGER: No RLS enabled. Any authenticated user sees all orders.

-- CORRECT: Always enable RLS and create policies
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  vehicle_vin TEXT,
  revenue DECIMAL
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON orders
  FOR ALL TO authenticated
  USING (tenant_id = (select auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (select auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);
```

**Detection:** Automated test suite that runs on every PR. Also: query `pg_tables` joined with `pg_policies` to find tables without policies.

```sql
-- Find tables with RLS disabled or no policies
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT IN (SELECT tablename FROM pg_policies WHERE schemaname = 'public');
```

**Confidence:** HIGH -- verified via Supabase official docs and CVE-2025-48757 incident reports.

---

### CRIT-2: RLS Policies That Look Correct But Allow Cross-Tenant Access

**What goes wrong:** RLS policies are present but contain subtle bugs that allow data leakage. These pass casual review but fail under adversarial conditions.

**Why it happens:** Several specific patterns that look correct but are broken:

**Anti-Pattern 2a: Using `user_metadata` instead of `app_metadata`**
```sql
-- DANGEROUS: user_metadata is modifiable by the user via Supabase Auth API
CREATE POLICY "tenant_check" ON orders
  USING ((auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid = tenant_id);
-- An attacker can call supabase.auth.updateUser({ data: { tenant_id: 'victim-tenant-uuid' } })
-- and gain access to any tenant's data.

-- CORRECT: Use app_metadata (only settable server-side)
CREATE POLICY "tenant_check" ON orders
  USING ((auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid = tenant_id);
```

**Anti-Pattern 2b: NULL comparison silently passes**
```sql
-- DANGEROUS: If auth.uid() returns NULL (anonymous user), comparison fails silently
-- The policy returns FALSE for all rows (no data), but doesn't error
-- However, if tenant_id is NULLABLE and happens to be NULL, NULL = NULL is NULL (not TRUE),
-- so the row is excluded. But if the check uses IS NOT DISTINCT FROM, NULLs match.
CREATE POLICY "check" ON orders USING (tenant_id IS NOT DISTINCT FROM get_tenant_id());
-- If get_tenant_id() returns NULL, this matches ALL rows where tenant_id is NULL.

-- CORRECT: Always use strict equality and ensure tenant_id is NOT NULL
-- Also ensure the function never returns NULL
```

**Anti-Pattern 2c: Missing SELECT policy alongside UPDATE**
```sql
-- UPDATE policy exists but no SELECT policy
-- User can update rows (blind) but not see them -- still a data integrity violation
CREATE POLICY "update_orders" ON orders FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id());
-- Missing: SELECT policy. Depending on query patterns, this may allow blind writes.

-- CORRECT: Always create policies for ALL operations, or use FOR ALL
```

**Anti-Pattern 2d: Stale JWT after org removal**
```sql
-- User is removed from organization, but their JWT still contains tenant_id
-- JWT is valid for up to 1 hour (Supabase default)
-- During that window, the removed user still passes RLS checks
```

**Prevention:**
1. Use `app_metadata` exclusively for authorization claims (tenant_id, role).
2. Ensure `tenant_id` is `NOT NULL` on every tenant-scoped table.
3. Create policies for ALL operations (SELECT, INSERT, UPDATE, DELETE) or use `FOR ALL`.
4. For sensitive operations (billing, payroll), add a secondary check against a `memberships` table.
5. Consider shorter JWT expiry (15-30 min) for high-security environments.

**Detection:** Write adversarial tests that:
- Create User A in Tenant A, User B in Tenant B
- Attempt every CRUD operation from User A on Tenant B data
- Verify zero results / errors for every operation

**Confidence:** HIGH -- verified via Supabase official docs on token security, custom claims, and RLS best practices.

---

### CRIT-3: RLS Performance Destroying Dashboard Load Times

**What goes wrong:** Dashboard loads take 5-30 seconds because RLS policies are evaluated per-row without optimization. On tables with 100K+ rows (orders, trips over time), this is crippling.

**Why it happens:** Two specific anti-patterns:

**Anti-Pattern 3a: Uncached function calls evaluated per-row**
```sql
-- SLOW: auth.uid() called for EVERY row in the table
CREATE POLICY "read_orders" ON orders FOR SELECT
  USING (auth.uid() = user_id);
-- On a 100K row table, auth.uid() is called 100K times

-- FAST: Wrap in SELECT to cache as initPlan (evaluated once)
CREATE POLICY "read_orders" ON orders FOR SELECT
  USING ((select auth.uid()) = user_id);
-- auth.uid() called ONCE, result reused for all rows
-- Supabase docs report: 11,000ms -> 7ms improvement
```

**Anti-Pattern 3b: Join-heavy policies with wrong direction**
```sql
-- SLOW: For each row, check if current user is in the team
CREATE POLICY "team_read" ON orders FOR SELECT USING (
  auth.uid() IN (
    SELECT user_id FROM team_members WHERE team_members.team_id = orders.tenant_id
  )
);
-- Evaluates subquery per-row

-- FAST: Build user's team set first, then filter
CREATE POLICY "team_read" ON orders FOR SELECT USING (
  tenant_id IN (
    SELECT tenant_id FROM team_members WHERE user_id = (select auth.uid())
  )
);
-- Builds set once, then uses index scan
```

**Anti-Pattern 3c: Missing indexes on RLS columns**
```sql
-- Without index: full table scan on every query
-- With index: 171ms -> <0.1ms on large tables
CREATE INDEX idx_orders_tenant_id ON orders USING btree (tenant_id);
```

**Prevention:**
1. ALWAYS wrap `auth.uid()` and `auth.jwt()` in `(select ...)` in policy definitions.
2. ALWAYS create btree indexes on columns referenced in RLS policies.
3. ALWAYS specify `TO authenticated` in policies to skip evaluation for anonymous requests.
4. Reverse join direction: filter user's memberships first, then match against table.
5. Use `security definer` functions for complex multi-table permission checks.
6. Even with RLS, add explicit `.eq('tenant_id', tenantId)` in application queries to help the query planner.

**Performance benchmarks (from Supabase official docs):**
| Scenario | Before | After | Improvement |
|----------|--------|-------|-------------|
| Indexed user_id | 171ms | <0.1ms | >1700x |
| Wrapped function call | 11,000ms | 7ms | ~1571x |
| Security definer function | 178,000ms | 12ms | ~14,833x |

**Confidence:** HIGH -- numbers from Supabase official troubleshooting docs.

---

### CRIT-4: Stripe Webhook Race Conditions Causing Subscription State Corruption

**What goes wrong:** Webhook events arrive out of order, are processed more than once, or fail silently -- causing tenants to be provisioned incorrectly, double-charged, or stuck in limbo states.

**Why it happens:** Three specific Stripe behaviors that surprise developers:

1. **Non-guaranteed event ordering.** Stripe explicitly states: "Stripe does not guarantee delivery of events in the order in which they are generated." A `customer.subscription.updated` can arrive BEFORE `customer.subscription.created`.

2. **Duplicate delivery.** Stripe retries failed webhooks for up to 3 days. Without idempotency checks, you process the same event multiple times.

3. **5-minute signature verification window.** Webhook signatures expire after 5 minutes. If you queue events and verify later, verification fails.

**Anti-Pattern: Synchronous webhook processing**
```typescript
// DANGEROUS: Processing inline -- timeout causes retry, causing double-processing
export async function POST(req: Request) {
  const event = stripe.webhooks.constructEvent(body, sig, secret);

  // This takes 3 seconds (DB writes, email sends, etc.)
  await provisionTenant(event);  // If this times out, Stripe retries
  await sendWelcomeEmail(event); // Now tenant gets provisioned TWICE

  return new Response('ok', { status: 200 });
}
```

**Correct Pattern: Verify immediately, process asynchronously, with idempotency**
```typescript
export async function POST(req: Request) {
  // 1. Verify signature IMMEDIATELY (within 5-min window)
  const event = stripe.webhooks.constructEvent(body, sig, secret);

  // 2. Check idempotency -- have we already processed this event?
  const { data: existing } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .single();

  if (existing) {
    return new Response('already processed', { status: 200 });
  }

  // 3. Record the event BEFORE processing
  await supabase.from('webhook_events').insert({
    stripe_event_id: event.id,
    type: event.type,
    status: 'pending',
    payload: event.data,
    received_at: new Date().toISOString()
  });

  // 4. Return 200 immediately
  // 5. Process in background (Edge Function, queue, or cron)
  return new Response('accepted', { status: 200 });
}
```

**Subscription lifecycle state machine (must handle all transitions):**
```
checkout.session.completed -> Provision tenant, set status = 'active'
customer.subscription.updated -> Handle plan change, update tier limits
customer.subscription.deleted -> Deactivate tenant (don't delete data!)
invoice.payment_failed -> Mark as 'past_due', send dunning emails
invoice.payment_succeeded -> Clear 'past_due' flag, restore access
customer.subscription.paused -> Restrict to read-only access
```

**Critical rule:** Handle out-of-order events by always fetching the CURRENT subscription state from the Stripe API, not relying on the event payload alone.

```typescript
// CORRECT: Always fetch current state from Stripe
const subscription = await stripe.subscriptions.retrieve(event.data.object.id);
// Use subscription.status, not event.data.object.status
```

**Prevention:**
1. Create a `webhook_events` table for idempotency tracking.
2. Verify signatures immediately, return 200, process asynchronously.
3. Always fetch current subscription state from Stripe API after receiving an event.
4. Build a subscription state machine with explicit transitions.
5. Monitor webhook delivery directly (don't rely on Stripe's multi-day failure emails).
6. Use Stripe CLI (`stripe listen`) during development to test webhook flows.
7. Handle timestamps in UTC -- never use local time for subscription dates.

**Confidence:** HIGH -- verified via Stripe official docs and multiple production post-mortems.

---

### CRIT-5: Cache Poisoning Causing Cross-Tenant Data Display

**What goes wrong:** Tenant A's dashboard data is displayed to Tenant B because cache keys are not tenant-scoped, or race conditions in async cache writes leak data across tenants.

**Why it happens:** Developers cache dashboard computations or API responses without including `tenant_id` in the cache key. Under concurrent requests, one tenant's data gets written to a shared key.

**Anti-Pattern:**
```typescript
// DANGEROUS: Cache key has no tenant context
const cacheKey = `dashboard_stats`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const stats = await computeDashboardStats(tenantId);
await redis.set(cacheKey, JSON.stringify(stats), 'EX', 300);
// Tenant B now gets Tenant A's stats

// CORRECT: Always include tenant_id in cache keys
const cacheKey = `dashboard_stats:${tenantId}`;
```

This also applies to Next.js fetch caching and React Server Component caching:
```typescript
// DANGEROUS: Server Component data fetch without tenant scoping
async function DashboardPage() {
  // This fetch result may be cached and served to different tenants
  const data = await fetch('https://api.example.com/stats');
  // ...
}

// CORRECT: Include tenant ID in fetch + use no-store or revalidate
async function DashboardPage() {
  const tenantId = await getTenantId();
  const data = await fetch(`https://api.example.com/stats?tenant=${tenantId}`, {
    cache: 'no-store' // Or use next: { revalidate: 60, tags: [`tenant-${tenantId}`] }
  });
}
```

**Prevention:**
1. Prefix ALL cache keys with `tenant:{tenant_id}:`.
2. Include tenant context in Next.js fetch cache tags for targeted invalidation.
3. For real-time dashboard data, use `cache: 'no-store'` or short revalidation windows.
4. Write an integration test that logs in as Tenant A, loads dashboard, then logs in as Tenant B and verifies different data appears.

**Confidence:** HIGH -- this is a well-documented multi-tenant anti-pattern across multiple sources.

---

### CRIT-6: Global State Leaking Tenant Context in Serverless Functions

**What goes wrong:** A global or module-scoped variable holds tenant context from one request and leaks to the next request served by the same function instance.

**Why it happens:** Serverless functions (Vercel, Supabase Edge Functions) can reuse the same execution context across multiple requests. If tenant_id is stored in a module-level variable, the second request inherits the first request's tenant context.

**Anti-Pattern:**
```typescript
// DANGEROUS: Module-level tenant state
let currentTenantId: string; // Persists between requests!

export async function GET(req: Request) {
  currentTenantId = extractTenantFromJWT(req);
  const data = await getOrders(); // Uses global currentTenantId
  return Response.json(data);
}

// Request 1 (Tenant A) sets currentTenantId = 'A'
// Request 2 (Tenant B) arrives BEFORE Request 1 finishes
// Request 1 now reads Tenant B's data
```

**Correct Pattern:**
```typescript
// CORRECT: Pass tenant context through function arguments, never store globally
export async function GET(req: Request) {
  const tenantId = extractTenantFromJWT(req); // Derived fresh per request
  const data = await getOrders(tenantId);      // Explicitly passed
  return Response.json(data);
}
```

**Prevention:**
1. NEVER use module-level mutable state for request-specific data.
2. ALWAYS derive tenant context from the request (JWT, headers) for each request.
3. Pass tenant context explicitly through function parameters.
4. Lint rule: flag any `let` declarations at module scope in API routes.

**Confidence:** HIGH -- documented in OWASP Multi-Tenant Security Cheat Sheet and multiple SaaS architecture guides.

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or lost revenue. Painful but survivable.

---

### MOD-1: Supabase Connection Limits Causing 500 Errors Under Load

**What goes wrong:** Dashboard pages make 5-10 concurrent Supabase queries. With 20+ concurrent users, you hit the connection pool limit and get connection refused errors.

**Why it happens:** Supabase connection limits are tighter than developers expect:

| Instance | Max DB Connections | Max Pooler Clients |
|----------|-------------------|--------------------|
| Nano (free) | 60 | 200 |
| Micro | 60 | 200 |
| Small | 90 | 400 |
| Medium | 120 | 600 |
| Large | 160 | 800 |

If each page load makes 8 queries and you have 30 concurrent users, that is 240 connections -- exceeding the Micro tier limit.

**Prevention:**
1. Use Supavisor transaction mode (port 6543) for all application connections -- connections are released after each transaction.
2. Batch related queries: instead of 8 separate fetches, use Supabase `.select('*, orders(*), drivers(*)')` joins.
3. Use server-side data fetching in Next.js Server Components to reduce client-side connection pressure.
4. Monitor connection usage via Supabase dashboard and set up alerts at 70% capacity.
5. Plan for Supabase Small ($60/mo) minimum for production SaaS.

**Confidence:** HIGH -- connection limits from Supabase official compute docs.

---

### MOD-2: Edge Function Cold Starts Degrading Webhook Processing

**What goes wrong:** Stripe webhooks hit a Supabase Edge Function that has not been invoked recently. The cold start adds 400ms+ latency, and combined with signature verification, the 5-second Stripe timeout is approached. Under spiky load, this causes webhook failures.

**Why it happens:** Edge Functions have cold start latency:
- Cold latency median: 400ms
- Hot latency median: 125ms
- With spikey workloads, gateway overhead is consistently poor

Edge Function limits:
- CPU time: 2 seconds per request
- Memory: 256MB max
- Execution duration: 150s (free), 400s (paid)
- No multithreading

**Prevention:**
1. Keep webhook handlers minimal: verify signature, store event, return 200.
2. Process events asynchronously via a separate scheduled function or database trigger.
3. Use Vercel API routes for Stripe webhooks instead of Edge Functions (more predictable cold starts).
4. If using Edge Functions, implement a keep-alive ping to prevent cold starts during business hours.

**Confidence:** HIGH -- limits from Supabase official Edge Functions docs.

---

### MOD-3: Next.js App Router Caching Showing Stale Dashboard Data

**What goes wrong:** A dispatcher creates a new order, navigates away, comes back to the dashboard, and the order is missing. The page shows cached data.

**Why it happens:** Next.js App Router has multiple caching layers that are aggressive by default:
1. **Fetch cache:** `fetch()` results cached indefinitely by default.
2. **Router cache:** Client-side cache of previously visited routes. Cannot be selectively invalidated via API.
3. **Full Route Cache:** Pre-rendered pages cached at build time.

For a data-heavy TMS dashboard where data changes every few minutes, these caches cause stale UI.

**Anti-Pattern: Not revalidating after mutations**
```typescript
// Server Action that creates an order but doesn't invalidate cache
async function createOrder(formData: FormData) {
  'use server';
  await supabase.from('orders').insert({ ... });
  // Dashboard still shows old data because cache wasn't invalidated!
}

// CORRECT: Always revalidate after mutations
import { revalidatePath } from 'next/cache';
async function createOrder(formData: FormData) {
  'use server';
  await supabase.from('orders').insert({ ... });
  revalidatePath('/dashboard');
  revalidatePath('/orders');
}
```

**Anti-Pattern: Server Components calling Route Handlers**
```typescript
// WASTEFUL: Server Component making HTTP request to its own Route Handler
async function OrderList() {
  const res = await fetch('http://localhost:3000/api/orders');
  const data = await res.json();
  // ...
}

// CORRECT: Call database directly from Server Component
async function OrderList() {
  const supabase = createServerClient();
  const { data } = await supabase.from('orders').select('*');
  // ...
}
```

**Prevention:**
1. For TMS dashboards, use `cache: 'no-store'` or short `revalidate` intervals on all data fetches.
2. Call `revalidatePath()` or `revalidateTag()` after every Server Action mutation.
3. For real-time data (order status changes), use Supabase Realtime subscriptions in Client Components.
4. Do NOT call your own Route Handlers from Server Components -- call Supabase directly.

**Confidence:** HIGH -- verified via Vercel official blog post on common App Router mistakes.

---

### MOD-4: Hydration Errors from Server/Client Component Boundary Confusion

**What goes wrong:** React hydration errors appear in production, causing white screens or broken UI. Elements flicker or show incorrect data on initial load.

**Why it happens:** Server Components and Client Components render differently. Common triggers for TMS:
- **Date formatting:** Server renders `Feb 11, 2026`, client renders `2/11/2026` (locale difference).
- **Currency formatting:** `$1,234.56` on server vs `$1234.56` on client (Intl.NumberFormat locale mismatch).
- **Auth-dependent rendering:** Server does not know the user is logged in, renders logged-out state.
- **Window/localStorage access:** Server does not have `window`, code crashes.

**Anti-Pattern: Using browser APIs in shared components**
```tsx
// DANGEROUS: This runs on server too, where window doesn't exist
function DashboardHeader() {
  const theme = window.localStorage.getItem('theme'); // Server crash!
  return <h1 className={theme}>Dashboard</h1>;
}

// CORRECT: Browser APIs only in Client Components, with checks
'use client';
function DashboardHeader() {
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    setTheme(window.localStorage.getItem('theme') || 'light');
  }, []);
  return <h1 className={theme}>Dashboard</h1>;
}
```

**Anti-Pattern: Sprinkling `'use client'` everywhere**
```tsx
// WASTEFUL: Making everything a Client Component defeats the purpose of RSC
'use client'; // <-- Don't add this to every file!
export default function OrdersPage() {
  // Now this can't use server-side data fetching
}

// CORRECT: Keep page-level components as Server Components
// Only add 'use client' to interactive leaf components
export default async function OrdersPage() {
  const orders = await fetchOrders(); // Server-side fetch
  return <OrderTable orders={orders} />; // OrderTable can be client if needed
}
```

**Prevention:**
1. Keep `'use client'` on leaf components only (buttons, forms, interactive widgets).
2. Use consistent date/currency formatting via a shared utility that produces deterministic output.
3. Never access `window`, `localStorage`, or `document` in Server Components.
4. Test with `next build && next start` (not just `next dev`) to catch hydration issues.

**Confidence:** HIGH -- verified via Next.js official docs and Vercel blog post.

---

### MOD-5: Onboarding Drop-Off Killing Conversion

**What goes wrong:** 64% of users abandon signup flows. For a self-service SaaS TMS, this means most potential customers never complete setup.

**Why it happens:** Common friction points for TMS signup:
1. **Too many fields upfront.** Asking for company name, DOT number, MC number, fleet size, payment method all before showing the product.
2. **Requiring payment before value.** Credit card required before the user sees a single dashboard.
3. **No sample data.** Empty dashboard after signup -- user doesn't know what the product looks like in use.
4. **Complex first action.** First thing user needs to do is "Add a driver" but the form has 20 fields.

**Statistics:**
- 75% of new users abandon products within the first week.
- Each removed form field improves completion by 3-8%.
- Time-to-first-value should be under 15 minutes.
- Deferred payment doubles conversion rates vs upfront credit card.

**Prevention:**
1. **Signup: 3 fields max.** Email, password, company name. Everything else comes later.
2. **14-day free trial, no credit card.** Let users experience full functionality.
3. **Sample data option.** Offer to populate demo orders, drivers, and trips so the dashboard looks real.
4. **Guided first session.** After signup: "Let's add your first driver" with a simplified form (name, phone, type -- that's it).
5. **Progressive profiling.** Collect DOT#, MC#, fleet size, address during normal usage, not upfront.
6. **Track funnel metrics from day 1.** Signup started -> Email verified -> First driver added -> First order created -> First trip completed -> Converted to paid.

**Confidence:** HIGH -- verified across multiple SaaS onboarding research sources with consistent data.

---

### MOD-6: Feature Creep Before Product-Market Fit

**What goes wrong:** Team spends 6+ months building compliance modules, IFTA reporting, payroll PDFs, maintenance tracking -- and launches with zero paying customers. The features nobody asked for delay the features customers actually need.

**Why it happens:** The Horizon Star TMS has 20+ modules. The temptation is to port all of them into VroomX v1. But Horizon Star's features were built over time for one specific carrier's needs.

**What to absolutely NOT build before having paying customers:**
- Payroll/settlement PDFs
- IFTA fuel tax reporting
- Maintenance scheduling
- Compliance tracking (CDL, violations, claims)
- Chrome Extension for Central Dispatch
- Advanced analytics/executive dashboard
- Customer-facing portal
- White-label branding
- Multi-language support

**What to build for v1 (validated by PROJECT.md scope):**
- Auth + tenant provisioning
- Orders (create, status, assign to trip)
- Trips (create, assign driver+truck, financials)
- Drivers + Trucks (basic CRUD)
- Billing basics (payment status tracking, aging)
- iOS driver app (inspections, trip view)
- Stripe subscription management

**Prevention:**
1. Treat the "Out of Scope" list in PROJECT.md as a contract. Print it out and tape it to the wall.
2. Every feature request gets answered with: "Do we have paying customers asking for this?"
3. Set a hard deadline: Launch v1 in X weeks. Cut features, never extend timeline.
4. Build feature flags from day 1 so you can ship incrementally.

**Confidence:** HIGH -- universal startup wisdom, validated by PROJECT.md's own scope decisions.

---

### MOD-7: Free Tier Abuse and Support Drain

**What goes wrong:** Free tier users consume server resources, file support tickets, and never convert. 95-98% of free users never convert to paid.

**Why it happens:** Free tiers attract users with no intent to pay. In TMS specifically, a small carrier might find the free tier "good enough" and never upgrade.

**Prevention:**
1. **Free TRIAL, not free TIER.** 14-day full-access trial, then paid. No permanent free plan.
2. **Require work email.** Reduce signups from tire-kickers. (Optional -- adds friction.)
3. **Hard limits on trial.** Max 5 orders, 2 drivers, 1 truck in trial. Enough to evaluate, not enough to run a business.
4. **Automated trial expiry.** Read-only access after trial ends. Data preserved for 30 days.
5. **Track trial engagement.** If a trial user has not created an order by day 3, send a nudge email with onboarding help.

**Trial conversion benchmarks:**
- Opt-in (no credit card): 18-25% conversion
- Opt-out (credit card required): ~49% conversion
- Recommendation for VroomX: Opt-in trial (lower friction, better for a new product establishing trust)

**Confidence:** MEDIUM -- benchmarks from SaaS conversion rate studies, not TMS-specific.

---

### MOD-8: Pricing Tier Mistakes That Leave Money on the Table

**What goes wrong:** Pricing is too low (never covers infrastructure costs), too high (nobody signs up), or structured wrong (per-user pricing when value is per-truck).

**Why it happens:** SaaS TMS pricing ranges from $50 to $500/user/month. Teams either underprice to attract customers or overprice and get zero traction.

**Common pricing mistakes for TMS:**
1. **Per-user pricing for a carrier.** A carrier has 2 dispatchers and 15 drivers. Per-user pricing penalizes the drivers (who barely use the web app) or forces complex "driver seat" vs "dispatcher seat" tiers.
2. **Flat pricing regardless of fleet size.** A 2-truck operator pays the same as a 50-truck fleet. The 50-truck fleet gets massive value; the 2-truck operator feels overcharged.
3. **Hiding essential features in higher tiers.** If invoicing is only available on Pro, the Starter tier is useless for a real carrier.
4. **No annual discount.** Missing easy revenue stabilization.

**Recommended approach for VroomX:**
- **Starter ($79/mo):** 1-5 trucks, 1-3 users, core features (orders, trips, drivers, trucks, basic billing), 1 driver app seat
- **Pro ($199/mo):** 6-20 trucks, unlimited users, full features + advanced billing + iOS app for all drivers
- **Enterprise ($499/mo):** 20+ trucks, priority support, custom onboarding, API access
- **Pricing axis: trucks, not users.** Trucks = value delivered. More trucks = more orders = more revenue for the carrier.
- **Annual: 2 months free (17% discount)**

**Confidence:** MEDIUM -- based on TMS market research and general SaaS pricing principles. Needs validation with actual customers.

---

### MOD-9: Database Migration Breaking Existing Tenants

**What goes wrong:** A schema migration adds a NOT NULL column without a default value, or removes a column that existing tenants' saved queries depend on. All existing tenants break simultaneously.

**Why it happens:** In a shared-schema multi-tenant model (Supabase RLS approach), one migration affects ALL tenants at once. There is no "roll out to one tenant first."

**Anti-Pattern:**
```sql
-- DANGEROUS: Adding NOT NULL column without default breaks all existing rows
ALTER TABLE orders ADD COLUMN dispatch_priority TEXT NOT NULL;
-- ERROR: column "dispatch_priority" contains null values

-- DANGEROUS: Renaming a column breaks all running application code
ALTER TABLE orders RENAME COLUMN origin TO pickup_location;
-- Every Supabase client query using 'origin' now fails
```

**Correct Pattern: Expand-Backfill-Contract**
```sql
-- Step 1: EXPAND - Add nullable column with default
ALTER TABLE orders ADD COLUMN dispatch_priority TEXT DEFAULT 'normal';

-- Step 2: BACKFILL - Populate existing rows (in batches for large tables)
UPDATE orders SET dispatch_priority = 'normal' WHERE dispatch_priority IS NULL;

-- Step 3: CONTRACT - Add constraint AFTER data is populated (optional, later)
ALTER TABLE orders ALTER COLUMN dispatch_priority SET NOT NULL;
```

**For column renames:**
```sql
-- Step 1: Add new column
ALTER TABLE orders ADD COLUMN pickup_location TEXT;
-- Step 2: Copy data
UPDATE orders SET pickup_location = origin;
-- Step 3: Update application code to use new column
-- Step 4: Drop old column (weeks later, after all code is migrated)
ALTER TABLE orders DROP COLUMN origin;
```

**Prevention:**
1. Every migration must be backward-compatible. New code should work with old schema.
2. Never use NOT NULL without a DEFAULT.
3. Never rename columns -- add new, migrate, drop old.
4. Never drop columns in the same deploy that removes their usage from code.
5. Test migrations against a copy of production data before applying.
6. Use feature flags to decouple schema changes from code changes.

**Confidence:** HIGH -- standard practice documented across multiple database migration guides.

---

### MOD-10: iOS App Multi-Tenant Context Confusion

**What goes wrong:** A driver who works for two carriers (yes, this happens in vehicle transport) logs into the app and sees orders from the wrong carrier, or creates inspection data linked to the wrong tenant.

**Why it happens:** The iOS app stores a single auth token and tenant_id. If the driver switches tenants, stale cached data or a cached tenant_id can cause cross-tenant operations.

**Prevention:**
1. On the iOS app, tenant context must be derived from the JWT on every API call, not stored locally.
2. When a user has multiple organization memberships, show a tenant picker on login.
3. Clear ALL local caches when switching tenants (CoreData, UserDefaults, in-memory caches).
4. Inspection photos should be uploaded to tenant-scoped storage paths: `{tenant_id}/inspections/{inspection_id}/`.
5. Implement a "tenant mismatch" check: before saving any data, verify that the JWT's tenant_id matches the expected tenant for the current session.

**Token refresh pitfall:**
```swift
// DANGEROUS: Multiple concurrent requests trigger multiple token refreshes
// causing race conditions
func makeAuthenticatedRequest() async throws {
    if tokenIsExpired() {
        await refreshToken() // Two concurrent calls = two refresh attempts
    }
    // ...
}

// CORRECT: Use an actor to serialize token refresh
actor TokenManager {
    private var refreshTask: Task<String, Error>?

    func getValidToken() async throws -> String {
        if let existing = refreshTask {
            return try await existing.value
        }
        if tokenIsValid() {
            return currentToken
        }
        let task = Task { try await performRefresh() }
        refreshTask = task
        defer { refreshTask = nil }
        return try await task.value
    }
}
```

**Confidence:** MEDIUM -- based on iOS auth patterns and general multi-tenant mobile architecture. The specific driver-works-for-two-carriers scenario is derived from Horizon Star domain knowledge.

---

### MOD-11: Realtime Subscriptions Without Tenant Filtering

**What goes wrong:** Supabase Realtime subscriptions are set up without filtering by tenant_id. Every tenant receives change notifications for ALL tenants' data.

**Why it happens:** The default Realtime subscription pattern subscribes to the entire table:

```typescript
// DANGEROUS: Subscribes to ALL changes on the orders table
supabase.channel('orders')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handler)
  .subscribe();
// Every tenant gets notified of every other tenant's order changes
```

Note: RLS applies to Realtime, so the actual data payload is filtered. But the NOTIFICATION is still sent, consuming your message quota and leaking the EXISTENCE of operations (timing attacks).

**Correct Pattern:**
```typescript
// CORRECT: Filter by tenant_id
supabase.channel('orders')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'orders',
    filter: `tenant_id=eq.${tenantId}`
  }, handler)
  .subscribe();
```

**Supabase Realtime limits to be aware of:**
| Resource | Free | Pro | Pro (no cap) |
|----------|------|-----|--------------|
| Concurrent connections | 200 | 500 | 10,000 |
| Messages/second | 100 | 500 | 2,500 |
| Channels/connection | 100 | 100 | 100 |

With 50 tenants each having 5 users with Realtime subscriptions, that is 250 connections -- exceeding Free tier.

**Confidence:** HIGH -- verified via Supabase Realtime docs and limits page.

---

## Minor Pitfalls

Mistakes that cause friction or annoyance but are fixable without rewrites.

---

### MIN-1: Supabase Storage Without Tenant-Scoped Paths

**What goes wrong:** Inspection photos, BOL documents, and company files are uploaded to a flat bucket structure. Files from different tenants can collide on filenames, and bucket policies are hard to write correctly.

**Prevention:**
```
Bucket structure:
  tenant-files/
    {tenant_id}/
      inspections/
        {inspection_id}/
          photo_1.jpg
          photo_2.jpg
      documents/
        {document_id}/
          bol.pdf
```

RLS policy on `storage.objects`:
```sql
CREATE POLICY "tenant_isolation_storage" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'tenant-files'
    AND (storage.foldername(name))[1] = (select auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  )
  WITH CHECK (
    bucket_id = 'tenant-files'
    AND (storage.foldername(name))[1] = (select auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  );
```

**Confidence:** HIGH -- verified via Supabase storage docs and OWASP multi-tenant cheat sheet.

---

### MIN-2: Not Handling Supabase Edge Function Port Restrictions

**What goes wrong:** Email sending via SMTP fails silently from Edge Functions because ports 25 and 587 are blocked.

**Prevention:** Use HTTP-based email APIs (Resend, SendGrid) exclusively. Never attempt SMTP from Edge Functions. The current Horizon Star setup already uses Resend -- continue this pattern.

**Confidence:** HIGH -- documented in Supabase Edge Functions limits.

---

### MIN-3: Views Bypassing RLS by Default

**What goes wrong:** Developer creates a PostgreSQL view for aggregated dashboard data. The view bypasses RLS because views run as the view creator (definer) by default, not as the invoking user.

**Prevention:**
```sql
-- CORRECT: Use security_invoker (PostgreSQL 15+, which Supabase supports)
CREATE VIEW tenant_order_summary
WITH (security_invoker = true) AS
SELECT tenant_id, COUNT(*) as order_count, SUM(revenue) as total_revenue
FROM orders
GROUP BY tenant_id;
-- Now RLS policies on 'orders' are enforced when querying this view
```

**Confidence:** HIGH -- verified via Supabase RLS best practices documentation.

---

### MIN-4: Redirect Inside Try/Catch in Next.js

**What goes wrong:** `redirect()` in Next.js throws a special internal error. If called inside try/catch, the redirect is swallowed and the page shows an error instead of redirecting.

```typescript
// BROKEN: redirect never fires
async function handleLogin(formData: FormData) {
  'use server';
  try {
    await authenticate(formData);
    redirect('/dashboard'); // This throws NEXT_REDIRECT, caught by catch block
  } catch (error) {
    return { error: 'Login failed' }; // redirect error caught here
  }
}

// CORRECT: redirect outside try/catch
async function handleLogin(formData: FormData) {
  'use server';
  let success = false;
  try {
    await authenticate(formData);
    success = true;
  } catch (error) {
    return { error: 'Login failed' };
  }
  if (success) redirect('/dashboard');
}
```

**Confidence:** HIGH -- documented in Vercel's official blog post on App Router mistakes.

---

### MIN-5: Not Specifying `TO authenticated` in RLS Policies

**What goes wrong:** RLS policies without a role specification are evaluated for ALL roles, including `anon`. This means unauthenticated requests still trigger complex policy evaluation (subqueries, function calls) before returning empty results -- wasting CPU.

```sql
-- WASTEFUL: Evaluated for anon requests too
CREATE POLICY "read_orders" ON orders FOR SELECT
  USING (tenant_id = get_tenant_id());

-- CORRECT: Skip evaluation entirely for unauthenticated requests
CREATE POLICY "read_orders" ON orders FOR SELECT
  TO authenticated
  USING (tenant_id = get_tenant_id());
```

**Confidence:** HIGH -- from Supabase RLS performance best practices.

---

### MIN-6: Monitoring Blind Spots from Day 1

**What goes wrong:** A tenant's data is corrupted, webhook processing silently fails for 3 days, or the database hits connection limits -- and nobody knows until a customer complains.

**Essential metrics to track from day 1:**

| Category | Metric | Alert Threshold |
|----------|--------|-----------------|
| **Availability** | API response time (p95) | > 2 seconds |
| **Availability** | Error rate (5xx) | > 1% of requests |
| **Database** | Connection pool utilization | > 70% |
| **Database** | Query duration (p95) | > 500ms |
| **Auth** | Failed login attempts per tenant | > 10/hour |
| **Webhooks** | Stripe webhook processing lag | > 30 seconds |
| **Webhooks** | Failed webhook events | Any |
| **Business** | Signup completion rate | < 50% |
| **Business** | Trial -> Paid conversion | Weekly review |
| **Security** | Cross-tenant access attempts | Any (should be zero) |

**Tools (aligned with PROJECT.md decisions):**
- **Sentry:** Error tracking with tenant context in every event
- **PostHog:** Product analytics, funnel tracking, feature flag usage
- **Supabase Dashboard:** Database metrics, connection usage, RLS policy analysis
- **Stripe Dashboard:** Webhook delivery status, subscription churn

**Prevention:** Set up Sentry and PostHog in Phase 1, not "later." Every error event must include `tenant_id` as a tag.

**Confidence:** HIGH -- standard SaaS observability practices.

---

## Lessons from Horizon Star

Patterns from the single-tenant Horizon Star TMS that should explicitly NOT be carried into VroomX.

---

### HS-1: Global Mutable State (`appData`, `currentUser`)

**Horizon Star pattern:**
```javascript
// config.js - Global mutable state
let currentUser = JSON.parse(localStorage.getItem('horizonstar_user') || 'null');
let appData = {
  users: [], trucks: [], drivers: [], trips: [], orders: [],
  expenses: [], brokers: [], fuel_transactions: [], ...
};
```

**Why this is dangerous for multi-tenant SaaS:**
- `appData` holds ALL data for the current tenant. In a browser-based SaaS, this pattern leaks data between tenant switches.
- `currentUser` stored in localStorage persists across sessions and could reference a stale tenant.
- All 30,000+ lines of JavaScript reference these globals, making tenant context implicit rather than explicit.

**VroomX approach:**
- Server-side data fetching in Next.js Server Components. No global client-side data store holding all records.
- Tenant context derived from JWT on every server request, never from localStorage.
- Client state managed via React state/context with clear boundaries, not global variables.

---

### HS-2: Loading ALL Data on Page Load (`loadAllData()`)

**Horizon Star pattern:**
```javascript
// api.js - Loads EVERYTHING into memory
async function loadAllData(forceReload = false) {
  const [users, trucks, drivers, dispatchers, trips, orders, brokers, tasks] = await Promise.all([
    dbFetch('users'), dbFetch('trucks'), dbFetch('drivers'), dbFetch('dispatchers'),
    dbFetch('trips'), dbFetch('orders'), dbFetch('brokers'), dbFetch('tasks')
  ]);
  appData = { users, trucks, drivers, dispatchers, trips, orders, brokers, tasks, ... };
  loadSecondaryData(); // Then loads 15+ more tables
}
```

**Why this is dangerous for SaaS:**
- This loads EVERY record across 20+ tables on every page navigation. For a single carrier with 500 orders, it is manageable. For a SaaS with tenants having 10,000+ orders, it is a performance disaster.
- Makes 20+ concurrent Supabase queries, exhausting connection pool for that tenant.
- 5-minute cache TTL means stale data for most of the session.

**VroomX approach:**
- Page-level data fetching. The Orders page only loads orders. The Trips page only loads trips.
- Server-side pagination with cursor-based or offset pagination.
- Supabase Realtime for live updates on the current view only.
- React Query or SWR for client-side caching with automatic invalidation.

---

### HS-3: No Tenant Isolation (Single-Tenant Supabase)

**Horizon Star pattern:**
```javascript
// No tenant_id anywhere. All queries return all data.
dbFetch('orders', { order: 'id.desc' });
dbFetch('trips', { order: 'trip_date.desc' });
// RLS either disabled or based on single-user auth
```

**VroomX approach:**
- Every table has `tenant_id UUID NOT NULL`.
- RLS policies enforce tenant isolation at the database level.
- Application code includes `tenant_id` in queries as defense-in-depth.
- Automated tests verify isolation.

---

### HS-4: Inline HTML Rendering with Template Literals

**Horizon Star pattern:**
```javascript
function renderOrders(c) {
  c.innerHTML = `
    <div class="page-header">
      <h2>Orders</h2>
      ${orders.map(o => `
        <tr onclick="viewOrder(${o.id})">
          <td>${escapeHtml(o.vehicle_make)}</td>
          <td>$${o.revenue}</td>
        </tr>
      `).join('')}
    </div>
  `;
}
```

**Why this is dangerous for SaaS:**
- XSS risk despite `escapeHtml()` -- easy to forget on one field.
- No component reusability. Every page rebuilds everything.
- No type safety. Template literals are stringly-typed.
- Cannot be server-rendered, code-split, or lazily loaded.

**VroomX approach:**
- React components with TypeScript.
- JSX automatically escapes user input.
- Component library for consistent UI patterns (OrderCard, TripRow, DriverBadge).
- Server Components for initial render, Client Components for interactivity.

---

### HS-5: Unfiltered Realtime Subscriptions

**Horizon Star pattern:**
```javascript
// Subscribes to ALL changes on ALL key tables
realtimeChannel = sb.channel('tms-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, handleRealtimeChange)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handleRealtimeChange)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, handleRealtimeChange)
  // ...6 more tables
  .subscribe();
```

**Why this is dangerous for multi-tenant SaaS:**
- Without tenant filtering, ALL tenants receive ALL change notifications.
- Quickly exhausts Realtime message quotas (100/sec on free, 500/sec on Pro).
- Even with RLS filtering the payload, the notification volume scales with all tenants' activity.

**VroomX approach:**
- Filter Realtime subscriptions by `tenant_id`.
- Only subscribe to the table relevant to the current page view.
- Use Realtime sparingly -- only for truly real-time needs (order status changes, not all data updates).

---

### HS-6: Conflict Detection via `updated_at` Timestamp Comparison

**Horizon Star pattern:**
```javascript
// Store updated_at when opening edit modal, check before saving
function startEditing(table, id, updatedAt) {
  editingRecords[table + '_' + id] = updatedAt || new Date().toISOString();
}

async function dbUpdate(table, id, data, skipConflictCheck = false) {
  const originalTimestamp = getEditingTimestamp(table, id);
  const { data: current } = await sb.from(table).select('updated_at').eq('id', id).single();
  if (current.updated_at !== originalTimestamp) {
    // Prompt user to overwrite or refresh
  }
}
```

**What to improve for VroomX:**
- This makes an extra round-trip on every save to check for conflicts.
- For multi-user environments (multiple dispatchers), use optimistic concurrency with version numbers instead.
- Better: Use Supabase Realtime to show "User X is editing this record" before the conflict occurs.
- Consider `updated_at` with a database trigger (not application-set) to prevent manipulation.

---

### HS-7: Hardcoded Supabase Keys in Client Code

**Horizon Star pattern:**
```javascript
const SUPABASE_URL = 'https://yrrczhlzulwvdqjwvhtu.supabase.co';
const SUPABASE_KEY = 'eyJhbGci...'; // Anon key in source code
```

**Why this needs to change for VroomX:**
- The anon key is public/safe (as noted in CLAUDE.md), but it should still be in environment variables for:
  - Easy rotation if compromised.
  - Different keys per environment (dev/staging/production).
  - Preventing accidental commit of the service_role key.

**VroomX approach:**
- All Supabase keys in `.env.local` (never committed).
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for client-side.
- `SUPABASE_SERVICE_ROLE_KEY` server-side only (never exposed to client).
- Automated CI check: grep for `eyJ` (base64 JWT prefix) in source files to catch leaked keys.

---

## Security Essentials

Based on OWASP Top 10:2025 and SOC 2 readiness, here are security essentials for VroomX v1.

### OWASP Top 10:2025 Relevance to VroomX

| # | Category | VroomX Risk | Mitigation |
|---|----------|-------------|------------|
| A01 | Broken Access Control | HIGH - multi-tenant data isolation | RLS policies, tenant_id on every table, automated isolation tests |
| A02 | Security Misconfiguration | HIGH - Supabase defaults can be insecure | RLS enabled checklist, no public buckets, no exposed service keys |
| A03 | Software Supply Chain Failures | MEDIUM - npm dependencies | `npm audit` in CI, Dependabot alerts, lock file review |
| A04 | Cryptographic Failures | LOW - Supabase handles auth crypto | Ensure HTTPS everywhere, no custom crypto |
| A05 | Injection | LOW - Supabase SDK parameterizes queries | Never build raw SQL from user input in Edge Functions |
| A06 | Insecure Design | MEDIUM - multi-tenant architecture decisions | Threat model during design, defense-in-depth |
| A07 | Authentication Failures | MEDIUM - session management | Supabase Auth handles most; implement rate limiting on login |
| A08 | Software/Data Integrity | MEDIUM - webhook verification | Stripe signature verification, CI/CD pipeline signing |
| A09 | Security Logging & Alerting | MEDIUM - need visibility | Sentry + audit log table + alert on anomalies |
| A10 | Mishandling Exceptional Conditions | LOW - but edge cases exist | Error boundaries, graceful degradation, never expose stack traces |

### SOC 2 Readiness Checklist (v1 Essentials)

Over 60% of businesses prefer SOC 2-compliant vendors. For targeting mid-market carriers, SOC 2 is table stakes. Start these practices in v1 even if you do not audit until v2:

- [ ] **Access control:** RBAC implemented and enforced (admin, dispatcher, viewer)
- [ ] **Encryption at rest:** Supabase provides this by default
- [ ] **Encryption in transit:** HTTPS only (Vercel + Supabase enforce this)
- [ ] **Audit logging:** Track who did what, when, with tenant context
- [ ] **Incident response plan:** Document what to do if data breach occurs
- [ ] **Backup strategy:** Supabase daily backups + point-in-time recovery (Pro plan)
- [ ] **Vulnerability scanning:** `npm audit` + Dependabot in CI
- [ ] **MFA option:** Supabase Auth supports TOTP MFA -- enable for admin accounts
- [ ] **Data retention policy:** Document how long data is kept, how it is deleted
- [ ] **Employee access controls:** Principle of least privilege for Supabase dashboard access

**Confidence:** HIGH -- OWASP categories verified via official 2025 list; SOC 2 checklist from multiple compliance guides.

---

## Phase-Specific Warnings

Based on the full pitfall analysis, here are warnings mapped to likely development phases.

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Auth + Tenancy | CRIT-1, CRIT-2: RLS policies wrong or missing | Critical | Migration template with mandatory RLS, automated isolation tests |
| Auth + Tenancy | CRIT-6: Global state leaking tenant context | Critical | Derive tenant from JWT per-request, never store in module scope |
| Auth + Tenancy | MOD-10: iOS multi-tenant confusion | Moderate | Tenant picker on login, clear all caches on switch |
| Stripe Integration | CRIT-4: Webhook race conditions | Critical | Idempotency table, async processing, fetch current state from API |
| Stripe Integration | MOD-2: Edge Function cold starts on webhooks | Moderate | Use Vercel API routes for webhooks, not Edge Functions |
| Dashboard/UI | CRIT-3: RLS performance on large tables | Critical | Wrap auth functions in select, index RLS columns, explicit filters |
| Dashboard/UI | MOD-3: Stale cache after mutations | Moderate | revalidatePath after every server action, no-store for dashboards |
| Dashboard/UI | MOD-4: Hydration errors | Moderate | Keep 'use client' leaf-level, consistent formatting, test with next build |
| Onboarding | MOD-5: 64% signup drop-off | Moderate | 3-field signup, sample data, guided first session |
| Onboarding | MOD-7: Free tier abuse | Moderate | Trial not tier, hard limits, automated expiry |
| Data + Storage | MOD-9: Migrations breaking tenants | Moderate | Expand-backfill-contract, backward-compatible only |
| Data + Storage | MIN-1: Flat storage without tenant paths | Minor | Tenant-scoped paths from day 1, RLS on storage.objects |
| Realtime | MOD-11: Unfiltered subscriptions | Moderate | Filter by tenant_id, subscribe per-page not globally |
| Scaling | MOD-1: Connection pool exhaustion | Moderate | Transaction mode pooling, batch queries, monitor at 70% |
| Security | All OWASP items | Varies | See OWASP table above, implement from Phase 1 |

---

## Sources

### Official Documentation (HIGH confidence)
- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Edge Functions Limits](https://supabase.com/docs/guides/functions/limits)
- [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits)
- [Supabase Compute and Disk](https://supabase.com/docs/guides/platform/compute-and-disk)
- [Supabase Custom Claims & RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)
- [Supabase Token Security and RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security)
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [Stripe Idempotent Requests](https://docs.stripe.com/api/idempotent_requests)
- [Next.js Caching and Revalidation](https://nextjs.org/docs/app/getting-started/caching-and-revalidating)
- [OWASP Top 10:2025](https://owasp.org/Top10/2025/)
- [OWASP Multi-Tenant Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html)

### Verified Guides (MEDIUM-HIGH confidence)
- [Vercel Blog: Common Mistakes with Next.js App Router](https://vercel.com/blog/common-mistakes-with-the-next-js-app-router-and-how-to-fix-them)
- [MakerKit: Supabase RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Stigg: Stripe Webhook Best Practices](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks)
- [Multi-Tenant Schema Migrations (2025 Edition)](https://sollybombe.medium.com/how-to-handle-schema-migrations-safely-across-tenants-in-multi-tenant-saas-2025-edition-0c4e4fb3103b)

### Community/Research (MEDIUM confidence)
- [Multi-Tenant Leakage: When RLS Fails in SaaS](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c)
- [SOC 2 Compliance Checklist for SaaS Startups](https://trycomp.ai/soc-2-checklist-for-saas-startups)
- [SaaS Free Trial Conversion Rate Benchmarks](https://firstpagesage.com/seo-blog/saas-free-trial-conversion-rate-benchmarks/)
- [SaaS Onboarding Framework](https://www.saasfactor.co/blogs/the-science-of-saas-onboarding-a-comprehensive-framework-for-reducing-friction-improving-activation-and-preventing-churn)
- [Swift Token Refresh with Actors](https://medium.com/@moutamanuel26/preventing-multiple-token-refreshes-in-swift-using-actors-and-proper-concurrency-management-aae48a95bf4f)

### Horizon Star Analysis (HIGH confidence -- direct codebase inspection)
- `/Users/reepsy/Desktop/OG TMS CLAUDE/assets/js/config.js` -- Global state patterns
- `/Users/reepsy/Desktop/OG TMS CLAUDE/assets/js/api.js` -- Data loading and realtime patterns
