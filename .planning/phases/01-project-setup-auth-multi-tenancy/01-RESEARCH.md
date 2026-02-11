# Phase 1: Project Setup + Auth + Multi-Tenancy - Research

**Researched:** 2026-02-11
**Domain:** Next.js SaaS foundation, Supabase multi-tenant auth, Stripe billing
**Confidence:** HIGH (most findings verified with official docs)

## Summary

Phase 1 establishes the entire foundation for VroomX SaaS: project scaffolding, authentication, multi-tenant data isolation, Stripe subscription billing, and observability tooling. This research focused on the 12 specific implementation areas outlined in the phase context, with emphasis on current versions and API patterns.

**Critical discovery: Next.js 16 is the current stable version** (released October 2025, latest patch 16.1.6 from February 2026). The existing STACK.md references Next.js 15, but a new project started today should use Next.js 16. Key changes include: `middleware.ts` is renamed to `proxy.ts`, Turbopack is the default bundler, and the React Compiler is stable. The App Router, Server Components, Server Actions, and overall architecture remain the same.

**Second critical discovery: Supabase has renamed API keys.** New projects created after November 2025 use `sb_publishable_...` (replaces `anon`) and `sb_secret_...` (replaces `service_role`). The environment variable is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Legacy keys will be removed late 2026.

**Primary recommendation:** Start with `npx create-next-app@latest` (which now scaffolds Next.js 16 with Turbopack), use `proxy.ts` (not `middleware.ts`) for auth session refresh, and use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the Supabase client key.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.x (App Router) | Full-stack React framework | Current stable, Turbopack default, SSR+SPA |
| TypeScript | 5.x | Type safety | Required by Next.js 16 |
| Tailwind CSS | 4.x | Utility-first CSS | Default in create-next-app, CSS-first config in v4 |
| shadcn/ui | Latest | Component library (owned code) | Tailwind v4 compatible, copies code into project |
| @supabase/supabase-js | Latest | Supabase client | Database + Auth + Storage + Realtime |
| @supabase/ssr | Latest | SSR cookie handling | Required for Next.js server-side auth |
| stripe | Latest | Payment processing | Checkout + Billing Portal + Webhooks |
| @sentry/nextjs | 10.x | Error monitoring | App Router aware, source maps |
| posthog-js | Latest | Product analytics | Feature flags, session replay, free tier |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-orm | Latest | Server-side ORM | Complex queries, migrations, schema definition |
| drizzle-kit | Latest (dev) | Migration tooling | Generate and run DB migrations |
| postgres | Latest | PostgreSQL driver | Connection for Drizzle ORM |
| zod | Latest | Schema validation | Server Action input validation |
| @tanstack/react-query | v5 | Server state management | Data fetching, cache, optimistic updates |
| zustand | v5 | Client state | UI state, tenant context, preferences |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Next.js 16 | Next.js 15 | 15 still works but 16 is current stable; proxy.ts, Turbopack default, Cache Components are 16 features |
| shadcn/ui | Mantine | Mantine has stronger DataTable out-of-box but locks you into its theming system |
| Drizzle ORM | Prisma | Prisma is larger bundle, worse serverless cold starts, codegen friction |
| Tailwind v4 | Tailwind v3 | v4 is CSS-first config (no tailwind.config.js), shadcn/ui supports both |

**Installation:**
```bash
# Initialize Next.js 16 project
npx create-next-app@latest vroomx --yes
# --yes uses defaults: TypeScript, Tailwind CSS, ESLint, App Router, Turbopack

# Core dependencies
npm install @supabase/supabase-js @supabase/ssr stripe @sentry/nextjs posthog-js zod @tanstack/react-query zustand

# ORM (server-side)
npm install drizzle-orm postgres
npm install -D drizzle-kit

# UI
npx shadcn@latest init

# Dev dependencies
npm install -D vitest @playwright/test
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/
    (auth)/              # Auth routes (login, signup, etc.)
      login/page.tsx
      signup/page.tsx
    (dashboard)/         # Protected dashboard routes
      dashboard/
        page.tsx         # Main dashboard
        layout.tsx       # Dashboard layout with sidebar
    api/
      webhooks/
        stripe/route.ts  # Stripe webhook handler
    layout.tsx           # Root layout
    page.tsx             # Landing/marketing page
  components/
    ui/                  # shadcn/ui components (auto-generated)
    layout/              # Sidebar, header, nav components
  lib/
    supabase/
      client.ts          # Browser Supabase client
      server.ts          # Server Supabase client
      proxy.ts           # Session refresh logic for proxy.ts
      service-role.ts    # Service role client (server only)
    stripe/
      config.ts          # Stripe client init, price ID mapping
      webhook-handlers.ts # Event handlers by type
    tier.ts              # Tier limits and feature gating
  db/
    schema.ts            # Drizzle schema definitions
    index.ts             # Drizzle client init
  hooks/                 # Custom React hooks
  stores/                # Zustand stores
  types/                 # Shared TypeScript types
proxy.ts                 # Next.js 16 proxy (replaces middleware.ts)
drizzle.config.ts        # Drizzle Kit config
```

