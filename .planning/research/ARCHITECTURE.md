# Architecture Patterns: VroomX SaaS TMS

**Domain:** Multi-tenant SaaS TMS
**Researched:** 2026-02-11

---

## Table of Contents

1. [Multi-Tenancy Architecture](#1-multi-tenancy-architecture)
2. [Auth Architecture](#2-auth-architecture)
3. [API Design](#3-api-design)
4. [Subscription & Billing Architecture](#4-subscription--billing-architecture)
5. [Data Model](#5-data-model)
6. [Financial Calculations](#6-financial-calculations)
7. [File Storage Architecture](#7-file-storage-architecture)
8. [Realtime Architecture](#8-realtime-architecture)
9. [Anti-Patterns to Avoid](#9-anti-patterns-to-avoid)
10. [Performance Playbook](#10-performance-playbook)

---

## Recommended Architecture

```
                          +------------------+
                          |   Vercel Edge    |
                          |   (Middleware)   |
                          |  Auth + Tenant   |
                          +--------+---------+
                                   |
                    +--------------+--------------+
                    |                              |
          +---------v---------+         +---------v---------+
          |   Next.js App     |         |   Next.js API     |
          |   (App Router)    |         |   Routes          |
          |                   |         |                   |
          | - Server Comps    |         | - Stripe Webhooks |
          | - Client Comps    |         | - Complex Logic   |
          | - Server Actions  |         | - Cron Jobs       |
          +---------+---------+         +---------+---------+
                    |                              |
                    +--------------+---------------+
                                   |
                    +--------------v--------------+
                    |        Supabase             |
                    |                             |
                    | +----------+ +----------+   |
                    | |PostgreSQL| | Realtime  |   |
                    | |  + RLS   | | (WebSocket|   |
                    | +----------+ +----------+   |
                    | +----------+ +----------+   |
                    | |   Auth   | | Storage   |   |
                    | |(JWT+RLS) | | (S3)      |   |
                    | +----------+ +----------+   |
                    | +----------+                |
                    | |  Edge    |                |
                    | |Functions |                |
                    | +----------+                |
                    +-----------------------------+
                                   |
                    +--------------v--------------+
                    |         Stripe              |
                    | Checkout + Billing Portal   |
                    | Webhooks --> /api/webhooks   |
                    +-----------------------------+

          +------------------+
          |  iOS Driver App  |
          |    (SwiftUI)     |
          |                  |
          | Supabase Swift   |
          | SDK (Auth+DB+    |
          | Storage+Realtime)|
          +------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Next.js App (Server Components)** | Render data-heavy pages (order lists, reports, dashboards) | Supabase (via server-side client) |
| **Next.js App (Client Components)** | Interactive UI (dispatch board, forms, real-time updates) | Supabase (via browser client), TanStack Query cache |
| **Next.js Server Actions** | Mutations (create order, assign trip, update status) | Supabase (via server-side client) |
| **Next.js API Routes** | Webhook handlers, complex business logic, PDF generation | Supabase (via service role client), Stripe, Resend |
| **Vercel Middleware** | Auth verification, tenant context, redirects | Supabase Auth (JWT validation) |
| **Supabase PostgreSQL** | Data storage, RLS enforcement, triggers | Internal (Edge Functions, Auth) |
| **Supabase Auth** | User authentication, JWT issuance, tenant claims | PostgreSQL (user metadata), Next.js (session) |
| **Supabase Realtime** | Live data subscriptions (order status, dispatch updates) | PostgreSQL (change detection), Client Components |
| **Supabase Storage** | File storage (BOL, inspections, documents) | PostgreSQL (references), iOS App, Web App |
| **Supabase Edge Functions** | Lightweight server tasks (email triggers, notifications) | PostgreSQL, Resend, external APIs |
| **Stripe** | Payment processing, subscription management | Next.js API Routes (webhooks), PostgreSQL (plan data) |
| **iOS Driver App** | Driver-facing workflows (inspections, trips, earnings) | Supabase (Auth, DB, Storage, Realtime) |

### Data Flow

**Order Lifecycle:**
```
1. Dispatcher creates order (Client Component -> Server Action -> Supabase INSERT)
2. RLS validates tenant_id matches JWT claim
3. Supabase Realtime broadcasts change to subscribed clients
4. TanStack Query cache invalidated, dispatch board re-renders
5. Dispatcher assigns order to trip (Server Action -> Supabase UPDATE)
6. Driver app receives realtime notification
7. Driver updates status (iOS App -> Supabase UPDATE)
8. Status change triggers Edge Function (send notification email via Resend)
9. Order completed -> Invoice generated (Server Action -> Supabase INSERT into invoices)
```

**Auth + Tenant Resolution:**
```
1. User logs in (Supabase Auth -> JWT issued with app_metadata.tenant_id)
2. Next.js Middleware reads JWT, validates session
3. Every Supabase query carries JWT automatically
4. RLS policies check (SELECT auth.jwt()->'app_metadata'->>'tenant_id') = tenant_id
5. User only sees their tenant's data. Period.
```

---

## 1. Multi-Tenancy Architecture

### Strategy: Shared Schema + RLS

Every tenant's data lives in the same PostgreSQL schema, same tables. Row-Level Security policies enforce that a query from Tenant A never returns rows belonging to Tenant B. This is enforced at the database level, not the application level.

### Core Tables

```sql
-- The tenant (carrier organization)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'trial',        -- 'trial', 'starter', 'pro', 'enterprise'
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  max_trucks INTEGER NOT NULL DEFAULT 5,
  max_users INTEGER NOT NULL DEFAULT 3,
  trial_ends_at TIMESTAMPTZ,
  subscription_status TEXT DEFAULT 'trialing', -- 'trialing', 'active', 'past_due', 'canceled'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Maps users to tenants with roles
CREATE TABLE tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'dispatcher',    -- 'owner', 'admin', 'dispatcher', 'viewer'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);
```

### The `get_tenant_id()` Helper Function

This is the single most important function in the system. Every RLS policy references it.

```sql
-- Returns the current user's tenant_id from JWT claims
-- SECURITY DEFINER: runs with the function owner's privileges
-- STABLE: result does not change within a single statement
CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS UUID AS $$
  SELECT (auth.jwt()->'app_metadata'->>'tenant_id')::uuid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_tenant_id() TO authenticated;
```

### RLS Policy Template

Every tenant-scoped table uses this exact pattern:

```sql
-- Enable RLS on the table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- SELECT: users can only read rows from their tenant
CREATE POLICY "tenant_isolation_select" ON orders
  FOR SELECT
  TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- INSERT: users can only insert rows into their tenant
CREATE POLICY "tenant_isolation_insert" ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

-- UPDATE: users can only update rows in their tenant
CREATE POLICY "tenant_isolation_update" ON orders
  FOR UPDATE
  TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

-- DELETE: users can only delete rows in their tenant
CREATE POLICY "tenant_isolation_delete" ON orders
  FOR DELETE
  TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));
```

**Critical: The `(SELECT ...)` wrapper.** Without it, `get_tenant_id()` is evaluated per-row. With it, PostgreSQL evaluates it once as an InitPlan and caches the result. This is the difference between a 2ms query and a 3-minute query on large tables.

### Auto-Set `tenant_id` Trigger

Defense in depth: even if application code does not supply `tenant_id`, the trigger sets it from the JWT.

```sql
CREATE OR REPLACE FUNCTION public.set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tenant_id := (SELECT public.get_tenant_id());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to every tenant-scoped table
CREATE TRIGGER set_tenant_id_on_insert
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_id();

CREATE TRIGGER set_tenant_id_on_insert
  BEFORE INSERT ON trips
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_id();

-- Repeat for: drivers, trucks, brokers, expenses, inspections,
-- invoices, fuel_transactions, maintenance_records, claims,
-- tickets, violations, company_files, tasks
```

### Custom Access Token Hook

Supabase Auth fires this hook on every token refresh. It reads the user's tenant membership and injects `tenant_id` and `role` into the JWT's `app_metadata`.

```sql
-- Custom Access Token Hook
-- This function is called by Supabase Auth every time a JWT is issued or refreshed
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
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
  ORDER BY tm.created_at ASC  -- First membership (primary tenant)
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant to supabase_auth_admin (required for Auth hooks)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

-- Grant read on the tables the hook queries
GRANT SELECT ON public.tenant_memberships TO supabase_auth_admin;
GRANT SELECT ON public.tenants TO supabase_auth_admin;

-- Revoke from public to prevent direct calls
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM public;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated;
```

**Enable in Supabase Dashboard:** Authentication > Hooks > Custom Access Token Hook > Enable > Select `public.custom_access_token_hook`.

### Role-Based Access Within a Tenant

Extend the base RLS policies with role checks for write operations:

```sql
-- Example: Only owners and admins can delete orders
CREATE POLICY "admin_delete_orders" ON orders
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_tenant_id())
    AND (SELECT (auth.jwt()->'app_metadata'->>'role')) IN ('owner', 'admin')
  );

-- Example: Viewers cannot insert or update
CREATE POLICY "non_viewer_insert_orders" ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.get_tenant_id())
    AND (SELECT (auth.jwt()->'app_metadata'->>'role')) != 'viewer'
  );
```

---

## 2. Auth Architecture

### Signup Flow (New Carrier Registration)

```typescript
// app/actions/auth.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function signUpCarrier(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const companyName = formData.get('company_name') as string
  const plan = formData.get('plan') as string  // 'starter' | 'pro' | 'enterprise'

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

  // 3. Create tenant record (via service role for initial setup)
  const supabaseAdmin = createServiceRoleClient()

  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .insert({
      name: companyName,
      slug: slugify(companyName),
      plan: 'trial',
      stripe_customer_id: customer.id,
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
      subscription_status: 'trialing',
    })
    .select()
    .single()

  if (tenantError) return { error: tenantError.message }

  // 4. Create tenant membership (user -> tenant, role: owner)
  await supabaseAdmin
    .from('tenant_memberships')
    .insert({
      tenant_id: tenant.id,
      user_id: authData.user!.id,
      role: 'owner',
    })

  // 5. Set tenant_id in user's app_metadata (triggers JWT update)
  await supabaseAdmin.auth.admin.updateUserById(authData.user!.id, {
    app_metadata: {
      tenant_id: tenant.id,
      role: 'owner',
      plan: 'trial',
    }
  })

  // 6. Create Stripe Checkout session for plan selection
  const priceId = getPriceId(plan) // Maps 'starter' -> env STRIPE_STARTER_PRICE_ID
  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    mode: 'subscription',
    subscription_data: {
      trial_period_days: 14,
      metadata: { tenant_id: tenant.id }
    },
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?setup=complete`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    metadata: { tenant_id: tenant.id }
  })

  return { checkoutUrl: session.url }
}
```

### Team Invite Flow

```sql
-- Invitations table
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'dispatcher',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, email)
);

-- RLS: only members of the tenant can view/create invitations
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON invitations
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "admin_insert_invitations" ON invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.get_tenant_id())
    AND (SELECT (auth.jwt()->'app_metadata'->>'role')) IN ('owner', 'admin')
  );
```

```typescript
// app/actions/team.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function inviteTeamMember(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const role = formData.get('role') as string

  // Get current user's tenant
  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = user?.app_metadata?.tenant_id
  if (!tenantId) return { error: 'No tenant context' }

  // Check tier limits
  const { count } = await supabase
    .from('tenant_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  const { data: tenant } = await supabase
    .from('tenants')
    .select('max_users')
    .eq('id', tenantId)
    .single()

  if (count !== null && tenant && count >= tenant.max_users) {
    return { error: `Your plan allows ${tenant.max_users} users. Please upgrade.` }
  }

  // Create invitation
  const { data: invite, error } = await supabase
    .from('invitations')
    .insert({
      tenant_id: tenantId,
      email,
      role,
      invited_by: user!.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Send invite email
  await resend.emails.send({
    from: 'VroomX <team@vroomx.com>',
    to: email,
    subject: `You've been invited to join ${user?.user_metadata?.full_name}'s team on VroomX`,
    html: `
      <p>You've been invited to join a team on VroomX TMS.</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/invite/accept?token=${invite.token}">
        Accept Invitation
      </a>
      <p>This invitation expires in 7 days.</p>
    `
  })

  return { success: true }
}

export async function acceptInvite(token: string) {
  const supabaseAdmin = createServiceRoleClient()

  // Look up invitation
  const { data: invite, error } = await supabaseAdmin
    .from('invitations')
    .select('*, tenant:tenants(name)')
    .eq('token', token)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error || !invite) return { error: 'Invalid or expired invitation' }

  // Get or create user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // User needs to sign up or log in first
    return { redirect: `/signup?invite=${token}` }
  }

  // Create membership
  await supabaseAdmin
    .from('tenant_memberships')
    .insert({
      tenant_id: invite.tenant_id,
      user_id: user.id,
      role: invite.role,
    })

  // Update user's app_metadata
  await supabaseAdmin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      tenant_id: invite.tenant_id,
      role: invite.role,
    }
  })

  // Mark invitation as accepted
  await supabaseAdmin
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  // Force token refresh so new tenant_id takes effect
  await supabase.auth.refreshSession()

  return { success: true, tenantName: invite.tenant.name }
}
```

### Driver Auth (iOS App)

Drivers authenticate via Supabase Auth with the same tenant context:

```typescript
// Supabase Edge Function: provision-driver-auth
// Called when a dispatcher adds a driver with an email address

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const { driver_id, email, tenant_id, temp_password } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Create auth user for the driver
  const { data: authUser, error } = await supabase.auth.admin.createUser({
    email,
    password: temp_password,
    email_confirm: true,
    app_metadata: {
      tenant_id,
      role: 'driver',
      driver_id,
    }
  })

  if (error) return new Response(JSON.stringify({ error }), { status: 400 })

  // Link driver record to auth user
  await supabase
    .from('drivers')
    .update({ auth_user_id: authUser.user.id })
    .eq('id', driver_id)

  // Create tenant membership
  await supabase
    .from('tenant_memberships')
    .insert({
      tenant_id,
      user_id: authUser.user.id,
      role: 'driver',
    })

  return new Response(JSON.stringify({ success: true }), { status: 200 })
})
```

### Middleware (Tenant Context for Every Request)

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protected routes require auth
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Authenticated users without a tenant go to onboarding
  if (user) {
    const tenantId = user.app_metadata?.tenant_id
    if (!tenantId && request.nextUrl.pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }

    // Check subscription status for dashboard access
    const subStatus = user.app_metadata?.subscription_status
    if (subStatus === 'canceled' && request.nextUrl.pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/reactivate', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*', '/api/protected/:path*'],
}
```

---

## 3. API Design

### When to Use Each Pattern

| Pattern | Use For | Example |
|---------|---------|---------|
| **Server Actions** | All user-initiated mutations | Create order, assign trip, update status, invite member |
| **Server Components** | Data-heavy read pages | Order list, trip detail, driver profile, reports |
| **Client Components + TanStack Query** | Interactive, real-time UI | Dispatch board, live status updates, filter/sort |
| **API Routes** | Webhooks, external integrations, PDF generation | Stripe webhooks, BOL PDF, cron jobs |
| **Supabase Edge Functions** | Lightweight event-driven tasks | Send email on status change, push notifications |
| **Direct client Supabase calls** | Real-time subscriptions, simple reads | Realtime channel subscriptions, presence |

### Server Action Pattern (Mutations)

```typescript
// app/actions/orders.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createOrderSchema = z.object({
  vehicle_year: z.number().min(1900).max(new Date().getFullYear() + 2),
  vehicle_make: z.string().min(1).max(100),
  vehicle_model: z.string().min(1).max(100),
  vehicle_vin: z.string().optional(),
  vehicle_color: z.string().optional(),
  broker_id: z.string().uuid().optional(),
  revenue: z.number().min(0),
  carrier_pay: z.number().min(0),
  payment_type: z.enum(['COD', 'COP', 'CHECK', 'BILL', 'SPLIT']),
  pickup_location: z.string().min(1),
  delivery_location: z.string().min(1),
  pickup_date: z.string().optional(),
  dropoff_date: z.string().optional(),
})

export async function createOrder(formData: FormData) {
  const supabase = await createClient()

  // Validate input
  const parsed = createOrderSchema.safeParse({
    vehicle_year: parseInt(formData.get('vehicle_year') as string),
    vehicle_make: formData.get('vehicle_make'),
    vehicle_model: formData.get('vehicle_model'),
    vehicle_vin: formData.get('vehicle_vin') || undefined,
    vehicle_color: formData.get('vehicle_color') || undefined,
    broker_id: formData.get('broker_id') || undefined,
    revenue: parseFloat(formData.get('revenue') as string),
    carrier_pay: parseFloat(formData.get('carrier_pay') as string),
    payment_type: formData.get('payment_type'),
    pickup_location: formData.get('pickup_location'),
    delivery_location: formData.get('delivery_location'),
    pickup_date: formData.get('pickup_date') || undefined,
    dropoff_date: formData.get('dropoff_date') || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // Insert - tenant_id is set by trigger from JWT
  const { data, error } = await supabase
    .from('orders')
    .insert({
      ...parsed.data,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/dashboard/orders')
  return { data }
}
```

### TanStack Query + Supabase Realtime Hybrid (Client Reads)

```typescript
// hooks/useOrders.ts
'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createBrowserClient } from '@/lib/supabase/client'
import { useEffect } from 'react'

interface OrderFilters {
  status?: string
  broker_id?: string
  page?: number
  pageSize?: number
}

export function useOrders(filters: OrderFilters = {}) {
  const supabase = createBrowserClient()
  const queryClient = useQueryClient()
  const { status, broker_id, page = 0, pageSize = 50 } = filters

  // Fetch with TanStack Query (caching, stale-while-revalidate)
  const query = useQuery({
    queryKey: ['orders', filters],
    queryFn: async () => {
      let q = supabase
        .from('orders')
        .select('*, broker:brokers(name, email), trip:trips(id, status)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (status) q = q.eq('status', status)
      if (broker_id) q = q.eq('broker_id', broker_id)

      const { data, error, count } = await q
      if (error) throw error
      return { orders: data, total: count }
    },
    staleTime: 30_000, // 30s before considered stale
  })

  // Realtime invalidation (when any user changes orders)
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}
```

### API Route Pattern (Webhooks)

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

  // Process event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session, supabase)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription, supabase)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionCanceled(event.data.object as Stripe.Subscription, supabase)
        break
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice, supabase)
        break
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice, supabase)
        break
    }

    // Mark event as processed (idempotency)
    await supabase.from('stripe_events').insert({
      event_id: event.id,
      event_type: event.type,
      processed_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Webhook processing error:', err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
```

---

## 4. Subscription & Billing Architecture

### Stripe Integration Model

```
Tenant signup
  --> Stripe Customer created (linked via stripe_customer_id)
  --> Stripe Checkout Session (14-day trial)
  --> User redirected to Stripe-hosted checkout
  --> On completion: webhook fires checkout.session.completed
  --> DB updated: tenant.subscription_status = 'trialing'

Trial expires (14 days)
  --> Stripe charges the card
  --> invoice.payment_succeeded webhook
  --> DB updated: tenant.subscription_status = 'active'

Payment fails
  --> invoice.payment_failed webhook
  --> DB updated: tenant.subscription_status = 'past_due'
  --> Grace period (7 days), email notifications
  --> After final retry failure: subscription_status = 'canceled'
  --> Dashboard shows "reactivate" prompt, data preserved

Plan change (upgrade/downgrade)
  --> Stripe Billing Portal (hosted by Stripe)
  --> customer.subscription.updated webhook
  --> DB updated: tenant.plan, max_trucks, max_users
  --> Force JWT refresh to propagate new plan claims
```

### Webhook Handlers

```typescript
// lib/stripe/webhook-handlers.ts

import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

const PLAN_CONFIG: Record<string, { plan: string; max_trucks: number; max_users: number }> = {
  [process.env.STRIPE_STARTER_PRICE_ID!]: { plan: 'starter', max_trucks: 5, max_users: 3 },
  [process.env.STRIPE_PRO_PRICE_ID!]:     { plan: 'pro', max_trucks: 20, max_users: 10 },
  [process.env.STRIPE_ENTERPRISE_PRICE_ID!]: { plan: 'enterprise', max_trucks: 999, max_users: 999 },
}

export async function handleCheckoutComplete(
  session: Stripe.Checkout.Session,
  supabase: SupabaseClient
) {
  const tenantId = session.metadata?.tenant_id
  if (!tenantId) throw new Error('Missing tenant_id in session metadata')

  const subscriptionId = session.subscription as string

  await supabase
    .from('tenants')
    .update({
      stripe_subscription_id: subscriptionId,
      subscription_status: 'trialing',
    })
    .eq('id', tenantId)
}

export async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription,
  supabase: SupabaseClient
) {
  // Find tenant by stripe_customer_id
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('stripe_customer_id', subscription.customer as string)
    .single()

  if (!tenant) throw new Error('Tenant not found for Stripe customer')

  // Determine plan from price ID
  const priceId = subscription.items.data[0]?.price.id
  const config = PLAN_CONFIG[priceId] || { plan: 'starter', max_trucks: 5, max_users: 3 }

  await supabase
    .from('tenants')
    .update({
      plan: config.plan,
      max_trucks: config.max_trucks,
      max_users: config.max_users,
      subscription_status: subscription.status, // 'active', 'past_due', 'trialing'
      stripe_subscription_id: subscription.id,
    })
    .eq('id', tenant.id)
}

export async function handleSubscriptionCanceled(
  subscription: Stripe.Subscription,
  supabase: SupabaseClient
) {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('stripe_customer_id', subscription.customer as string)
    .single()

  if (!tenant) return

  // Do NOT delete data. Restrict access.
  await supabase
    .from('tenants')
    .update({
      subscription_status: 'canceled',
      // Keep plan and limits for potential reactivation
    })
    .eq('id', tenant.id)
}

export async function handlePaymentFailed(
  invoice: Stripe.Invoice,
  supabase: SupabaseClient
) {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('stripe_customer_id', invoice.customer as string)
    .single()

  if (!tenant) return

  await supabase
    .from('tenants')
    .update({ subscription_status: 'past_due' })
    .eq('id', tenant.id)

  // TODO: Send dunning email via Resend
}

export async function handlePaymentSucceeded(
  invoice: Stripe.Invoice,
  supabase: SupabaseClient
) {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('stripe_customer_id', invoice.customer as string)
    .single()

  if (!tenant) return

  await supabase
    .from('tenants')
    .update({ subscription_status: 'active' })
    .eq('id', tenant.id)
}
```

### Feature Gating (Tier Enforcement)

```typescript
// lib/tier.ts

interface TierLimits {
  maxTrucks: number
  maxUsers: number
  features: {
    bolGeneration: boolean
    advancedReports: boolean
    driverApp: boolean
    apiAccess: boolean
    customBranding: boolean
  }
}

const TIER_LIMITS: Record<string, TierLimits> = {
  trial:      { maxTrucks: 999, maxUsers: 999, features: { bolGeneration: true, advancedReports: true, driverApp: true, apiAccess: false, customBranding: false } },
  starter:    { maxTrucks: 5,   maxUsers: 3,   features: { bolGeneration: false, advancedReports: false, driverApp: false, apiAccess: false, customBranding: false } },
  pro:        { maxTrucks: 20,  maxUsers: 10,  features: { bolGeneration: true, advancedReports: true, driverApp: true, apiAccess: false, customBranding: false } },
  enterprise: { maxTrucks: 999, maxUsers: 999, features: { bolGeneration: true, advancedReports: true, driverApp: true, apiAccess: true, customBranding: true } },
}

export function getTierLimits(plan: string): TierLimits {
  return TIER_LIMITS[plan] || TIER_LIMITS.starter
}

export function canAddTruck(plan: string, currentCount: number): boolean {
  return currentCount < getTierLimits(plan).maxTrucks
}

export function canAddUser(plan: string, currentCount: number): boolean {
  return currentCount < getTierLimits(plan).maxUsers
}

export function hasFeature(plan: string, feature: keyof TierLimits['features']): boolean {
  return getTierLimits(plan).features[feature]
}
```

### Stripe Events Table (Idempotency)

```sql
CREATE TABLE stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No RLS needed: only service role accesses this table
-- But enable RLS and deny all to be safe
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
-- No policies = no access except service role
```

---

## 5. Data Model

### Entity Relationship Diagram

```
tenants (1) ---- (*) tenant_memberships (*) ---- (1) auth.users
   |
   |---- (*) orders
   |         |---- (1) brokers
   |         |---- (1) trips (nullable - unassigned orders have no trip)
   |
   |---- (*) trips
   |         |---- (1) drivers
   |         |---- (1) trucks
   |         |---- (*) orders
   |         |---- (*) expenses
   |
   |---- (*) drivers
   |         |---- (0..1) auth.users (drivers with app access)
   |
   |---- (*) trucks
   |
   |---- (*) brokers
   |
   |---- (*) expenses
   |         |---- (0..1) trips
   |
   |---- (*) inspections
   |         |---- (1) orders
   |         |---- (1) drivers
   |
   |---- (*) invoices
   |         |---- (1) orders
   |         |---- (1) brokers
   |
   |---- (*) invitations
   |
   |---- (*) company_files
   |
   |---- (*) tasks
```

### Full Schema

```sql
-- ============================================================
-- TENANT TABLES
-- ============================================================

-- tenants: defined in Section 1 above

-- tenant_memberships: defined in Section 1 above

-- invitations: defined in Section 2 above

-- ============================================================
-- CORE ENTITY TABLES (all have tenant_id + RLS)
-- ============================================================

CREATE TABLE brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  mc_number TEXT,
  payment_terms TEXT DEFAULT 'NET30',     -- NET15, NET30, NET45, NET60
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  auth_user_id UUID REFERENCES auth.users(id),  -- nullable: not all drivers have app access
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  driver_type TEXT NOT NULL DEFAULT 'company',   -- 'company' | 'owner_operator'
  status TEXT NOT NULL DEFAULT 'active',          -- 'active' | 'inactive'
  -- Financial config
  driver_cut_percent NUMERIC(5,2),               -- Company drivers: % of carrier_pay
  dispatch_fee_percent NUMERIC(5,2),             -- Owner-operators: % of revenue
  -- Documents
  cdl_number TEXT,
  cdl_expiration DATE,
  medical_card_expiration DATE,
  -- Metadata
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE trucks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  unit_number TEXT NOT NULL,
  truck_type TEXT NOT NULL DEFAULT '7_car',       -- '7_car', '8_car', '9_car', 'flatbed', 'enclosed'
  year INTEGER,
  make TEXT,
  model TEXT,
  vin TEXT,
  license_plate TEXT,
  ownership TEXT DEFAULT 'company',               -- 'company' | 'owner_operator'
  status TEXT NOT NULL DEFAULT 'active',           -- 'active' | 'inactive' | 'maintenance'
  trailer_id UUID,                                 -- self-reference for truck-trailer pairing
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id),
  truck_id UUID REFERENCES trucks(id),
  status TEXT NOT NULL DEFAULT 'planned',          -- 'planned', 'in_progress', 'at_terminal', 'completed'
  start_date DATE,
  end_date DATE,
  -- Denormalized financial summary (computed on write)
  total_revenue NUMERIC(12,2) DEFAULT 0,
  total_carrier_pay NUMERIC(12,2) DEFAULT 0,
  total_broker_fees NUMERIC(12,2) DEFAULT 0,
  total_local_fees NUMERIC(12,2) DEFAULT 0,
  clean_gross NUMERIC(12,2) DEFAULT 0,
  driver_pay NUMERIC(12,2) DEFAULT 0,
  dispatch_fee NUMERIC(12,2) DEFAULT 0,
  total_expenses NUMERIC(12,2) DEFAULT 0,
  net_profit NUMERIC(12,2) DEFAULT 0,
  order_count INTEGER DEFAULT 0,
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id),               -- nullable: unassigned orders
  broker_id UUID REFERENCES brokers(id),
  -- Vehicle info
  vehicle_year INTEGER,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_vin TEXT,
  vehicle_color TEXT,
  vehicle_type TEXT,                                -- 'sedan', 'suv', 'truck', 'van', etc.
  -- Status
  status TEXT NOT NULL DEFAULT 'pending',           -- 'pending', 'assigned', 'picked_up', 'in_transit', 'delivered'
  -- Locations
  pickup_location TEXT,
  pickup_city TEXT,
  pickup_state TEXT,
  pickup_zip TEXT,
  pickup_contact_name TEXT,
  pickup_contact_phone TEXT,
  delivery_location TEXT,
  delivery_city TEXT,
  delivery_state TEXT,
  delivery_zip TEXT,
  delivery_contact_name TEXT,
  delivery_contact_phone TEXT,
  -- Dates
  pickup_date DATE,
  dropoff_date DATE,
  actual_pickup_date TIMESTAMPTZ,
  actual_delivery_date TIMESTAMPTZ,
  -- Financial
  revenue NUMERIC(12,2) DEFAULT 0,
  carrier_pay NUMERIC(12,2) DEFAULT 0,
  broker_fee NUMERIC(12,2) DEFAULT 0,
  local_fee NUMERIC(12,2) DEFAULT 0,
  payment_type TEXT DEFAULT 'COP',                 -- 'COD', 'COP', 'CHECK', 'BILL', 'SPLIT'
  cod_amount NUMERIC(12,2) DEFAULT 0,
  -- Billing
  payment_status TEXT DEFAULT 'unpaid',            -- 'unpaid', 'invoiced', 'paid'
  invoice_date DATE,
  payment_date DATE,
  payment_amount NUMERIC(12,2),
  -- Metadata
  notes TEXT,
  order_number TEXT,                                -- Human-readable order number
  external_order_id TEXT,                           -- External system reference
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id),
  driver_id UUID REFERENCES drivers(id),
  category TEXT NOT NULL,                           -- 'fuel', 'tolls', 'repairs', 'meals', 'lodging', 'other'
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  receipt_url TEXT,
  expense_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id),
  driver_id UUID NOT NULL REFERENCES drivers(id),
  inspection_type TEXT NOT NULL,                    -- 'pickup' | 'delivery'
  status TEXT DEFAULT 'in_progress',                -- 'in_progress', 'completed'
  -- Condition data (JSON for flexibility)
  exterior_condition JSONB DEFAULT '{}',
  interior_condition JSONB DEFAULT '{}',
  damage_markers JSONB DEFAULT '[]',
  -- Photos stored in Supabase Storage, paths referenced here
  photo_paths JSONB DEFAULT '[]',
  video_path TEXT,
  -- Signatures
  driver_signature_path TEXT,
  customer_signature_path TEXT,
  -- Notes
  driver_notes TEXT,
  customer_notes TEXT,
  -- Metadata
  completed_at TIMESTAMPTZ,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id),
  broker_id UUID REFERENCES brokers(id),
  invoice_number TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'draft',                      -- 'draft', 'sent', 'paid', 'overdue', 'void'
  issued_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  paid_date DATE,
  paid_amount NUMERIC(12,2),
  pdf_path TEXT,                                    -- Path in Supabase Storage
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE company_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,                          -- Path in Supabase Storage
  file_type TEXT,                                   -- MIME type
  file_size INTEGER,
  category TEXT,                                    -- 'insurance', 'registration', 'license', 'other'
  entity_type TEXT,                                 -- 'driver', 'truck', 'order', 'company'
  entity_id UUID,                                   -- References the specific entity
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',                    -- 'pending', 'in_progress', 'completed'
  priority TEXT DEFAULT 'medium',                   -- 'low', 'medium', 'high', 'urgent'
  assigned_to UUID REFERENCES auth.users(id),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RLS POLICIES (applied to ALL tables above)
-- ============================================================
-- Use the template from Section 1 for each table.
-- Every table listed above gets:
--   ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY tenant_isolation_select ...
--   CREATE POLICY tenant_isolation_insert ...
--   CREATE POLICY tenant_isolation_update ...
--   CREATE POLICY tenant_isolation_delete ...
--   CREATE TRIGGER set_tenant_id_on_insert ...

-- ============================================================
-- SYSTEM TABLES (no tenant_id, no RLS or deny-all RLS)
-- ============================================================
-- stripe_events (webhook idempotency, service role only)
-- tenants (RLS via get_tenant_id match)
-- tenant_memberships (RLS via user_id = auth.uid() OR tenant_id match)
```

---

## 6. Financial Calculations

### Design Principle: Application-Level Compute with Denormalized Summaries

Financial calculations are performed in TypeScript Server Actions, NOT in PostgreSQL views or functions. Results are denormalized onto the `trips` table for fast reads. This matches the pattern proven in the Horizon Star TMS.

**Why application-level:**
- Business logic is testable with unit tests (Vitest)
- Calculation logic is readable in TypeScript, not embedded in SQL
- Changes to financial formulas do not require database migrations
- Denormalized summaries on trips make dashboard queries fast (no JOINs/aggregations at read time)

### Trip Financial Calculation (TypeScript)

```typescript
// lib/financial/trip-calculations.ts

interface OrderFinancials {
  revenue: number
  carrier_pay: number
  broker_fee: number
  local_fee: number
}

interface DriverConfig {
  driver_type: 'company' | 'owner_operator'
  driver_cut_percent: number | null     // Company drivers: % of carrier_pay
  dispatch_fee_percent: number | null   // Owner-operators: % of revenue (company keeps this)
}

interface TripExpense {
  amount: number
  category: string
}

interface TripFinancials {
  totalRevenue: number
  totalCarrierPay: number
  totalBrokerFees: number
  totalLocalFees: number
  cleanGross: number
  driverPay: number
  dispatchFee: number
  totalExpenses: number
  netProfit: number
  orderCount: number
}

export function calculateTripFinancials(
  orders: OrderFinancials[],
  driver: DriverConfig,
  expenses: TripExpense[]
): TripFinancials {
  // Sum order-level financials
  const totalRevenue = orders.reduce((sum, o) => sum + (o.revenue || 0), 0)
  const totalCarrierPay = orders.reduce((sum, o) => sum + (o.carrier_pay || 0), 0)
  const totalBrokerFees = orders.reduce((sum, o) => sum + (o.broker_fee || 0), 0)
  const totalLocalFees = orders.reduce((sum, o) => sum + (o.local_fee || 0), 0)

  // Clean gross = carrier_pay - broker_fees - local_fees
  // If carrier_pay is not set, use revenue
  const effectiveCarrierPay = totalCarrierPay > 0 ? totalCarrierPay : totalRevenue
  const cleanGross = effectiveCarrierPay - totalBrokerFees - totalLocalFees

  // Driver pay depends on driver type
  let driverPay: number
  let dispatchFee: number

  if (driver.driver_type === 'owner_operator') {
    // Owner-operator: company takes dispatch_fee_percent of clean gross
    // Driver keeps the rest
    const feePercent = driver.dispatch_fee_percent || 5
    dispatchFee = cleanGross * (feePercent / 100)
    driverPay = cleanGross - dispatchFee
  } else {
    // Company driver: driver gets driver_cut_percent of carrier pay
    const cutPercent = driver.driver_cut_percent || 25
    driverPay = cleanGross * (cutPercent / 100)
    dispatchFee = 0
  }

  // Expenses
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)

  // Net profit
  // Owner-operator: dispatch fee - expenses (company's profit)
  // Company driver: clean gross - driver pay - expenses
  let netProfit: number
  if (driver.driver_type === 'owner_operator') {
    netProfit = dispatchFee - totalExpenses
  } else {
    netProfit = cleanGross - driverPay - totalExpenses
  }

  return {
    totalRevenue,
    totalCarrierPay: effectiveCarrierPay,
    totalBrokerFees,
    totalLocalFees,
    cleanGross,
    driverPay,
    dispatchFee,
    totalExpenses,
    netProfit,
    orderCount: orders.length,
  }
}
```

### Server Action: Recalculate Trip on Order Change

```typescript
// app/actions/trips.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { calculateTripFinancials } from '@/lib/financial/trip-calculations'
import { revalidatePath } from 'next/cache'

export async function recalculateTripFinancials(tripId: string) {
  const supabase = await createClient()

  // Fetch trip with driver
  const { data: trip } = await supabase
    .from('trips')
    .select('*, driver:drivers(*)')
    .eq('id', tripId)
    .single()

  if (!trip || !trip.driver) return { error: 'Trip or driver not found' }

  // Fetch orders on this trip
  const { data: orders } = await supabase
    .from('orders')
    .select('revenue, carrier_pay, broker_fee, local_fee')
    .eq('trip_id', tripId)

  // Fetch expenses for this trip
  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount, category')
    .eq('trip_id', tripId)

  // Calculate
  const financials = calculateTripFinancials(
    orders || [],
    {
      driver_type: trip.driver.driver_type,
      driver_cut_percent: trip.driver.driver_cut_percent,
      dispatch_fee_percent: trip.driver.dispatch_fee_percent,
    },
    expenses || []
  )

  // Denormalize onto trip record
  const { error } = await supabase
    .from('trips')
    .update({
      total_revenue: financials.totalRevenue,
      total_carrier_pay: financials.totalCarrierPay,
      total_broker_fees: financials.totalBrokerFees,
      total_local_fees: financials.totalLocalFees,
      clean_gross: financials.cleanGross,
      driver_pay: financials.driverPay,
      dispatch_fee: financials.dispatchFee,
      total_expenses: financials.totalExpenses,
      net_profit: financials.netProfit,
      order_count: financials.orderCount,
    })
    .eq('id', tripId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/trips')
  return { data: financials }
}
```

### Aging Analysis (SQL View with security_invoker)

```sql
-- Aging analysis view for broker receivables
-- Uses security_invoker = true so RLS is applied to the calling user's context
CREATE OR REPLACE VIEW broker_aging AS
  SELECT
    o.tenant_id,
    b.id AS broker_id,
    b.name AS broker_name,
    COUNT(*) FILTER (
      WHERE o.payment_status = 'invoiced'
      AND o.invoice_date >= CURRENT_DATE - INTERVAL '30 days'
    ) AS current_count,
    COALESCE(SUM(o.revenue) FILTER (
      WHERE o.payment_status = 'invoiced'
      AND o.invoice_date >= CURRENT_DATE - INTERVAL '30 days'
    ), 0) AS current_amount,
    COUNT(*) FILTER (
      WHERE o.payment_status = 'invoiced'
      AND o.invoice_date < CURRENT_DATE - INTERVAL '30 days'
      AND o.invoice_date >= CURRENT_DATE - INTERVAL '60 days'
    ) AS days_31_60_count,
    COALESCE(SUM(o.revenue) FILTER (
      WHERE o.payment_status = 'invoiced'
      AND o.invoice_date < CURRENT_DATE - INTERVAL '30 days'
      AND o.invoice_date >= CURRENT_DATE - INTERVAL '60 days'
    ), 0) AS days_31_60_amount,
    COUNT(*) FILTER (
      WHERE o.payment_status = 'invoiced'
      AND o.invoice_date < CURRENT_DATE - INTERVAL '60 days'
      AND o.invoice_date >= CURRENT_DATE - INTERVAL '90 days'
    ) AS days_61_90_count,
    COALESCE(SUM(o.revenue) FILTER (
      WHERE o.payment_status = 'invoiced'
      AND o.invoice_date < CURRENT_DATE - INTERVAL '60 days'
      AND o.invoice_date >= CURRENT_DATE - INTERVAL '90 days'
    ), 0) AS days_61_90_amount,
    COUNT(*) FILTER (
      WHERE o.payment_status = 'invoiced'
      AND o.invoice_date < CURRENT_DATE - INTERVAL '90 days'
    ) AS days_90_plus_count,
    COALESCE(SUM(o.revenue) FILTER (
      WHERE o.payment_status = 'invoiced'
      AND o.invoice_date < CURRENT_DATE - INTERVAL '90 days'
    ), 0) AS days_90_plus_amount,
    COALESCE(SUM(o.revenue) FILTER (
      WHERE o.payment_status = 'invoiced'
    ), 0) AS total_outstanding
  FROM orders o
  JOIN brokers b ON b.id = o.broker_id AND b.tenant_id = o.tenant_id
  WHERE o.payment_status = 'invoiced'
  GROUP BY o.tenant_id, b.id, b.name;

-- CRITICAL: security_invoker makes the view respect the caller's RLS context
ALTER VIEW broker_aging SET (security_invoker = true);
```

### Driver Earnings Query

```typescript
// Server Component or Server Action
export async function getDriverEarnings(driverId: string, startDate: string, endDate: string) {
  const supabase = await createClient()

  const { data: trips } = await supabase
    .from('trips')
    .select(`
      id,
      start_date,
      end_date,
      status,
      total_revenue,
      clean_gross,
      driver_pay,
      dispatch_fee,
      total_expenses,
      net_profit,
      order_count,
      driver:drivers(driver_type, driver_cut_percent, dispatch_fee_percent)
    `)
    .eq('driver_id', driverId)
    .eq('status', 'completed')
    .gte('end_date', startDate)
    .lte('end_date', endDate)
    .order('end_date', { ascending: false })

  const summary = {
    totalTrips: trips?.length || 0,
    totalEarnings: trips?.reduce((sum, t) => sum + (t.driver_pay || 0), 0) || 0,
    totalRevenue: trips?.reduce((sum, t) => sum + (t.total_revenue || 0), 0) || 0,
    totalOrders: trips?.reduce((sum, t) => sum + (t.order_count || 0), 0) || 0,
    trips: trips || [],
  }

  return summary
}
```

---

## 7. File Storage Architecture

### Tenant-Scoped Paths

All files are stored in Supabase Storage with tenant-scoped paths to prevent cross-tenant access:

```
Bucket: documents
  /{tenant_id}/inspections/{inspection_id}/{filename}
  /{tenant_id}/bol/{order_id}/{filename}
  /{tenant_id}/invoices/{invoice_id}/{filename}
  /{tenant_id}/drivers/{driver_id}/cdl.pdf
  /{tenant_id}/drivers/{driver_id}/medical_card.pdf
  /{tenant_id}/trucks/{truck_id}/registration.pdf
  /{tenant_id}/trucks/{truck_id}/insurance.pdf
  /{tenant_id}/company/{filename}

Bucket: signatures
  /{tenant_id}/{inspection_id}/driver_signature.png
  /{tenant_id}/{inspection_id}/customer_signature.png

Bucket: photos
  /{tenant_id}/inspections/{inspection_id}/{step}_{index}.jpg
  /{tenant_id}/inspections/{inspection_id}/video.mp4
```

### Storage RLS Policies

```sql
-- Bucket: documents (private)
-- Only authenticated users can access files in their tenant's folder

-- SELECT (download)
CREATE POLICY "tenant_read_documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (SELECT public.get_tenant_id())::text
);

-- INSERT (upload)
CREATE POLICY "tenant_upload_documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (SELECT public.get_tenant_id())::text
);

-- UPDATE (overwrite)
CREATE POLICY "tenant_update_documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (SELECT public.get_tenant_id())::text
);

-- DELETE
CREATE POLICY "tenant_delete_documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (SELECT public.get_tenant_id())::text
);

-- Apply same pattern to 'signatures' and 'photos' buckets
```

### Signed URL Generation (Server Action)

```typescript
// app/actions/files.ts
'use server'

import { createClient } from '@/lib/supabase/server'

export async function getSignedUrl(bucket: string, path: string, expiresIn = 3600) {
  const supabase = await createClient()

  // RLS ensures path must start with user's tenant_id
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)

  if (error) return { error: error.message }
  return { url: data.signedUrl }
}

export async function uploadFile(bucket: string, path: string, file: File) {
  const supabase = await createClient()

  // tenant_id prefix is enforced by storage RLS
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) return { error: error.message }
  return { path: data.path }
}
```

---

## 8. Realtime Architecture

### RLS-Filtered Subscriptions

Supabase Realtime respects RLS policies. When a client subscribes to a table, they only receive change events for rows they can access (their tenant's rows).

```typescript
// hooks/useRealtimeOrders.ts
'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createBrowserClient } from '@/lib/supabase/client'

export function useRealtimeOrders() {
  const supabase = createBrowserClient()
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',          // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          // Granular cache updates instead of full invalidation
          switch (payload.eventType) {
            case 'INSERT':
              queryClient.invalidateQueries({ queryKey: ['orders'] })
              break
            case 'UPDATE':
              // Update specific order in cache
              queryClient.setQueriesData(
                { queryKey: ['orders'] },
                (old: any) => {
                  if (!old?.orders) return old
                  return {
                    ...old,
                    orders: old.orders.map((o: any) =>
                      o.id === payload.new.id ? { ...o, ...payload.new } : o
                    ),
                  }
                }
              )
              // Also invalidate the specific order detail query
              queryClient.invalidateQueries({
                queryKey: ['order', payload.new.id],
              })
              break
            case 'DELETE':
              queryClient.invalidateQueries({ queryKey: ['orders'] })
              break
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])
}
```

### Dispatch Board Realtime (Multiple Tables)

```typescript
// hooks/useRealtimeDispatch.ts
'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createBrowserClient } from '@/lib/supabase/client'

export function useRealtimeDispatch() {
  const supabase = createBrowserClient()
  const queryClient = useQueryClient()

  useEffect(() => {
    // Subscribe to all tables relevant to dispatch board
    const channel = supabase
      .channel('dispatch-board')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => queryClient.invalidateQueries({ queryKey: ['dispatch'] })
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'trips' },
        () => queryClient.invalidateQueries({ queryKey: ['dispatch'] })
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'drivers' },
        () => queryClient.invalidateQueries({ queryKey: ['dispatch'] })
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Dispatch board realtime connected')
        }
      })

    // Handle reconnection
    channel.on('system', { event: 'reconnect' }, () => {
      // On reconnect, invalidate all queries to ensure data freshness
      queryClient.invalidateQueries({ queryKey: ['dispatch'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['trips'] })
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])
}
```

### Broadcast (Non-Persistent Events)

For ephemeral events that do not need to be stored in the database:

```typescript
// Broadcast typing indicators, cursor positions, etc.
// These are sent peer-to-peer via Supabase Realtime, not stored in Postgres

// Sender
const channel = supabase.channel('dispatch-presence')
channel.send({
  type: 'broadcast',
  event: 'order-editing',
  payload: {
    userId: user.id,
    orderId: '123',
    userName: user.user_metadata.full_name,
  },
})

// Receiver
channel.on('broadcast', { event: 'order-editing' }, (payload) => {
  // Show "Jane is editing this order..." indicator
  setEditingUsers((prev) => [...prev, payload.payload])
})
```

---

## 9. Anti-Patterns to Avoid

### Anti-Pattern 1: Service Role Client in Client Components

**What:** Using Supabase's `service_role` key in browser-side code.

**Why bad:** The service role bypasses ALL RLS policies. If exposed to the client, any user can read/write any tenant's data. This is a catastrophic security vulnerability.

**Instead:** Always use the `anon` key in client components. Use `service_role` only in Next.js API routes and server actions that run exclusively on the server.

```typescript
// WRONG: service role in a client component
'use client'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!) // CATASTROPHIC

// CORRECT: anon key in client, service role only on server
// lib/supabase/client.ts (client-side)
'use client'
export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // anon key, RLS enforced
  )
}

// lib/supabase/service-role.ts (server-side only, never imported in client code)
export function createServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,    // No NEXT_PUBLIC_ prefix = server only
    { auth: { persistSession: false } }
  )
}
```

### Anti-Pattern 2: Application-Level Tenant Filtering Instead of RLS

**What:** Relying on `WHERE tenant_id = ?` in application code instead of RLS policies.

**Why bad:** One missed WHERE clause equals a data leak across tenants. This is the single most common multi-tenant security vulnerability.

**Instead:** RLS policies enforce tenant isolation at the database level. Application-level filters are an optimization (helps the query planner), not a security measure.

```typescript
// WRONG: relying only on application filter
const { data } = await supabase
  .from('orders')
  .select('*')
  .eq('tenant_id', tenantId)  // If this line is missing, data leaks

// CORRECT: RLS enforces isolation, .eq() is optional optimization
// The RLS policy on `orders` ensures tenant isolation even without .eq()
const { data } = await supabase
  .from('orders')
  .select('*')
  // tenant_id filter is optional here (helps query planner, not security)
  .eq('status', 'pending')
```

### Anti-Pattern 3: Fat Edge Functions

**What:** Putting complex business logic (invoice calculation, report generation, PDF creation) in Supabase Edge Functions.

**Why bad:** Edge Functions have cold starts (200-400ms), execution timeouts, Deno runtime limitations, and are harder to test/debug than Next.js API routes.

**Instead:** Use Edge Functions for lightweight, event-driven tasks (send email on order status change, notify on invoice overdue). Put complex logic in Next.js API routes where you have full Node.js, better debugging, and no cold start penalty.

```typescript
// WRONG: Complex PDF generation in Edge Function
// supabase/functions/generate-invoice/index.ts
// - Cold start penalty on every invocation
// - Deno compatibility issues with PDF libraries
// - Hard to test locally
// - Timeout risk for large documents

// CORRECT: PDF generation in Next.js API route
// app/api/invoices/[id]/pdf/route.ts
import { PDFDocument } from 'pdf-lib'
export async function GET(req: Request, { params }: { params: { id: string } }) {
  // Full Node.js runtime, no cold start, easy to test
  const pdf = await generateInvoicePDF(params.id)
  return new Response(pdf, {
    headers: { 'Content-Type': 'application/pdf' }
  })
}
```

### Anti-Pattern 4: Direct Supabase Calls from Client for Writes

**What:** Calling `supabase.from('orders').insert(...)` directly from React client components.

**Why bad:** No server-side validation, no business rule enforcement, harder to add logging/auditing later.

**Instead:** Use Server Actions for all mutations. Client components call the action; the action validates, processes, and writes to Supabase.

```typescript
// WRONG: Direct write from client
'use client'
function CreateOrderForm() {
  const handleSubmit = async () => {
    // No validation, no business rules, no audit trail
    await supabase.from('orders').insert({ ...formData })
  }
}

// CORRECT: Server Action handles validation and write
// app/actions/orders.ts
'use server'
export async function createOrder(formData: FormData) {
  // 1. Validate with Zod
  // 2. Enforce business rules (tier limits, required fields)
  // 3. Write to database
  // 4. Revalidate cache
  // 5. Return result
}

// Client just calls the action
'use client'
function CreateOrderForm() {
  const handleSubmit = async (formData: FormData) => {
    const result = await createOrder(formData)
    if (result.error) showToast(result.error, 'error')
  }
}
```

### Anti-Pattern 5: RLS Policies Without `(SELECT ...)` Wrapper

**What:** Writing RLS policies that call `auth.jwt()` or `get_tenant_id()` directly without wrapping in a subselect.

**Why bad:** Without the wrapper, the function is evaluated once per row in the table. On 100K rows, this means 100K function calls instead of 1. Queries go from 2ms to minutes.

```sql
-- WRONG: Function evaluated per row (O(n) function calls)
CREATE POLICY bad_policy ON orders
  USING (tenant_id = public.get_tenant_id());

-- CORRECT: Function evaluated once via InitPlan (O(1) function call)
CREATE POLICY good_policy ON orders
  USING (tenant_id = (SELECT public.get_tenant_id()));
--                    ^^^^^^^^                      ^
```

### Anti-Pattern 6: Storing Computed Financials Only in Views

**What:** Creating PostgreSQL views for trip financials and reading them on every page load instead of denormalizing computed values onto the trip record.

**Why bad:** Views with JOINs and aggregations across orders/expenses are expensive to compute. The dispatch board loads dozens of trips -- computing financials for each one on every read is wasteful. Furthermore, views that aggregate across tables can produce confusing results when combined with RLS.

**Instead:** Calculate financials in application code (TypeScript) when data changes, and store the results as denormalized columns on the `trips` table. Read the denormalized values for display. Recalculate when orders are added/removed or expenses change.

```typescript
// CORRECT: Denormalized approach
// When an order is assigned to a trip:
await assignOrderToTrip(orderId, tripId)
await recalculateTripFinancials(tripId) // Updates denormalized columns

// When reading trips for the dispatch board:
const { data: trips } = await supabase
  .from('trips')
  .select('*, driver:drivers(first_name, last_name)')
  // No JOINs to orders/expenses needed -- financials are on the trip row
```

---

## 10. Performance Playbook

### Index Strategy

Every `tenant_id` column MUST be indexed. Composite indexes for common query patterns:

```sql
-- ============================================================
-- PRIMARY INDEXES (tenant_id on every table)
-- ============================================================
CREATE INDEX idx_orders_tenant_id ON orders (tenant_id);
CREATE INDEX idx_trips_tenant_id ON trips (tenant_id);
CREATE INDEX idx_drivers_tenant_id ON drivers (tenant_id);
CREATE INDEX idx_trucks_tenant_id ON trucks (tenant_id);
CREATE INDEX idx_brokers_tenant_id ON brokers (tenant_id);
CREATE INDEX idx_expenses_tenant_id ON expenses (tenant_id);
CREATE INDEX idx_inspections_tenant_id ON inspections (tenant_id);
CREATE INDEX idx_invoices_tenant_id ON invoices (tenant_id);
CREATE INDEX idx_company_files_tenant_id ON company_files (tenant_id);
CREATE INDEX idx_tasks_tenant_id ON tasks (tenant_id);
CREATE INDEX idx_invitations_tenant_id ON invitations (tenant_id);
CREATE INDEX idx_tenant_memberships_tenant_id ON tenant_memberships (tenant_id);

-- ============================================================
-- COMPOSITE INDEXES (common query patterns)
-- ============================================================
-- Orders: filter by tenant + status (most common query)
CREATE INDEX idx_orders_tenant_status ON orders (tenant_id, status);

-- Orders: filter by tenant + trip (loading orders for a trip)
CREATE INDEX idx_orders_tenant_trip ON orders (tenant_id, trip_id);

-- Orders: filter by tenant + broker + payment_status (billing page)
CREATE INDEX idx_orders_tenant_broker_payment ON orders (tenant_id, broker_id, payment_status);

-- Orders: filter by tenant + invoice_date (aging analysis)
CREATE INDEX idx_orders_tenant_invoice_date ON orders (tenant_id, invoice_date)
  WHERE payment_status = 'invoiced';

-- Trips: filter by tenant + status (dispatch board)
CREATE INDEX idx_trips_tenant_status ON trips (tenant_id, status);

-- Trips: filter by tenant + driver (driver earnings)
CREATE INDEX idx_trips_tenant_driver ON trips (tenant_id, driver_id);

-- Trips: filter by tenant + date range (reports)
CREATE INDEX idx_trips_tenant_dates ON trips (tenant_id, start_date, end_date);

-- Expenses: filter by tenant + trip (trip detail page)
CREATE INDEX idx_expenses_tenant_trip ON expenses (tenant_id, trip_id);

-- Inspections: filter by tenant + order (order detail page)
CREATE INDEX idx_inspections_tenant_order ON inspections (tenant_id, order_id);

-- Invoices: filter by tenant + status (invoice list)
CREATE INDEX idx_invoices_tenant_status ON invoices (tenant_id, status);

-- Tenant memberships: lookup by user_id (auth hook)
CREATE INDEX idx_memberships_user_id ON tenant_memberships (user_id);

-- Invitations: lookup by token (accept flow)
CREATE INDEX idx_invitations_token ON invitations (token);

-- Stripe: lookup by customer_id (webhook processing)
CREATE INDEX idx_tenants_stripe_customer ON tenants (stripe_customer_id);
```

### RLS Function Caching

The `get_tenant_id()` function is marked `STABLE`, which tells PostgreSQL the result does not change within a single statement. Combined with the `(SELECT ...)` wrapper in policies, the function is called exactly once per query.

**Verification:**

```sql
-- Run EXPLAIN ANALYZE on a query with RLS enabled
-- Look for "InitPlan" in the output -- that means the function is cached
EXPLAIN ANALYZE SELECT * FROM orders WHERE status = 'pending';

-- Good output includes:
--   InitPlan
--     ->  Result
--           Output: get_tenant_id()
-- This means get_tenant_id() is called once, not per row.
```

### Connection Pooling

Supabase provides two connection endpoints:

| Endpoint | Port | Use For | Mode |
|----------|------|---------|------|
| **Pooler (Transaction mode)** | 6543 | Serverless functions, Next.js API routes, Server Actions | Transaction pooling (PgBouncer) |
| **Direct** | 5432 | Migrations, long-running scripts, Drizzle schema push | Direct Postgres connection |

```typescript
// lib/db/drizzle.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

// Use pooler for production queries
const connectionString = process.env.NODE_ENV === 'production'
  ? process.env.DATABASE_URL!          // Pooler (port 6543, transaction mode)
  : process.env.DATABASE_URL_DIRECT!   // Direct (port 5432, for local dev)

const client = postgres(connectionString, {
  max: 1, // Serverless: 1 connection per function instance
  idle_timeout: 20,
  connect_timeout: 10,
})

export const db = drizzle(client)
```

```bash
# Environment variables
# Pooler (transaction mode) - for all runtime queries
DATABASE_URL="postgresql://postgres.ref:password@aws-0-region.pooler.supabase.com:6543/postgres"

# Direct - for migrations only
DATABASE_URL_DIRECT="postgresql://postgres.ref:password@aws-0-region.supabase.com:5432/postgres"
```

### Supabase Pro Plan Connection Limits

| Plan | Direct Connections | Pooler Connections |
|------|-------------------|-------------------|
| Free | 60 | 200 |
| Pro | 60 | 200 |
| Team | 120 | 400 |

With serverless (Vercel), every function invocation can open a new connection. Always use the pooler in production to stay within limits.

### Performance Benchmarks to Target

| Metric | Target | How to Measure |
|--------|--------|---------------|
| **Order list page** | < 200ms server response | Next.js Server Component render time |
| **Dispatch board load** | < 500ms initial, < 100ms updates | TanStack Query + Realtime |
| **Trip financial recalculation** | < 100ms | Server Action execution time |
| **RLS overhead per query** | < 5ms additional | Compare `EXPLAIN ANALYZE` with/without RLS |
| **Realtime event delivery** | < 500ms end-to-end | Time from DB write to client re-render |
| **Stripe webhook processing** | < 2s end-to-end | Time from webhook receipt to DB update |
| **File upload (5MB)** | < 3s | Supabase Storage upload time |
| **Core Web Vitals (LCP)** | < 2.5s | Lighthouse / PageSpeed Insights |
| **Core Web Vitals (FID)** | < 100ms | Lighthouse / PageSpeed Insights |
| **Core Web Vitals (CLS)** | < 0.1 | Lighthouse / PageSpeed Insights |

### Query Optimization Checklist

1. Every `SELECT` query adds `.eq('tenant_id', tenantId)` as a hint (even though RLS handles security)
2. Every list page uses `.range()` for pagination (never load all rows)
3. Every `SELECT` specifies columns (never `select('*')` on tables with JSONB)
4. Batch related queries with `Promise.all()` where possible
5. Use `{ count: 'exact', head: true }` for count-only queries (no data transfer)
6. Denormalized summary columns avoid expensive aggregation at read time
7. Views use `security_invoker = true` when they need to respect RLS

### Scalability Considerations

| Concern | At 100 tenants | At 1,000 tenants | At 10,000 tenants |
|---------|----------------|-------------------|---------------------|
| RLS performance | No concern (with indexes) | Monitor slow queries, ensure composite indexes | Consider read replicas, possibly schema-per-tenant for largest customers |
| Database size | ~1GB, single Supabase Pro instance | ~10-50GB, still single instance | ~100-500GB, consider partitioning large tables |
| Connection pooling | Default Supabase pooling sufficient | May need to increase pool size | Supabase Fly Postgres or external PgBouncer |
| Realtime subscriptions | ~100-500 concurrent WebSockets | ~1,000-5,000, monitor Realtime limits | May need dedicated Realtime infrastructure |
| Edge Functions | No concern | Monitor cold start frequency | Combine functions, use Next.js API routes for high-traffic endpoints |
| Storage | ~10GB, Supabase included storage | ~100GB, may exceed Pro plan storage | ~1TB+, consider direct S3/R2 for large files |
| Vercel costs | ~$20/month | ~$100-300/month | $500-2,000+/month, evaluate self-hosting |

---

## Sources

- [Supabase: RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase: Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
- [Supabase: Edge Functions Architecture](https://supabase.com/docs/guides/functions/architecture)
- [Supabase: Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase: Realtime with RLS](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Stripe: Build Subscriptions Integration](https://docs.stripe.com/billing/subscriptions/build-subscriptions)
- [Stripe: Webhook Best Practices](https://docs.stripe.com/webhooks/best-practices)
- [Next.js: Server Actions and Mutations](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [AWS: Multi-Tenant Data Isolation with PostgreSQL RLS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [Crunchy Data: RLS for Tenants](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres)
- [MakerKit: Supabase RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Nile: Shipping Multi-Tenant SaaS with RLS](https://www.thenile.dev/blog/multi-tenant-rls)
