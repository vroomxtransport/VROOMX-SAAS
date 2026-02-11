# Technology Stack Research: VroomX SaaS TMS

**Project:** VroomX -- Multi-tenant SaaS TMS for vehicle transport carriers
**Researched:** 2026-02-11
**Overall Confidence:** HIGH (most recommendations verified with official docs + multiple sources)

---

## Table of Contents

1. [Frontend Framework](#1-frontend-framework)
2. [Backend / BaaS](#2-backend--baas)
3. [Multi-Tenancy Strategy](#3-multi-tenancy-strategy)
4. [Authentication](#4-authentication)
5. [Payments & Billing](#5-payments--billing)
6. [ORM / Query Layer](#6-orm--query-layer)
7. [State Management](#7-state-management)
8. [UI Component Library](#8-ui-component-library)
9. [Mobile (iOS)](#9-mobile-ios)
10. [Hosting & Deployment](#10-hosting--deployment)
11. [Monitoring & Analytics](#11-monitoring--analytics)
12. [Email](#12-email)
13. [Testing Strategy](#13-testing-strategy)
14. [Emerging Tools to Watch](#14-emerging-tools--patterns-20252026)
15. [Final Recommended Stack](#15-final-recommended-stack)

---

## 1. Frontend Framework

**Recommendation: Next.js 15+ (App Router) with TypeScript**
**Confidence: HIGH**

### The Contenders

| Framework | Best For | Ecosystem Size | SSR/SSG | Bundle Size |
|-----------|----------|----------------|---------|-------------|
| Next.js 15 (App Router) | Full-stack SaaS, SEO pages + dashboard | Massive | Excellent | Medium |
| Remix (React Router v7) | Form-heavy apps, progressive enhancement | Growing | Good | Small |
| SvelteKit | Performance-critical dashboards | Moderate | Excellent | Smallest |
| Vite + React SPA | Pure client-side dashboards | Massive (React) | None | Flexible |

### Why Next.js Wins for VroomX

**1. The SaaS boilerplate ecosystem is unmatched.** There are production-ready Next.js SaaS starters (Vercel's official starter, supastarter, next-forge) that include auth, Stripe, multi-tenancy, and dashboard layouts out of the box. No other framework comes close in starter kit maturity.

**2. You need both SSR and SPA patterns.** VroomX has two distinct surface areas:
- **Marketing/onboarding pages** (pricing, signup, docs) -- need SSR for SEO and fast initial paint
- **Dashboard** (dispatch, orders, drivers) -- SPA behavior after auth

Next.js App Router handles both with Server Components for the marketing shell and client components for interactive dashboard modules. A pure SPA (Vite) forces you to build or buy a separate marketing site. SvelteKit could do this but with a fraction of the ecosystem support.

**3. React Server Components reduce client bundle for data-heavy pages.** A TMS dashboard loads substantial data (orders, trips, drivers, trucks, financials). RSCs let you fetch and render data server-side, sending only HTML to the client for read-heavy views while keeping interactive elements as client components. This matters for carriers on slow mobile connections.

**4. Hiring and team scaling.** React/Next.js has the largest developer pool. If VroomX grows and needs to hire, finding Next.js developers is dramatically easier than finding SvelteKit or Remix specialists.

### Known Risks with Next.js App Router

These are real and documented:

- **Dev server performance:** Developers have reported 15-20 second hot reload times in large projects. Next.js 15.4+ with Turbopack has improved this significantly (100% integration test compatibility for Turbopack builds), but monitor this.
- **Complexity ceiling:** The App Router's mental model (server components, client components, server actions, caching layers) is more complex than Pages Router. New team members face a learning curve.
- **Vercel coupling:** While Next.js runs anywhere, certain features (ISR, image optimization, edge middleware) work best on Vercel. This is not a blocker but creates soft vendor lock-in.
- **Benchmarks:** Pages Router has been measured at roughly 2.5x more requests/second than App Router. For a SaaS dashboard behind auth, this is not a user-facing concern (you are not serving 10K concurrent unauthenticated requests), but be aware.

### Why NOT the Alternatives

**Remix / React Router v7:** Excellent for form-heavy CRUD apps (which a TMS is). However: (1) the ecosystem of SaaS starters is thin, (2) Remix and React Router v7 unification created migration confusion in 2024-2025, (3) the community is significantly smaller. If VroomX were a pure internal tool with no marketing site, Remix would be a stronger contender.

**SvelteKit:** Produces the smallest bundles (~50% smaller) and has the best Lighthouse scores out of the box (~90/100 vs Next.js ~75/100). However: (1) the React component ecosystem is massive and unavailable in Svelte, (2) SaaS boilerplate availability is limited, (3) hiring Svelte developers is harder, (4) you would need a separate solution for the component library (no shadcn/ui equivalent with the same maturity).

**Vite + React SPA:** Simplest approach for a dashboard. However: (1) no SSR means the marketing/pricing pages need a separate site or framework, (2) no server actions means you need a separate API layer, (3) you lose the benefits of RSC for data-heavy dashboard pages.

### Sources
- [NxCode Framework Comparison 2026](https://www.nxcode.io/resources/news/nextjs-vs-remix-vs-sveltekit-2025-comparison)
- [Pagepro: Should You Use Next.js in 2026?](https://pagepro.co/blog/pros-and-cons-of-nextjs/)
- [Next.js Performance Discussion #67048](https://github.com/vercel/next.js/discussions/67048)
- [Nucamp: Top 10 Full Stack Frameworks 2026](https://www.nucamp.co/blog/top-10-full-stack-frameworks-in-2026-next.js-remix-nuxt-sveltekit-and-more)

---

## 2. Backend / BaaS

**Recommendation: Supabase as the primary backend, with an escape hatch plan**
**Confidence: MEDIUM-HIGH**

### The Decision: Supabase vs Custom API

| Aspect | Supabase | Custom (Fastify + Prisma/Drizzle) |
|--------|----------|-----------------------------------|
| Time to MVP | Weeks | Months |
| Auth | Built-in, 50K MAU free | Must build or integrate |
| Realtime | Built-in subscriptions | Must build (Socket.io/SSE) |
| Storage | Built-in (S3-compatible) | Must configure (S3/R2) |
| RLS | PostgreSQL-native | Application-level middleware |
| Edge Functions | Deno-based, 200-400ms cold start | Full control (Node.js) |
| Vendor lock-in | Moderate (Postgres is portable) | None |
| Complex business logic | Edge Functions (limited) | Full flexibility |
| Cost at scale | Predictable tiers | Variable (infra dependent) |

### Why Supabase is Right for VroomX

**1. You already know it.** The existing Horizon Star TMS runs on Supabase. Your team's mental model, database schema patterns, and operational knowledge transfer directly to VroomX. This is not a trivial advantage -- it represents months of accumulated understanding.

**2. RLS-based multi-tenancy is the right pattern for your use case.** (See Section 3 for detailed analysis.) Supabase's first-class RLS support, combined with JWT claims carrying `tenant_id`, means every query is automatically scoped. You do not need to remember to add `WHERE tenant_id = ?` in application code -- the database enforces it.

**3. Auth + RLS integration is seamless.** Supabase Auth populates JWT claims that RLS policies read. A custom backend would require you to build this integration yourself (set `app.current_setting` on every connection, manage JWT claims, handle token refresh). With Supabase, it is handled.

**4. Realtime subscriptions are critical for a TMS.** Dispatch boards need live updates when orders are assigned, drivers update status, or trips change. Supabase Realtime (with RLS-aware filtering) gives you this without building WebSocket infrastructure.

**5. The TMS domain does not require exotic backend logic.** Vehicle transport is CRUD-heavy: create orders, assign to trips, track status, generate invoices, manage drivers. This maps perfectly to Supabase's PostgREST auto-generated API. The handful of complex operations (invoice calculation, payroll logic, report generation) can be handled by Edge Functions or Next.js API routes.

### Edge Function Limitations (Be Aware)

- **Cold starts:** 200-400ms median on first request in an hourly window, 125ms hot. Supabase recently shipped persistent storage with up to 97% faster cold starts, but design for this.
- **Runtime:** Deno, not Node.js. Most npm packages work, but some native modules do not.
- **Timeout:** Default execution limits mean heavy computation (large report generation, bulk PDF creation) should be offloaded to Next.js API routes or a background job system.
- **Best practice:** Combine multiple related actions into a single Edge Function with routing to minimize cold start instances.

### The Escape Hatch

Supabase's PostgreSQL database is standard Postgres. If you outgrow Supabase's managed services, the migration path is:

1. Export the database to any managed Postgres (RDS, Cloud SQL, Neon)
2. Replace Supabase client calls with Drizzle/Prisma direct queries
3. Replace Edge Functions with Fastify/Hono API routes
4. Replace Supabase Auth with Better Auth or Clerk
5. Replace Supabase Storage with S3/R2

This is a gradual migration, not a rewrite. Each component can be swapped independently.

### When to Build Custom API Instead

If any of these are true, reconsider Supabase:
- You need complex multi-step transactions with saga patterns
- You need background job queues with retries (cron is available, but not a full job system)
- You need custom middleware on every request (rate limiting per tenant, request transformation)
- You need to run Node.js-specific packages in backend functions

For VroomX at launch, none of these are likely blockers. Revisit at scale.

### Sources
- [Supabase Edge Functions Architecture](https://supabase.com/docs/guides/functions/architecture)
- [Supabase Persistent Storage + Faster Cold Starts](https://supabase.com/blog/persistent-storage-for-faster-edge-functions)
- [Leanware: Supabase Best Practices](https://www.leanware.co/insights/supabase-best-practices)
- [iTitans: Backend Choices](https://ititans.com/blog/backend-choices-baas-vs-supabase-vs-nestjs/)

---

## 3. Multi-Tenancy Strategy

**Recommendation: PostgreSQL RLS with `tenant_id` on every table (shared schema)**
**Confidence: HIGH**

### The Three Approaches

| Approach | Data Isolation | Complexity | Scalability | Cost |
|----------|---------------|------------|-------------|------|
| **RLS + tenant_id** (shared schema) | Row-level | Low | Excellent | Lowest |
| **Schema-per-tenant** | Schema-level | Medium | Good to 1000s | Medium |
| **Database-per-tenant** | Database-level | High | Limited | Highest |

### Why RLS + Shared Schema

**1. It is the consensus for SaaS in 2025/2026.** AWS, Crunchy Data, Nile, and Supabase all recommend RLS-based shared schema as the default for multi-tenant SaaS. Schema-per-tenant is recommended only when regulatory compliance requires stronger isolation (healthcare, finance with per-client audit requirements).

**2. VroomX tenants are small-to-medium carriers.** A carrier with 5-50 trucks generates thousands of rows per year, not millions. At 500 tenants with 50 trucks each, you are looking at maybe 10M rows in the orders table over several years. A single Postgres instance handles this trivially with proper indexing.

**3. Migrations are simple.** With shared schema, you run one migration and it applies to all tenants. With schema-per-tenant, you run N migrations (one per schema). At 500 tenants, deployment becomes a multi-minute operation with retry logic.

**4. Connection pooling is straightforward.** Shared schema uses a single connection pool. Schema-per-tenant requires either `SET search_path` per request (error-prone) or separate pools per schema (resource-intensive).

### Critical Implementation Details

These are the patterns that make or break RLS performance:

**1. Always index `tenant_id`:**
```sql
CREATE INDEX idx_orders_tenant_id ON orders USING btree (tenant_id);
-- For common queries, use composite indexes:
CREATE INDEX idx_orders_tenant_status ON orders (tenant_id, status);
```

**2. Use `(SELECT auth.uid())` not `auth.uid()` in policies:**
```sql
-- SLOW: auth.uid() called per row
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = auth.uid());

-- FAST: auth.uid() called once via initPlan
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = (SELECT auth.uid()));
```
This single change can turn 3-minute queries into 2ms queries on large tables.

**3. Add explicit filters in application code too:**
```typescript
// Even though RLS filters, add .eq() for query planner optimization
const { data } = await supabase
  .from('orders')
  .select('*')
  .eq('tenant_id', tenantId)  // Helps Postgres use the index
  .eq('status', 'active');
```

**4. Use `TO authenticated` in policy definitions:**
```sql
CREATE POLICY tenant_isolation ON orders
  TO authenticated  -- Skip policy evaluation for anon role entirely
  USING (tenant_id = (SELECT auth.uid()));
```

**5. Use security definer functions for join-based policies:**
```sql
CREATE FUNCTION user_tenant_id() RETURNS uuid AS $$
  SELECT tenant_id FROM tenant_members
  WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### The `tenant_id` Source

Store `tenant_id` in Supabase Auth's `app_metadata` on the JWT. This is set at signup/invite and available in every RLS policy via `auth.jwt() -> 'app_metadata' ->> 'tenant_id'`. For users belonging to multiple tenants (rare in carrier TMS, but possible for admin/support), use a session-level setting or a tenant-switch mechanism that re-issues the JWT.

### When to Consider Schema-per-Tenant

- If a large enterprise carrier demands contractual data isolation guarantees
- If you need per-tenant backup/restore capability
- If regulatory requirements mandate it (unlikely for vehicle transport)

For VroomX, none of these apply at launch. Start with shared schema + RLS. If an enterprise tier needs stronger isolation later, implement schema-per-tenant as a premium feature for that tier only.

### Sources
- [Supabase: RLS Performance Best Practices (Official Docs)](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Nile: Shipping Multi-Tenant SaaS with RLS](https://www.thenile.dev/blog/multi-tenant-rls)
- [AWS: Multi-Tenant Data Isolation with PostgreSQL RLS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [Crunchy Data: RLS for Tenants](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres)
- [MakerKit: Supabase RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)

---

## 4. Authentication

**Recommendation: Supabase Auth (stay integrated)**
**Confidence: HIGH**

### Options Evaluated

| Provider | Cost | Multi-Tenant | RLS Integration | Complexity |
|----------|------|-------------|-----------------|------------|
| **Supabase Auth** | 50K MAU free, then usage | Via app_metadata | Native | Lowest |
| Better Auth | Free (self-hosted) | Plugin-based | Custom integration | Medium |
| Clerk | Free to 10K MAU, then $$$$ | Built-in organizations | Custom integration | Low |
| NextAuth / Auth.js | Free | Manual | Custom integration | Medium-High |

### Why Supabase Auth

**1. Native RLS integration is the killer feature.** Supabase Auth populates JWT claims that RLS policies read directly. `auth.uid()`, `auth.jwt()`, and `auth.role()` are available in every policy without custom plumbing. Switching to Better Auth or Clerk means building a bridge layer that sets PostgreSQL session variables on every request.

**2. 50K MAU free tier is generous for SaaS launch.** 500 carriers with 20 users each = 10,000 MAU. You are well within the free tier during the critical growth period.

**3. Social login, magic links, email/password are built in.** Carriers typically use email/password, but having social login available for the self-service signup flow is valuable.

**4. Multi-tenant user management via app_metadata.** Set `tenant_id` and `role` in `app_metadata` at invite/signup. This flows through to every RLS policy automatically.

### What Supabase Auth Lacks

- **Organizations/Teams UI:** No built-in team management UI. You build the invite flow, role management, and team switching yourself. Better Auth and Clerk have this built in.
- **Advanced MFA:** TOTP is supported. WebAuthn/passkeys are supported. But the admin UI for managing MFA policies per-tenant is manual.
- **Concurrent multi-tenant login:** A user cannot be logged into two different tenants simultaneously. This is a Supabase Auth limitation. For VroomX (one carrier per user), this is not an issue.

### Note on Better Auth

Better Auth is the official successor to Auth.js/NextAuth and has strong momentum in 2025-2026. If you were building without Supabase, Better Auth would be the recommendation. But since you are using Supabase for database + storage + realtime, the auth integration is too valuable to give up.

### Sources
- [Medium: Clerk vs Supabase Auth vs NextAuth](https://medium.com/better-dev-nextjs-react/clerk-vs-supabase-auth-vs-nextauth-js-the-production-reality-nobody-tells-you-a4b8f0993e1b)
- [Premier Octet: Better Auth - Future of Auth.js](https://www.premieroctet.com/blog/en/better-auth-future-of-authjs)
- [DevTools Academy: BetterAuth vs NextAuth](https://www.devtoolsacademy.com/blog/betterauth-vs-nextauth/)

---

## 5. Payments & Billing

**Recommendation: Stripe Checkout + Billing Portal + Webhooks**
**Confidence: HIGH**

### Architecture

```
User clicks "Subscribe" on pricing page
  --> Stripe Checkout (hosted by Stripe)
    --> Stripe creates subscription
      --> Webhook hits /api/webhooks/stripe
        --> Update tenant.plan, tenant.stripe_customer_id in DB
          --> RLS policies can now check plan features

User clicks "Manage Billing"
  --> Stripe Billing Portal (hosted by Stripe)
    --> User upgrades/downgrades/cancels
      --> Webhook fires
        --> DB updated
```

### Why Stripe Checkout (Not Embedded Pricing Page)

**Use Stripe Checkout (redirect) because:**
- PCI compliance is handled entirely by Stripe (zero liability on your end)
- Checkout handles 3D Secure, Apple Pay, Google Pay, card retries automatically
- The UI is polished and trusted -- carriers see the Stripe brand
- Implementation is trivial: create a Checkout Session, redirect to the URL

**Do NOT build a custom pricing/payment page** unless you have a specific UX reason. The compliance burden, edge cases (failed 3DS, expired cards, bank declines), and maintenance cost are not worth it for a B2B SaaS.

### Stripe Integration Patterns for SaaS

**1. Products and Prices:**
```
Product: "VroomX Starter"     Price: $99/mo
Product: "VroomX Professional" Price: $249/mo
Product: "VroomX Enterprise"   Price: $599/mo
```
Define these in the Stripe Dashboard. Reference Price IDs in code. Do NOT hardcode amounts.

**2. Critical Webhook Events to Handle:**
```typescript
// Must handle:
'checkout.session.completed'     // New subscription created
'customer.subscription.updated'  // Plan change (upgrade/downgrade)
'customer.subscription.deleted'  // Cancellation
'invoice.payment_succeeded'      // Renewal succeeded
'invoice.payment_failed'         // Payment failed (dunning)

// Should handle:
'customer.subscription.trial_will_end'  // Trial ending reminder
'invoice.upcoming'               // Upcoming charge notification
```

**3. Failed Payment Handling (Dunning):**
Stripe Smart Retries automatically retry failed payments with machine learning. Configure:
- 3 retry attempts over 2 weeks
- Send email reminders at each retry
- Downgrade to free/limited plan after final failure
- Do NOT delete data -- just restrict access

**4. Idempotency:** Always use idempotency keys for Stripe API calls. Webhooks can fire multiple times. Use `event.id` to deduplicate processing.

**5. Billing Portal:** Let Stripe handle plan changes, payment method updates, and invoice history. One line of code to generate a portal session URL.

### Pricing Model for VroomX

Recommended: **Tiered flat-rate** (Good-Better-Best)

| Tier | Monthly | Trucks | Users | Features |
|------|---------|--------|-------|----------|
| Starter | $99 | Up to 10 | 3 | Core dispatch, basic reports |
| Professional | $249 | Up to 30 | 10 | + BOL generation, advanced reports, driver app |
| Enterprise | $599 | Unlimited | Unlimited | + API access, custom branding, priority support |

Enforce limits in RLS policies or application middleware. Store `plan` and `max_trucks`, `max_users` on the tenant record.

### Sources
- [Stripe: Integrate a SaaS Business](https://docs.stripe.com/saas)
- [Stripe: Build Subscriptions Integration](https://docs.stripe.com/billing/subscriptions/build-subscriptions)
- [Stripe: SaaS Billing Best Practices](https://stripe.com/resources/more/best-practices-for-saas-billing)
- [AnotherWrapper: Stripe Integration Guide](https://anotherwrapper.com/blog/stripe-integration-guide)

---

## 6. ORM / Query Layer

**Recommendation: Supabase JS Client for CRUD + Drizzle ORM for complex queries and migrations**
**Confidence: MEDIUM-HIGH**

### The Options

| Tool | Approach | RLS Compat | Type Safety | Bundle Size | Migrations |
|------|----------|-----------|-------------|-------------|------------|
| **Supabase JS Client** | Auto-generated REST | Native | Good (generated types) | Tiny | N/A |
| **Drizzle ORM** | SQL-first TypeScript | Direct Postgres | Excellent | Small | Built-in |
| **Prisma** | Schema-first, codegen | Via raw SQL | Excellent | Large | Built-in |

### The Hybrid Approach

**Use Supabase JS Client for:**
- All client-side CRUD operations (leverages RLS automatically)
- Realtime subscriptions
- Storage operations
- Simple queries from Next.js server components

**Use Drizzle ORM for:**
- Complex server-side queries (joins, aggregations, CTEs)
- Report generation
- Migrations and schema management
- Seed scripts
- Any query where the Supabase client's query builder is insufficient

### Why Not Prisma?

Prisma is a fine ORM, but for this specific stack:

- **Bundle size matters for serverless.** Prisma's generated client is significantly larger than Drizzle. On Vercel serverless functions and Supabase Edge Functions, this means longer cold starts.
- **Prisma and RLS do not play well together.** Prisma connects to Postgres directly and does not set the JWT/session variables that RLS policies need. You would need to wrap every Prisma query with `SET` commands or use raw SQL to establish the RLS context. Drizzle has the same limitation, but since you are using it for server-side admin/reporting queries (not tenant-scoped CRUD), this is acceptable.
- **`prisma generate` friction.** Every schema change requires running `prisma generate` before types update. Drizzle's schema-as-TypeScript means types are always in sync.

### Drizzle Setup with Supabase

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './supabase/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!, // Supabase direct connection (not pooled)
  },
});
```

Use Supabase's **Session Mode** connection string for Drizzle (port 5432), not the pooled connection (port 6543), to ensure transaction support.

### Supabase Generated Types

Run `supabase gen types typescript` to generate TypeScript types from your database schema. These types power the Supabase JS client's type inference. Regenerate after every migration.

### Sources
- [MakerKit: Drizzle vs Prisma 2026](https://makerkit.dev/blog/tutorials/drizzle-vs-prisma)
- [DesignRevision: Prisma vs Drizzle for Next.js 2026](https://designrevision.com/blog/prisma-vs-drizzle)
- [Bytebase: Drizzle vs Prisma 2025](https://www.bytebase.com/blog/drizzle-vs-prisma/)
- [Shinagawa Labs: Next.js App Router ORM Comparison](https://shinagawa-web.com/en/blogs/nextjs-app-router-orm-comparison)

---

## 7. State Management

**Recommendation: TanStack Query for server state + Zustand for client state**
**Confidence: HIGH**

### Server State: TanStack Query (React Query)

**Why TanStack Query over SWR or direct Supabase subscriptions:**

- **DevTools:** TanStack Query DevTools are indispensable for debugging cache state in a data-heavy TMS dashboard. SWR does not have official DevTools.
- **Garbage collection:** Automatic cache cleanup after 5 minutes of inactivity. In a TMS where users navigate between orders, trips, drivers, and reports, stale cache management is critical.
- **Optimistic updates:** Built-in patterns for optimistic mutations. When a dispatcher assigns an order to a trip, the UI updates instantly while the mutation fires in the background.
- **Pagination and infinite scroll:** Built-in `useInfiniteQuery` for order lists, trip history, audit logs.
- **Offline support:** Mutation queue persists offline and replays when reconnected. Important for users on flaky connections.

**Integration with Supabase:**
```typescript
// Use TanStack Query to wrap Supabase calls
const { data: orders } = useQuery({
  queryKey: ['orders', { status, page }],
  queryFn: () => supabase
    .from('orders')
    .select('*, broker:brokers(*)')
    .eq('status', status)
    .range(page * 25, (page + 1) * 25 - 1)
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    }),
});
```

**Realtime invalidation:**
```typescript
// Subscribe to Supabase realtime, invalidate TanStack Query cache
useEffect(() => {
  const channel = supabase
    .channel('orders-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },
      () => queryClient.invalidateQueries({ queryKey: ['orders'] })
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, []);
```

### Client State: Zustand

**For non-server state:**
- Current user preferences (sidebar collapsed, active filters, sort order)
- UI state (which modal is open, active tab, form draft)
- Tenant context (current tenant ID, plan, feature flags)

**Why Zustand over Jotai or Redux:**
- **Simplicity:** A Zustand store is 10 lines of code. No providers, no context, no boilerplate.
- **Module-first:** Import the store directly. No React context wrapper needed. Works in server components, API routes, anywhere.
- **Selectors for performance:** Subscribe to specific slices of state to prevent unnecessary re-renders.
- **Tiny:** ~1KB. Combined with TanStack Query (~13KB), the total state management footprint is smaller than Redux Toolkit alone.

**Jotai** is excellent for atomic, granular state (form builders, spreadsheet-like UIs). A TMS dashboard does not have this pattern. Zustand's centralized stores are a better fit for "current user," "UI preferences," and "active filters."

### Sources
- [Refine: React Query vs TanStack Query vs SWR 2025](https://refine.dev/blog/react-query-vs-tanstack-query-vs-swr-2025/)
- [TanStack Query Comparison Table](https://tanstack.com/query/latest/docs/framework/react/comparison)
- [Makers Den: State Management Trends 2025](https://makersden.io/blog/react-state-management-in-2025)
- [Syncfusion: Top 5 React State Management 2026](https://www.syncfusion.com/blogs/post/react-state-management-libraries)

---

## 8. UI Component Library

**Recommendation: shadcn/ui (with Base UI primitives for new projects)**
**Confidence: HIGH**

### Why shadcn/ui

**1. You own the code.** Components are copied into your project, not installed as a dependency. When you need to customize the dispatch board's DataTable or the order detail modal, you edit your own code -- no fighting library abstractions.

**2. Built on Tailwind CSS.** Since VroomX already chose Tailwind, shadcn/ui components use the same design tokens and utility classes. No style conflicts.

**3. Excellent dashboard components.** Data tables (sortable, filterable, paginated), command palette (k-search), sheets (side panels for order details), tabs, cards -- all the primitives a TMS dashboard needs.

**4. Active ecosystem.** shadcn/ui is the most popular React component approach in 2025-2026. Extensions like shadcn-ui/chart (Recharts wrapper), shadcn-ui/sidebar, and community blocks provide TMS-relevant patterns.

### The Radix UI Situation

**Important context:** Radix UI (the accessibility primitive layer under shadcn/ui) has had reduced maintenance since the original team moved to Base UI (MUI). As of February 2026:

- shadcn/ui now supports **both Radix UI and Base UI** as primitive layers
- For new projects, you can choose Base UI (v1.0 stable since December 2025) during `shadcn init`
- The unified `radix-ui` package consolidates the fragmented `@radix-ui/react-*` packages

**Recommendation for VroomX:** Start with the Base UI primitive layer when initializing shadcn/ui. It is actively maintained by the MUI team and reached stable v1.0. If you encounter missing primitives, Radix is still functional and can be mixed in.

### Alternatives Considered

**Mantine:** Stronger out-of-the-box components (especially DataTable -- 20-minute setup vs a day with shadcn/ui). But: (1) you are locked into Mantine's theming system, (2) customization means fighting the library rather than editing your own code, (3) visual design leans "enterprise admin" rather than modern SaaS.

**MUI (Material UI):** Feature-rich but heavy. Material Design aesthetic is recognizable and divisive. Bundle size is significantly larger. Good for enterprise internal tools, not ideal for a consumer-facing SaaS product.

### Sources
- [Makers Den: React UI Libraries 2025](https://makersden.io/blog/react-ui-libs-2025-comparing-shadcn-radix-mantine-mui-chakra)
- [SaaSIndie: Mantine vs shadcn/ui](https://saasindie.com/blog/mantine-vs-shadcn-ui-comparison)
- [shadcn/ui Changelog: Unified Radix UI Package](https://ui.shadcn.com/docs/changelog/2026-02-radix-ui)
- [shadcn/ui Official](https://ui.shadcn.com/)

---

## 9. Mobile (iOS)

**Recommendation: SwiftUI (keep current approach)**
**Confidence: HIGH**

### Why SwiftUI

VroomX already has a SwiftUI driver app for Horizon Star. The pattern is proven:
- **Native performance:** Camera (inspections), GPS (tracking), offline support
- **Supabase Swift SDK:** Direct connection to the same backend
- **No cross-platform compromise:** For a driver app that does inspections (photos, video, signatures), native is the right choice

### Why NOT React Native or Flutter

- **Camera/GPS-heavy workflows:** Vehicle inspection flows require native camera APIs, offline photo queuing, and GPS background tracking. Cross-platform layers add friction.
- **Team expertise:** Your team already ships SwiftUI. There is no Android version planned (or mentioned).
- **App size:** SwiftUI apps are smaller than React Native/Flutter equivalents, which matters for drivers on limited storage.

### If Android Becomes a Requirement

Cross that bridge when you get there. Options at that point:
1. **Kotlin Multiplatform (KMP):** Share business logic, native UI per platform
2. **React Native with Expo:** If the team has React expertise
3. **Separate native Android app:** If driver count justifies it

Do NOT pre-optimize for cross-platform. Build the iOS app well first.

---

## 10. Hosting & Deployment

**Recommendation: Vercel (frontend) + Supabase Cloud (backend)**
**Confidence: MEDIUM-HIGH**

### Vercel for Next.js

| Aspect | Details |
|--------|---------|
| **Why** | Best-in-class Next.js support (they build the framework), preview deployments, edge functions |
| **Plan** | Pro ($20/user/month) -- needed for commercial SaaS |
| **Risk** | Costs can grow to $500-2000+/mo at scale |
| **Mitigation** | Monitor usage; plan migration to self-hosted (Docker) or Cloudflare Pages if costs spike |

### Cost-Conscious Alternative: Coolify or Railway

If Vercel costs become a concern:
- **Railway:** $5/hobby, ~$20/pro. Run Next.js as a Docker container. Lose some Vercel-specific optimizations (ISR, edge middleware, image optimization) but gain cost predictability.
- **Cloudflare Pages:** Aggressive free tier (unlimited bandwidth). Next.js support via `@cloudflare/next-on-pages`. Some App Router features may have compatibility gaps.

### Recommendation

Start on Vercel Pro. It is the fastest path to production with the best DX. Monitor monthly costs. If you exceed $300/month on Vercel, evaluate Railway or self-hosting. The migration from Vercel to a Docker-based deployment is straightforward since Next.js supports `standalone` output mode.

### Supabase Cloud

Stay on Supabase Cloud. The Pro plan ($25/month) includes 8GB database, 250GB bandwidth, 100GB storage, and 500K Edge Function invocations. This is sufficient for hundreds of tenants at launch.

### Sources
- [DanubeData: Vercel Alternatives for Next.js 2025](https://danubedata.ro/blog/best-vercel-alternatives-nextjs-hosting-2025)
- [MakerKit: Best Hosting for Next.js 2026](https://makerkit.dev/blog/tutorials/best-hosting-nextjs)
- [Pagepro: Lower Vercel Hosting Costs](https://pagepro.co/blog/vercel-hosting-costs/)

---

## 11. Monitoring & Analytics

### Error Monitoring

**Recommendation: Sentry**
**Confidence: HIGH**

- First-class Next.js integration (App Router aware, server component support)
- Clean stack traces with source maps
- Performance monitoring (Web Vitals, server-side traces)
- Transparent, predictable pricing with spike protection
- 5K errors/month free tier

Do NOT add Datadog at launch. It is powerful but complex and expensive. Sentry covers error tracking and basic performance monitoring, which is all you need until you have infrastructure complexity (multiple services, custom backends).

### Product Analytics

**Recommendation: PostHog**
**Confidence: MEDIUM-HIGH**

- **Free tier:** 1M events/month -- generous for SaaS launch
- **Feature flags:** Built-in, essential for gradual rollouts and A/B testing tier features
- **Session replay:** Built-in (replaces LogRocket as a separate tool)
- **Self-hostable:** If data residency becomes a concern
- **Funnel analysis:** Track signup-to-paid conversion, feature adoption per tier

**Why not Mixpanel or Amplitude:** Both are excellent but paid-only for meaningful volume. PostHog's free tier and all-in-one approach (analytics + feature flags + session replay) reduce the number of tools to manage.

### Sources
- [Better Stack: Datadog vs Sentry 2026](https://betterstack.com/community/comparisons/datadog-vs-sentry/)
- [Userpilot: PostHog Analytics Deep Dive 2026](https://userpilot.com/blog/posthog-analytics/)

---

## 12. Email

**Recommendation: Resend**
**Confidence: MEDIUM**

### Why Resend

- **Developer experience:** React Email templates (JSX-based email composition). Since VroomX is a React/Next.js project, email templates use the same language and component model.
- **Simple API:** One HTTP call to send. Integrates trivially with Next.js API routes or Supabase Edge Functions.
- **Your team already uses it.** Horizon Star's Edge Function uses Resend. Continuity matters.

### Honest Assessment

Resend is younger than Postmark and SendGrid. If deliverability becomes an issue:

- **Postmark** is the gold standard for transactional email delivery speed (<2 second delivery) and inbox placement. It separates transactional and marketing streams to protect deliverability. Consider switching if email delivery reliability becomes critical (invoice delivery, payment receipts).
- **SendGrid** is enterprise-grade but has more complex pricing and documented deliverability inconsistencies at lower tiers.

For launch, Resend is fine. Monitor delivery rates. Switch to Postmark if deliverability issues arise.

### Sources
- [Pingram: Transactional Email APIs Compared 2025](https://www.pingram.io/blog/transactional-email-apis)
- [EmailToolTester: Best Transactional Email Services 2026](https://www.emailtooltester.com/en/blog/best-transactional-email-service/)

---

## 13. Testing Strategy

**Recommendation: Vitest (unit) + Playwright (E2E) + MSW (API mocking)**
**Confidence: HIGH**

### Testing Pyramid for VroomX

```
        /  E2E (Playwright)  \        10-20 tests
       / Integration (Vitest) \       50-100 tests
      /    Unit (Vitest)        \     200+ tests
```

### Unit Tests: Vitest

- **Why Vitest over Jest:** Native ESM support, faster execution, compatible with Next.js App Router, built-in TypeScript support without configuration.
- **What to test:** Utility functions, business logic (invoice calculation, payroll computation, tier enforcement), data transformations, Zustand stores.
- **Limitation:** Vitest does not yet support async Server Components. Use E2E tests for those.

### E2E Tests: Playwright

- **What to test:** Focus on critical revenue paths:
  1. Signup flow (carrier registration, tenant creation)
  2. Stripe checkout (subscription activation)
  3. Core dispatch workflow (create order, assign to trip, mark delivered)
  4. Driver invite flow
  5. Invoice generation
  6. Plan upgrade/downgrade
- **Supabase auth in Playwright:** Use `storageState` to persist auth sessions across tests.
- **CI consideration:** Run with 1 worker to avoid Supabase connection pool exhaustion.

### API Mocking: MSW (Mock Service Worker)

- Mock Supabase API responses in Vitest integration tests
- Mock Stripe webhook payloads for subscription lifecycle testing
- Allows testing application logic without hitting real services

### What NOT to Test

- Do not test Supabase RLS policies in unit tests. Test them with integration tests against a real (local or staging) database.
- Do not test Stripe webhook handling with mock events only. Use Stripe CLI's `stripe listen --forward-to` for local webhook testing.
- Do not aim for 100% coverage. Aim for 100% coverage of billing logic and tenant isolation.

### Sources
- [Next.js: Testing with Vitest (Official Docs)](https://nextjs.org/docs/app/guides/testing/vitest)
- [Michele Ong: Testing Next.js 15 with Playwright, MSW, and Supabase](https://micheleong.com/blog/testing-with-nextjs-15-and-playwright-msw-and-supabase)
- [Strapi: Unit and E2E Tests with Vitest and Playwright](https://strapi.io/blog/nextjs-testing-guide-unit-and-e2e-tests-with-vitest-and-playwright)
- [MakerKit: E2E Testing SaaS with Playwright](https://makerkit.dev/blog/tutorials/playwright-testing)

---

## 14. Emerging Tools & Patterns (2025/2026)

### Worth Adopting Now

| Tool | What | Why Consider |
|------|------|-------------|
| **Turborepo** | Monorepo build system | If VroomX has shared packages (types, validation) between web and potential future mobile web |
| **Trigger.dev** | Background jobs for Next.js | Handles long-running tasks (report generation, bulk email, PDF creation) that Edge Functions cannot |
| **Inngest** | Event-driven background functions | Alternative to Trigger.dev, good Supabase integration |
| **Upstash** | Serverless Redis | Rate limiting per tenant, caching, real-time features beyond Supabase Realtime |

### Watch But Do Not Adopt Yet

| Tool | What | Why Wait |
|------|------|---------|
| **React 19 Server Functions** | Unified client/server functions | Still stabilizing in Next.js; use Server Actions for now |
| **Nile** | Multi-tenant Postgres-as-a-service | Purpose-built for multi-tenant SaaS. If Supabase RLS becomes painful, Nile is the escape hatch |
| **Base UI** | MUI's headless component library | v1.0 is stable but shadcn/ui integration is new. Monitor for maturity |
| **Bun** | JavaScript runtime | Faster than Node.js but ecosystem compatibility gaps remain |

### Patterns Gaining Traction

- **Local-first architecture:** Tools like PowerSync and ElectricSQL enable offline-first with Postgres sync. Relevant for the driver app (inspections while offline). Worth researching for Phase 2+.
- **AI-assisted dispatch:** LLM-powered load matching and route optimization. VroomX differentiator opportunity. Not core for MVP.

---

## 15. Final Recommended Stack

### Core Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| **Framework** | Next.js (App Router) | 15.x | SSR + SPA, largest ecosystem, SaaS starter availability |
| **Language** | TypeScript | 5.x | Type safety across full stack |
| **Styling** | Tailwind CSS | 4.x | Utility-first, consistent with shadcn/ui |
| **Components** | shadcn/ui (Base UI primitives) | Latest | Own the code, Tailwind-native, accessible |
| **Backend** | Supabase | Latest | Auth + DB + Storage + Realtime + Edge Functions |
| **Database** | PostgreSQL (Supabase) | 15+ | RLS multi-tenancy, mature, portable |
| **Multi-tenancy** | RLS + tenant_id | N/A | Shared schema, DB-enforced isolation |
| **Auth** | Supabase Auth | Latest | Native RLS integration, 50K MAU free |
| **Payments** | Stripe | Latest API | Checkout + Billing Portal + Webhooks |
| **ORM** | Supabase JS Client + Drizzle | Latest | Client CRUD + server-side complex queries |
| **Server State** | TanStack Query | v5 | Cache, optimistic updates, DevTools |
| **Client State** | Zustand | v5 | Lightweight, module-first |
| **Mobile** | SwiftUI | Latest | Native iOS driver app |
| **Hosting** | Vercel + Supabase Cloud | Pro tiers | Best DX, plan cost migration path |
| **Error Monitoring** | Sentry | Latest | Next.js-native, transparent pricing |
| **Analytics** | PostHog | Latest | Free 1M events, feature flags, session replay |
| **Email** | Resend | Latest | React Email templates, team familiarity |
| **Unit Testing** | Vitest | Latest | Fast, ESM-native, TS support |
| **E2E Testing** | Playwright | Latest | Cross-browser, Supabase auth support |
| **API Mocking** | MSW | v2 | Service-level mocking for integration tests |

### Installation

```bash
# Initialize Next.js
npx create-next-app@latest vroomx --typescript --tailwind --app --src-dir

# Core dependencies
npm install @supabase/supabase-js @supabase/ssr @tanstack/react-query zustand stripe @sentry/nextjs posthog-js resend

# ORM (server-side)
npm install drizzle-orm postgres
npm install -D drizzle-kit

# UI
npx shadcn@latest init  # Choose Base UI primitives

# Dev dependencies
npm install -D vitest @vitejs/plugin-react @playwright/test msw @testing-library/react
```

### What This Stack Validates vs Your Initial Decision

| Decision Point | Your Proposal | Research Verdict | Change? |
|----------------|---------------|-----------------|---------|
| Next.js App Router | Yes | Confirmed | No |
| Supabase | Yes | Confirmed with escape hatch plan | No |
| RLS multi-tenancy | Yes | Confirmed with optimization patterns | No |
| Supabase Auth | Yes | Confirmed (native RLS integration is key) | No |
| Stripe | Yes | Confirmed (Checkout, not custom) | No |
| SwiftUI | Yes | Confirmed | No |
| Vercel + Supabase Cloud | Yes | Confirmed with cost monitoring | No |
| Sentry + PostHog | Yes | Confirmed | No |
| Resend | Yes | Confirmed (monitor deliverability) | No |
| State management | Not specified | Added: TanStack Query + Zustand | **Add** |
| ORM | Not specified | Added: Supabase JS + Drizzle hybrid | **Add** |
| UI library | Not specified | Added: shadcn/ui with Base UI | **Add** |
| Testing | Not specified | Added: Vitest + Playwright + MSW | **Add** |

### Summary

Your initial stack decision is well-considered and validated by current ecosystem evidence. The proposed stack is the mainstream, well-supported choice for a multi-tenant SaaS product in 2025/2026. The research adds specificity (which ORM, which state manager, which UI library, which testing tools) and documents the critical implementation patterns (RLS optimization, Stripe webhook handling, auth integration) that will prevent costly mistakes during development.

The biggest risk is not technology choice -- it is execution. This stack has zero exotic components. Every piece is well-documented with production examples. Ship the MVP.