### Pattern 1: Next.js 16 Proxy for Auth Session Refresh

**What:** In Next.js 16, `middleware.ts` is renamed to `proxy.ts`. The exported function is `proxy` (not `middleware`). The proxy runs on Node.js runtime (not Edge).

**When to use:** Every request to protected routes must pass through the proxy to refresh Supabase auth tokens stored in cookies.

**Example:**
```typescript
// proxy.ts (project root)
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

```typescript
// lib/supabase/proxy.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Use getUser(), not getSession()
  // getUser() validates the token server-side, getSession() only reads cookies
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users from protected routes
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated users without tenant go to onboarding
  if (user && !user.app_metadata?.tenant_id && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/onboarding'
    return NextResponse.redirect(url)
  }

  // CRITICAL: Return supabaseResponse, not NextResponse.next()
  // supabaseResponse contains updated auth cookies
  return supabaseResponse
}
```
Source: [Supabase SSR Next.js Guide](https://supabase.com/docs/guides/auth/server-side/nextjs), [Next.js 16 Blog](https://nextjs.org/blog/next-16)

### Pattern 2: Supabase Client Factory (Three Clients)

**What:** Three separate Supabase client factories for browser, server, and service role contexts.

```typescript
// lib/supabase/client.ts (browser)
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

```typescript
// lib/supabase/server.ts (Server Components, Server Actions, Route Handlers)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component where cookies can't be set
            // This is expected -- the proxy handles cookie refresh
          }
        },
      },
    }
  )
}
```

