# Architecture Patterns: VroomX SaaS TMS

**Domain:** Multi-tenant SaaS TMS
**Researched:** 2026-02-11

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

## Patterns to Follow

### Pattern 1: Server Action for Mutations

**What:** Use Next.js Server Actions for all data mutations (create, update, delete). Do not call Supabase directly from client components for writes.

**When:** Any user-initiated data change.

**Why:** Server Actions run on the server, allowing you to validate inputs, check permissions, enforce business rules, and call Supabase with the server-side client. The client never needs to know about database structure.

```typescript
// app/actions/orders.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createOrder(formData: FormData) {
  const supabase = await createClient()

  // Server-side validation
  const vehicleYear = parseInt(formData.get('vehicle_year') as string)
  if (vehicleYear < 1900 || vehicleYear > new Date().getFullYear() + 2) {
    return { error: 'Invalid vehicle year' }
  }

  const { data, error } = await supabase
    .from('orders')
    .insert({
      vehicle_year: vehicleYear,
      vehicle_make: formData.get('vehicle_make'),
      // tenant_id is set by database trigger from auth.jwt()
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/orders')
  return { data }
}
```

### Pattern 2: TanStack Query + Supabase Realtime Hybrid

**What:** Use TanStack Query for data fetching/caching and Supabase Realtime for live invalidation.

**When:** Any page that displays data which other users might change (dispatch board, order list).

**Why:** TanStack Query provides caching, optimistic updates, and stale-while-revalidate. Supabase Realtime tells you WHEN data has changed. Together, they provide a responsive UI without polling.

```typescript
// hooks/useOrders.ts
export function useOrders(filters: OrderFilters) {
  const supabase = createBrowserClient()
  const queryClient = useQueryClient()

  // Fetch with TanStack Query
  const query = useQuery({
    queryKey: ['orders', filters],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, broker:brokers(name), driver:drivers(name)')
        .match(filters)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  // Realtime invalidation
  useEffect(() => {
    const channel = supabase
      .channel('orders-live')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => queryClient.invalidateQueries({ queryKey: ['orders'] })
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, queryClient])

  return query
}
```

### Pattern 3: Tenant-Scoped Database Triggers

**What:** Use PostgreSQL triggers to automatically set `tenant_id` on INSERT, so application code never needs to provide it.

**When:** Every table with `tenant_id`.

**Why:** Defense in depth. Even if application code forgets to set `tenant_id`, the trigger ensures it is always populated from the JWT. Combined with RLS, this makes cross-tenant data leakage structurally impossible.

```sql
CREATE OR REPLACE FUNCTION set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tenant_id := (auth.jwt()->'app_metadata'->>'tenant_id')::uuid;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to every tenant-scoped table
CREATE TRIGGER set_tenant_id_on_orders
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id();
```

### Pattern 4: Middleware-Based Tenant Context

**What:** Use Next.js Middleware to validate auth and extract tenant context before any page renders.

**When:** Every authenticated route.

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createServerClient(/* ... */)

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Tenant context available for all downstream components
  if (user) {
    const tenantId = user.app_metadata?.tenant_id
    if (!tenantId) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  return response
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Service Role Client in Client Components

**What:** Using Supabase's `service_role` key in browser-side code.

**Why bad:** The service role bypasses ALL RLS policies. If exposed to the client, any user can read/write any tenant's data. This is a catastrophic security vulnerability.

**Instead:** Always use the `anon` key in client components. Use `service_role` only in Next.js API routes and server actions that run exclusively on the server.

### Anti-Pattern 2: Application-Level Tenant Filtering Instead of RLS

**What:** Relying on `WHERE tenant_id = ?` in application code instead of RLS policies.

**Why bad:** One missed WHERE clause = data leak across tenants. This is the single most common multi-tenant security vulnerability.

**Instead:** RLS policies enforce tenant isolation at the database level. Application-level filters are an optimization (helps the query planner), not a security measure.

### Anti-Pattern 3: Fat Edge Functions

**What:** Putting complex business logic (invoice calculation, report generation, PDF creation) in Supabase Edge Functions.

**Why bad:** Edge Functions have cold starts (200-400ms), execution timeouts, Deno runtime limitations, and are harder to test/debug than Next.js API routes.

**Instead:** Use Edge Functions for lightweight, event-driven tasks (send email on order status change, notify on invoice overdue). Put complex logic in Next.js API routes where you have full Node.js, better debugging, and no cold start penalty.

### Anti-Pattern 4: Direct Supabase Calls from Client for Writes

**What:** Calling `supabase.from('orders').insert(...)` directly from React client components.

**Why bad:** No server-side validation, no business rule enforcement, harder to add logging/auditing later.

**Instead:** Use Server Actions for all mutations. Client components call the action; the action validates, processes, and writes to Supabase.

## Scalability Considerations

| Concern | At 100 tenants | At 1,000 tenants | At 10,000 tenants |
|---------|----------------|-------------------|---------------------|
| RLS performance | No concern (with indexes) | Monitor slow queries, ensure composite indexes | Consider read replicas, possibly schema-per-tenant for largest customers |
| Database size | ~1GB, single Supabase Pro instance | ~10-50GB, still single instance | ~100-500GB, consider partitioning large tables |
| Connection pooling | Default Supabase pooling sufficient | May need to increase pool size | Supabase Fly Postgres or external PgBouncer |
| Realtime subscriptions | ~100-500 concurrent WebSockets | ~1,000-5,000, monitor Realtime limits | May need dedicated Realtime infrastructure |
| Edge Functions | No concern | Monitor cold start frequency | Combine functions, use Next.js API routes for high-traffic endpoints |
| Storage | ~10GB, Supabase included storage | ~100GB, may exceed Pro plan storage | ~1TB+, consider direct S3/R2 for large files |
| Vercel costs | ~$20/month | ~$100-300/month | $500-2,000+/month, evaluate self-hosting |

## Sources
- [Supabase: RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase: Edge Functions Architecture](https://supabase.com/docs/guides/functions/architecture)
- [Next.js: Server Actions and Mutations](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