```typescript
// lib/supabase/service-role.ts (server only -- NEVER import in client code)
import { createClient } from '@supabase/supabase-js'

export function createServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!, // No NEXT_PUBLIC_ prefix = server only
    { auth: { persistSession: false } }
  )
}
```
Source: [Supabase SSR Client Creation](https://supabase.com/docs/guides/auth/server-side/creating-a-client)

### Pattern 3: Custom Access Token Hook (tenant_id in JWT)

**What:** A PL/pgSQL function that Supabase Auth calls on every token issuance/refresh. It reads the user's tenant membership and injects `tenant_id` and `role` into the JWT.

**Critical: Do NOT use SECURITY DEFINER.** Official Supabase docs recommend against it for auth hooks. Instead, explicitly GRANT permissions to `supabase_auth_admin`.

```sql
-- Custom Access Token Hook
-- Called by Supabase Auth every time a JWT is issued or refreshed
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  claims jsonb;
  tenant_membership RECORD;
BEGIN
  -- Get the current claims from the event
  claims := event->'claims';

  -- Look up the user's tenant membership
  SELECT tm.tenant_id, tm.role, t.plan, t.subscription_status
  INTO tenant_membership
  FROM public.tenant_memberships tm
  JOIN public.tenants t ON t.id = tm.tenant_id
  WHERE tm.user_id = (event->>'user_id')::uuid
  ORDER BY tm.created_at ASC
  LIMIT 1;

  -- If the user has a tenant membership, inject it into claims
  IF tenant_membership IS NOT NULL THEN
    claims := jsonb_set(
      claims,
      '{app_metadata}',
      COALESCE(claims->'app_metadata', '{}'::jsonb) ||
      jsonb_build_object(
        'tenant_id', tenant_membership.tenant_id,
        'role', tenant_membership.role,
        'plan', tenant_membership.plan,
        'subscription_status', tenant_membership.subscription_status
      )
    );
  END IF;

  -- Return the modified event with updated claims
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- GRANT to supabase_auth_admin (required for Auth hooks)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

-- REVOKE from all other roles to prevent direct calls
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;

-- Grant SELECT on tables the hook queries
GRANT SELECT ON public.tenant_memberships TO supabase_auth_admin;
GRANT SELECT ON public.tenants TO supabase_auth_admin;
```

**Enable in Supabase Dashboard:** Authentication > Hooks > Custom Access Token Hook > Enable > Select `public.custom_access_token_hook`.

Source: [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook), [Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)

### Pattern 4: RLS Policy Template with (SELECT ...) Wrapper

**What:** Every tenant-scoped table uses this exact RLS pattern. The `(SELECT ...)` wrapper is critical for performance -- it causes PostgreSQL to cache the function result (InitPlan) instead of evaluating per-row.

```sql
-- Helper function (evaluated once per query via InitPlan)
CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS UUID AS $$
  SELECT ((auth.jwt()->'app_metadata'->>'tenant_id'))::uuid;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.get_tenant_id() TO authenticated;

-- RLS template for every tenant-scoped table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON orders
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "tenant_isolation_insert" ON orders
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "tenant_isolation_update" ON orders
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "tenant_isolation_delete" ON orders
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));
```

**Without `(SELECT ...)`: 100K rows = 100K function calls = minutes.**
**With `(SELECT ...)`: 100K rows = 1 function call (cached) = milliseconds.**

Source: [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)

### Pattern 5: Stripe Checkout with 14-Day Trial

**What:** Create a Stripe Checkout Session with `subscription_data.trial_period_days` for the free trial.

```typescript
// In a Server Action or API route
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PRICE_MAP: Record<string, string> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID!,
  pro: process.env.STRIPE_PRO_PRICE_ID!,
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
}

export async function createCheckoutSession(tenantId: string, plan: string, customerId: string) {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: PRICE_MAP[plan], quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { tenant_id: tenantId },
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?setup=complete`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    metadata: { tenant_id: tenantId },
  })

  return session.url
}
```

Source: [Stripe: Configure Free Trials](https://docs.stripe.com/payments/checkout/free-trials)

### Anti-Patterns to Avoid

- **Using `middleware.ts` in Next.js 16:** Rename to `proxy.ts` with exported `proxy` function. `middleware.ts` is deprecated.
- **Using `NEXT_PUBLIC_SUPABASE_ANON_KEY`:** New Supabase projects use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The publishable key replaces the anon key.
- **Using `SECURITY DEFINER` on the access token hook:** Official docs recommend against it. Use explicit GRANT to `supabase_auth_admin` instead.
- **Using `getSession()` in the proxy for auth checks:** Use `getUser()` which validates the token server-side. `getSession()` only reads the cookie and can be spoofed.
- **Service role key in client code:** Never prefix with `NEXT_PUBLIC_`. Use `SUPABASE_SECRET_KEY` (no prefix = server-only).
- **RLS policies without `(SELECT ...)` wrapper:** Per-row function evaluation kills performance at scale.
- **Direct Supabase writes from client components:** Use Server Actions for all mutations. Client components call the action.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment collection UI | Custom credit card form | Stripe Checkout (hosted) | PCI compliance, 3DS, Apple Pay, card retries |
| Billing management UI | Custom plan change page | Stripe Billing Portal | Handles upgrade/downgrade/cancel/invoice history |
| Auth session management | Custom JWT/cookie logic | @supabase/ssr | Handles token refresh, cookie sync across server/browser |
| Component primitives | Custom accessible components | shadcn/ui (Radix/Base UI) | Accessibility, keyboard nav, screen readers |
| Tenant isolation | Application-level WHERE clauses | PostgreSQL RLS | One missed WHERE = data leak. RLS is database-enforced |
| Webhook signature verification | Custom HMAC verification | `stripe.webhooks.constructEvent()` | Handles all edge cases, timing attacks |
| Source map upload | Custom build plugin | @sentry/nextjs `withSentryConfig` | Handles Turbopack, tree-shaking, tunnel config |

**Key insight:** Phase 1 is almost entirely integration work -- connecting proven services (Supabase, Stripe, Sentry, PostHog) with proper configuration. The value is in correct wiring, not custom logic.

## Common Pitfalls

### Pitfall 1: Next.js 15 vs 16 Confusion
**What goes wrong:** Using Next.js 15 patterns (middleware.ts, sync cookies/headers) in a Next.js 16 project.
**Why it happens:** Most tutorials and the existing STACK.md reference Next.js 15. But create-next-app now installs 16.
**How to avoid:** Use `proxy.ts` (not middleware.ts). Always `await cookies()`, `await headers()`, `await params`. These are async in Next.js 16.
**Warning signs:** Deprecation warnings about middleware.ts in dev console.

### Pitfall 2: Supabase API Key Naming (publishable vs anon)
**What goes wrong:** Using `NEXT_PUBLIC_SUPABASE_ANON_KEY` with a new Supabase project that only has publishable keys.
**Why it happens:** Most existing tutorials and docs still reference the anon key. New projects (created after Nov 2025) only issue `sb_publishable_...` keys.
**How to avoid:** Use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for new projects. The key value works the same way (same permissions as anon), just different naming.
**Warning signs:** "Invalid API key" errors when using old env var names.

### Pitfall 3: RLS Policy Performance (Critical)
**What goes wrong:** RLS policies without `(SELECT ...)` wrapper evaluate auth functions per-row, turning 2ms queries into 3-minute queries.
**Why it happens:** `USING (tenant_id = get_tenant_id())` looks correct and works functionally. The performance issue only appears with data volume.
**How to avoid:** ALWAYS use `(SELECT public.get_tenant_id())` with the SELECT wrapper. Establish this in the very first migration.
**Warning signs:** EXPLAIN ANALYZE shows "Filter" without "InitPlan" for auth function calls.

### Pitfall 4: Stripe Webhook Idempotency
**What goes wrong:** Webhook handler processes the same event multiple times, causing duplicate subscription activations or inconsistent plan state.
**Why it happens:** Stripe retries webhooks that don't receive a 200 response within 20 seconds. Serverless cold starts can cause timeouts.
**How to avoid:** Create a `stripe_events` table. Check `event.id` before processing. Mark as processed after success.
**Warning signs:** Duplicate entries in the tenants table, plan state mismatches.

### Pitfall 5: JWT Stale Claims After Plan Change
**What goes wrong:** User upgrades plan via Stripe, but JWT still contains old plan for up to 1 hour.
**Why it happens:** JWTs are stateless snapshots. The custom access token hook only runs on token refresh.
**How to avoid:** Force `supabase.auth.refreshSession()` after plan change webhook. For critical feature gating, check the database directly in Server Actions, not just JWT claims.
**Warning signs:** User complains features didn't unlock after upgrading.

### Pitfall 6: Service Role Key in Client Bundle
**What goes wrong:** Service role key leaks to browser, bypassing all RLS.
**Why it happens:** Next.js App Router blurs server/client boundary. A Server Component refactored to Client Component drags along server imports.
**How to avoid:** Service role key env var has NO `NEXT_PUBLIC_` prefix (`SUPABASE_SECRET_KEY`). Create separate client factories. Add ESLint rule to flag service_role imports in client code.
**Warning signs:** Network tab shows service role key in Authorization header.

### Pitfall 7: Drizzle with Supabase Connection Pooling
**What goes wrong:** Prepared statements fail with "prepared statement already exists" errors.
**Why it happens:** Supabase's PgBouncer transaction mode doesn't support prepared statements. Drizzle uses them by default.
**How to avoid:** Pass `{ prepare: false }` to the postgres client when using the pooled connection (port 6543).
**Warning signs:** Intermittent query failures in production, working fine locally.

## Code Examples

### Signup Flow: Register + Create Tenant + Stripe Checkout

```typescript
// app/actions/auth.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import Stripe from 'stripe'
import { redirect } from 'next/navigation'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function signUpCarrier(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const companyName = formData.get('company_name') as string
  const plan = formData.get('plan') as string

  // 1. Create Supabase Auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: formData.get('full_name') }
    }
  })
  if (authError) return { error: authError.message }

  // 2. Create Stripe customer
  const customer = await stripe.customers.create({
    email,
    name: companyName,
    metadata: { supabase_user_id: authData.user!.id }
  })

  // 3. Create tenant + membership (via service role for initial setup)
  const admin = createServiceRoleClient()

  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .insert({
      name: companyName,
      slug: companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      plan: 'trial',
      stripe_customer_id: customer.id,
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      subscription_status: 'trialing',
    })
    .select()
    .single()
  if (tenantError) return { error: tenantError.message }

  // 4. Create tenant membership
  await admin.from('tenant_memberships').insert({
    tenant_id: tenant.id,
    user_id: authData.user!.id,
    role: 'owner',
  })

  // 5. Set app_metadata on user (triggers JWT update via custom hook)
  await admin.auth.admin.updateUserById(authData.user!.id, {
    app_metadata: {
      tenant_id: tenant.id,
      role: 'owner',
      plan: 'trial',
    }
  })

  // 6. Create Stripe Checkout Session with 14-day trial
  const PRICE_MAP: Record<string, string> = {
    starter: process.env.STRIPE_STARTER_PRICE_ID!,
    pro: process.env.STRIPE_PRO_PRICE_ID!,
    enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
  }

  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    mode: 'subscription',
    line_items: [{ price: PRICE_MAP[plan], quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { tenant_id: tenant.id },
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?setup=complete`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    metadata: { tenant_id: tenant.id },
  })

  redirect(session.url!)
}
```

### Stripe Webhook Handler with Idempotency

```typescript
// app/api/webhooks/stripe/route.ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const sig = headersList.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // Idempotency check
  const { data: existing } = await supabase
    .from('stripe_events')
    .select('id')
    .eq('event_id', event.id)
    .single()

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  // Process based on event type
  switch (event.type) {
    case 'checkout.session.completed':
      // Link subscription to tenant
      break
    case 'customer.subscription.updated':
      // Update plan, limits, status
      break
    case 'customer.subscription.deleted':
      // Mark as canceled (don't delete data)
      break
    case 'invoice.payment_failed':
      // Mark as past_due
      break
    case 'invoice.payment_succeeded':
      // Mark as active
      break
  }

  // Mark event as processed
  await supabase.from('stripe_events').insert({
    event_id: event.id,
    event_type: event.type,
    processed_at: new Date().toISOString(),
  })

  return NextResponse.json({ received: true })
}
```

### Sentry Setup (Next.js 16)

```bash
# Run the Sentry wizard -- creates all config files automatically
npx @sentry/wizard@latest -i nextjs
```

This creates:
- `instrumentation-client.ts` (browser-side Sentry init)
- `sentry.server.config.ts` (server-side Sentry init)
- `sentry.edge.config.ts` (edge runtime Sentry init)
- `instrumentation.ts` (registers server/edge configs)
- `app/global-error.tsx` (React error boundary for App Router)
- Wraps `next.config.ts` with `withSentryConfig`

Source: [Sentry Next.js Setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/)

### PostHog Setup (Next.js 16 App Router)

```typescript
// app/providers.tsx
'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: '/ingest', // Use reverse proxy to avoid ad blockers
      person_profiles: 'identified_only',
    })
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
```

```typescript
// next.config.ts -- add PostHog reverse proxy
const nextConfig = {
  async rewrites() {
    return [
      { source: '/ingest/:path*', destination: 'https://us.i.posthog.com/:path*' },
    ]
  },
}
```

Source: [PostHog Next.js App Router Guide](https://reetesh.in/blog/posthog-integration-in-next.js-app-router)

### Drizzle ORM Configuration

```typescript
// drizzle.config.ts
import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './supabase/migrations',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_DIRECT!, // Direct connection (port 5432) for migrations
  },
})
```

```typescript
// src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL! // Pooler (port 6543) for runtime

const client = postgres(connectionString, {
  prepare: false, // REQUIRED for Supabase PgBouncer transaction mode
  max: 1,         // Serverless: 1 connection per function instance
  idle_timeout: 20,
})

export const db = drizzle(client)
```

Source: [Drizzle with Supabase](https://orm.drizzle.team/docs/get-started/supabase-new)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next.js 15 + middleware.ts | Next.js 16 + proxy.ts | Oct 2025 | Rename middleware.ts to proxy.ts, export `proxy` function |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Nov 2025 | New Supabase projects use publishable key format |
| `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SECRET_KEY` | Nov 2025 | New key format `sb_secret_...` replaces service_role |
| Tailwind v3 (tailwind.config.js) | Tailwind v4 (CSS-first config) | Jan 2025 | No config file; use `@theme` directive in CSS |
| shadcn/ui + Radix only | shadcn/ui + Radix or Base UI | Late 2025 | Can choose Base UI primitives during `shadcn init` |
| Turbopack opt-in | Turbopack default | Oct 2025 (Next.js 16) | Default bundler; use `--webpack` to opt out |
| Sync `cookies()`/`headers()` | Async `await cookies()`/`await headers()` | Next.js 16 | Must await dynamic API calls |
| `SECURITY DEFINER` on auth hooks | Explicit GRANT to supabase_auth_admin | 2025 | Official docs now recommend against SECURITY DEFINER for hooks |
| `tailwindcss-animate` | `tw-animate-css` | 2025 (Tailwind v4) | Animation utility package renamed for v4 compatibility |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Replaced by `@supabase/ssr`. Do not use.
- `middleware.ts` filename: Deprecated in Next.js 16, use `proxy.ts`.
- `next lint` command: Removed in Next.js 16. Use ESLint or Biome directly.
- `experimental.ppr`: Removed in Next.js 16. Replaced by `cacheComponents`.

## Environment Variables Reference

### Public (included in client bundle)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

### Secret (server only -- NO `NEXT_PUBLIC_` prefix)
```bash
SUPABASE_SECRET_KEY=sb_secret_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...
SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=sntrys_...
RESEND_API_KEY=re_...
```

### Database (server only)
```bash
DATABASE_URL=postgresql://postgres.ref:password@aws-0-region.pooler.supabase.com:6543/postgres
DATABASE_URL_DIRECT=postgresql://postgres.ref:password@aws-0-region.supabase.com:5432/postgres
```

## Open Questions

1. **Next.js 16 vs 15 decision:**
   - What we know: Next.js 16 is current stable (16.1.6). The ROADMAP and STACK.md reference Next.js 15.
   - What's unclear: Whether the user specifically wants Next.js 15 or is fine with 16.
   - Recommendation: Use Next.js 16. It is the current stable, create-next-app installs it by default, and the breaking changes are manageable (proxy.ts rename, async dynamic APIs). The core architecture (App Router, Server Components, Server Actions) is identical.

2. **Supabase publishable key timeline:**
   - What we know: New projects since Nov 2025 use publishable/secret keys. Legacy keys removed late 2026.
   - What's unclear: Exact date of legacy key removal.
   - Recommendation: Use new key format (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) from the start. No reason to use deprecated naming.

3. **shadcn/ui Base UI vs Radix primitives:**
   - What we know: shadcn/ui supports both. Base UI reached v1.0 stable Dec 2025.
   - What's unclear: Whether all shadcn/ui components work equally well with Base UI vs Radix.
   - Recommendation: Use Radix for now (default, battle-tested). Switch to Base UI if Radix maintenance becomes a problem.

4. **Tailwind v4 vs v3:**
   - What we know: create-next-app defaults to Tailwind v4. shadcn/ui supports both.
   - What's unclear: Whether all shadcn/ui components are fully tested with Tailwind v4.
   - Recommendation: Use Tailwind v4 (default). The CSS-first config is simpler and shadcn/ui CLI handles the migration.

## Sources

### Primary (HIGH confidence)
- [Next.js 16 Blog Post](https://nextjs.org/blog/next-16) -- Breaking changes, proxy.ts, new features
- [Next.js Installation Guide](https://nextjs.org/docs/app/getting-started/installation) -- create-next-app defaults (v16.1.6)
- [Supabase SSR Next.js Guide](https://supabase.com/docs/guides/auth/server-side/nextjs) -- Client setup, proxy pattern
- [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) -- Hook implementation
- [Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks) -- GRANT/REVOKE patterns, SECURITY DEFINER warning
- [Supabase RLS Performance](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) -- (SELECT ...) wrapper
- [Stripe Free Trials](https://docs.stripe.com/payments/checkout/free-trials) -- trial_period_days, trial_settings
- [Drizzle ORM Supabase Setup](https://orm.drizzle.team/docs/get-started/supabase-new) -- Connection config, prepare: false
- [Sentry Next.js Guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/) -- Wizard setup, App Router support

### Secondary (MEDIUM confidence)
- [Supabase API Key Changes Discussion](https://github.com/orgs/supabase/discussions/29260) -- publishable/secret key timeline
- [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4) -- Tailwind v4 component updates
- [MakerKit: Next.js 16 Guide](https://makerkit.dev/blog/tutorials/nextjs-16) -- Breaking changes summary
- [Vercel Academy: PostHog Setup](https://vercel.com/kb/guide/posthog-nextjs-vercel-feature-flags-analytics) -- PostHog + Vercel integration

### Tertiary (LOW confidence)
- shadcn/ui Base UI primitive layer maturity -- limited real-world reports
- Exact Supabase legacy key removal date -- "late 2026 TBC"

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries verified with official docs, versions confirmed
- Architecture: HIGH -- Patterns from official Supabase, Next.js, Stripe docs
- Pitfalls: HIGH -- Documented in official docs and confirmed by PITFALLS.md prior research
- Next.js 16 specifics: HIGH -- Verified via nextjs.org blog and installation docs
- Supabase key naming: MEDIUM -- Verified via GitHub discussion, some ambiguity on exact timeline

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (30 days -- stable libraries, but check for Next.js 16.2 and Supabase key deadline updates)
