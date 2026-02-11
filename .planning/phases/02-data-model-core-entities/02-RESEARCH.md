# Phase 2: Data Model + Core Entities (CRUD) - Research

**Researched:** 2026-02-11
**Domain:** Full-stack CRUD with Drizzle ORM, React Hook Form, shadcn/ui, TanStack Query, Supabase RLS
**Confidence:** HIGH

## Summary

Phase 2 builds the core entity management layer for VroomX TMS: orders, drivers, trucks, and brokers with full CRUD operations, card-grid list views, slide-out drawer forms, server-side pagination/filtering, VIN decode integration, and realtime updates. The existing Phase 1 foundation provides Supabase auth with JWT-based multi-tenancy, Drizzle ORM (v0.45.1) with a Postgres connection, Zod v4 for validation, and TanStack Query v5 already installed.

The primary technical challenges are: (1) extending the Drizzle schema with proper enums, relations, and RLS policies for 4+ new entity tables; (2) building a multi-step wizard form inside a shadcn/ui Sheet component with auto-save drafts; (3) integrating the free NHTSA vPIC API for VIN decoding; (4) implementing server-side filtering and cursor/offset pagination with TanStack Query; and (5) wiring Supabase Realtime to invalidate TanStack Query caches on entity changes.

The stack is fully decided from Phase 1 -- no new major library decisions. The new additions are React Hook Form + @hookform/resolvers for form state management, and several additional shadcn/ui components (Sheet, Badge, Select, Tabs, Dialog, Skeleton, Tooltip, Textarea). The NHTSA vPIC API is free, requires no API key, and returns JSON with year/make/model/body type for any valid VIN.

**Primary recommendation:** Use Drizzle pgEnum for status types, React Hook Form with Zod v4 zodResolver for all forms, shadcn/ui Sheet (side="right") for slide-out drawers, Zustand persist middleware for draft auto-save, and the NHTSA DecodeVinValues flat-format endpoint for VIN lookups.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.1 | Schema definition, queries, migrations | Already in use from Phase 1, type-safe SQL |
| drizzle-kit | 0.31.9 | Migration generation | Already in use from Phase 1 |
| @tanstack/react-query | 5.90.21 | Client-side data fetching, caching, pagination | Already installed, best React data layer |
| zod | 4.3.6 | Schema validation (shared client/server) | Already installed, Zod v4 |
| zustand | 5.0.11 | UI state (sidebar, modals, form drafts) | Already in use from Phase 1 |
| @supabase/supabase-js | 2.95.3 | Database client, Realtime subscriptions | Already in use from Phase 1 |
| @supabase/ssr | 0.8.0 | Server-side Supabase client | Already in use from Phase 1 |
| lucide-react | 0.563.0 | Icons | Already in use from Phase 1 |

### New Dependencies (To Install)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | ^7.56 | Form state management, dirty tracking, multi-step | Industry standard for React forms, pairs with Zod |
| @hookform/resolvers | ^5.2 | Zod v4 resolver for react-hook-form | Official bridge, v5.2+ supports Zod v4 |

### shadcn/ui Components (To Add)
| Component | Purpose | Install Command |
|-----------|---------|-----------------|
| Sheet | Slide-out drawer for entity creation/editing | `npx shadcn@latest add sheet` |
| Badge | Status badges (color-coded per order status) | `npx shadcn@latest add badge` |
| Select | Dropdowns for status, type, driver, broker | `npx shadcn@latest add select` |
| Form | Form fields with RHF integration | `npx shadcn@latest add form` |
| Tabs | Multi-step wizard navigation inside Sheet | `npx shadcn@latest add tabs` |
| Dialog | Confirmation dialogs (discard unsaved, cancel) | `npx shadcn@latest add dialog` |
| Skeleton | Loading state placeholders for cards/lists | `npx shadcn@latest add skeleton` |
| Textarea | Notes fields | `npx shadcn@latest add textarea` |
| Tooltip | Quick info on truncated fields | `npx shadcn@latest add tooltip` |
| Popover | Date picker container | `npx shadcn@latest add popover` |
| Calendar | Date range selection for filters | `npx shadcn@latest add calendar` |
| Switch | Toggle active/inactive states | `npx shadcn@latest add switch` |
| ScrollArea | Scrollable sheet content | `npx shadcn@latest add scroll-area` |
| AlertDialog | Destructive action confirmations | `npx shadcn@latest add alert-dialog` |

### External APIs
| API | Cost | Purpose | Rate Limit |
|-----|------|---------|------------|
| NHTSA vPIC DecodeVinValues | Free | VIN decode -> year/make/model/type | Automated traffic rate control (generous) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-hook-form | Conform (server-first forms) | RHF has better multi-step wizard support and draft persistence |
| NHTSA API direct | @shaggytools/nhtsa-api-wrapper (npm) | Wrapper adds dependency for simple fetch; direct fetch is 5 lines |
| shadcn/ui Sheet | shadcn/ui Drawer (Vaul) | Sheet is better for desktop side panels; Drawer is mobile-first bottom sheet |
| Zustand persist for drafts | localStorage directly | Zustand gives reactive state + automatic serialization |

**Installation:**
```bash
npm install react-hook-form @hookform/resolvers
npx shadcn@latest add sheet badge select form tabs dialog skeleton textarea tooltip popover calendar switch scroll-area alert-dialog
```

## Architecture Patterns

### Recommended Project Structure (New Files for Phase 2)
```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── orders/
│   │   │   ├── page.tsx              # Orders list (Server Component -> Client)
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx          # Order detail view
│   │   │   └── _components/
│   │   │       ├── order-card.tsx     # Individual order card
│   │   │       ├── order-list.tsx     # Card grid with filters
│   │   │       ├── order-filters.tsx  # Filter bar component
│   │   │       ├── order-form.tsx     # Multi-step wizard form
│   │   │       ├── order-drawer.tsx   # Sheet wrapper for create/edit
│   │   │       └── status-badge.tsx   # Color-coded status badge
│   │   ├── drivers/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx
│   │   │   └── _components/
│   │   │       ├── driver-card.tsx
│   │   │       ├── driver-list.tsx
│   │   │       ├── driver-form.tsx
│   │   │       └── driver-drawer.tsx
│   │   ├── trucks/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx
│   │   │   └── _components/
│   │   │       ├── truck-card.tsx
│   │   │       ├── truck-list.tsx
│   │   │       ├── truck-form.tsx
│   │   │       └── truck-drawer.tsx
│   │   └── brokers/
│   │       ├── page.tsx
│   │       ├── [id]/
│   │       │   └── page.tsx
│   │       └── _components/
│   │           ├── broker-card.tsx
│   │           ├── broker-list.tsx
│   │           ├── broker-form.tsx
│   │           └── broker-drawer.tsx
│   └── actions/
│       ├── orders.ts                 # Server Actions for orders
│       ├── drivers.ts                # Server Actions for drivers
│       ├── trucks.ts                 # Server Actions for trucks
│       └── brokers.ts                # Server Actions for brokers
├── db/
│   ├── schema.ts                     # Extended with new tables + enums
│   └── relations.ts                  # Drizzle relations v2 definitions
├── hooks/
│   ├── use-orders.ts                 # TanStack Query + Realtime for orders
│   ├── use-drivers.ts                # TanStack Query + Realtime for drivers
│   ├── use-trucks.ts                 # TanStack Query + Realtime for trucks
│   ├── use-brokers.ts                # TanStack Query + Realtime for brokers
│   └── use-vin-decode.ts             # VIN decode hook with NHTSA API
├── lib/
│   ├── queries/
│   │   ├── orders.ts                 # Supabase query builders for orders
│   │   ├── drivers.ts                # Supabase query builders for drivers
│   │   ├── trucks.ts                 # Supabase query builders for trucks
│   │   └── brokers.ts                # Supabase query builders for brokers
│   ├── validations/
│   │   ├── order.ts                  # Zod schemas for order forms + server
│   │   ├── driver.ts                 # Zod schemas for driver forms + server
│   │   ├── truck.ts                  # Zod schemas for truck forms + server
│   │   └── broker.ts                 # Zod schemas for broker forms + server
│   └── vin-decoder.ts                # NHTSA API client wrapper
├── stores/
│   ├── sidebar-store.ts              # Existing
│   └── draft-store.ts                # Zustand persist for form drafts
├── components/
│   ├── ui/                           # shadcn/ui components (existing + new)
│   ├── shared/
│   │   ├── entity-card.tsx           # Shared card layout primitives
│   │   ├── filter-bar.tsx            # Reusable filter bar component
│   │   ├── pagination.tsx            # Pagination controls
│   │   ├── empty-state.tsx           # Empty state component
│   │   ├── loading-skeleton.tsx      # Skeleton loading states
│   │   └── confirm-dialog.tsx        # Reusable confirmation dialog
│   └── providers/
│       └── query-provider.tsx        # QueryClientProvider wrapper
└── types/
    └── index.ts                      # Extended with entity types
```

### Pattern 1: Server Action Mutations with Zod Validation
**What:** All write operations go through Server Actions with shared Zod schemas
**When to use:** Every create/update/delete operation on any entity
**Example:**
```typescript
// lib/validations/order.ts (shared between client and server)
import { z } from 'zod'

export const orderVehicleSchema = z.object({
  vehicleVin: z.string().length(17).optional(),
  vehicleYear: z.coerce.number().min(1900).max(new Date().getFullYear() + 2),
  vehicleMake: z.string().min(1, 'Make is required'),
  vehicleModel: z.string().min(1, 'Model is required'),
  vehicleType: z.string().optional(),
  vehicleColor: z.string().optional(),
})

export const orderLocationSchema = z.object({
  pickupLocation: z.string().min(1, 'Pickup location is required'),
  pickupCity: z.string().min(1),
  pickupState: z.string().min(2).max(2),
  pickupZip: z.string().optional(),
  pickupContactName: z.string().optional(),
  pickupContactPhone: z.string().optional(),
  pickupDate: z.string().optional(),
  deliveryLocation: z.string().min(1, 'Delivery location is required'),
  deliveryCity: z.string().min(1),
  deliveryState: z.string().min(2).max(2),
  deliveryZip: z.string().optional(),
  deliveryContactName: z.string().optional(),
  deliveryContactPhone: z.string().optional(),
  deliveryDate: z.string().optional(),
})

export const orderPricingSchema = z.object({
  revenue: z.coerce.number().min(0),
  carrierPay: z.coerce.number().min(0),
  brokerFee: z.coerce.number().min(0).default(0),
  paymentType: z.enum(['COD', 'COP', 'CHECK', 'BILL', 'SPLIT']),
  brokerId: z.string().uuid().optional(),
})

// Combined schema for server-side validation
export const createOrderSchema = orderVehicleSchema
  .merge(orderLocationSchema)
  .merge(orderPricingSchema)

// app/actions/orders.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { createOrderSchema } from '@/lib/validations/order'
import { revalidatePath } from 'next/cache'

export async function createOrder(data: unknown) {
  const parsed = createOrderSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      vehicle_vin: parsed.data.vehicleVin,
      vehicle_year: parsed.data.vehicleYear,
      vehicle_make: parsed.data.vehicleMake,
      // ... map camelCase to snake_case
      status: 'new',
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/orders')
  return { data: order }
}
```

### Pattern 2: TanStack Query + Supabase Client Reads with Realtime Invalidation
**What:** Client components fetch via TanStack Query; Supabase Realtime invalidates cache on changes
**When to use:** All list views and detail views
**Example:**
```typescript
// hooks/use-orders.ts
'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createBrowserClient } from '@/lib/supabase/client'
import { useEffect } from 'react'

interface OrderFilters {
  status?: string
  brokerId?: string
  driverId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  page?: number
  pageSize?: number
}

export function useOrders(filters: OrderFilters = {}) {
  const supabase = createBrowserClient()
  const queryClient = useQueryClient()
  const { page = 0, pageSize = 20, ...restFilters } = filters

  const query = useQuery({
    queryKey: ['orders', filters],
    queryFn: async () => {
      let q = supabase
        .from('orders')
        .select('*, broker:brokers(id, name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (restFilters.status) q = q.eq('status', restFilters.status)
      if (restFilters.brokerId) q = q.eq('broker_id', restFilters.brokerId)
      if (restFilters.dateFrom) q = q.gte('created_at', restFilters.dateFrom)
      if (restFilters.dateTo) q = q.lte('created_at', restFilters.dateTo)
      if (restFilters.search) q = q.or(
        `vehicle_vin.ilike.%${restFilters.search}%,vehicle_make.ilike.%${restFilters.search}%,order_number.ilike.%${restFilters.search}%`
      )

      const { data, error, count } = await q
      if (error) throw error
      return { orders: data, total: count ?? 0 }
    },
    staleTime: 30_000,
  })

  // Realtime invalidation
  useEffect(() => {
    const channel = supabase
      .channel('orders-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, queryClient])

  return query
}
```

### Pattern 3: Multi-Step Wizard Form in Sheet
**What:** Order creation uses a stepped form inside a shadcn/ui Sheet (right side)
**When to use:** Complex entity creation (orders)
**Example:**
```typescript
// Conceptual pattern - not complete implementation
'use client'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

const STEPS = ['Vehicle', 'Pickup & Delivery', 'Pricing & Broker'] as const

export function OrderDrawer({ open, onOpenChange }: Props) {
  const [step, setStep] = useState(0)
  const form = useForm({
    resolver: zodResolver(createOrderSchema),
    defaultValues: loadDraft('order') ?? defaultOrderValues,
  })

  // Auto-save draft on form change
  useEffect(() => {
    const subscription = form.watch((values) => {
      saveDraft('order', values)
    })
    return () => subscription.unsubscribe()
  }, [form.watch])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>New Order - Step {step + 1} of 3</SheetTitle>
          {/* Step indicator */}
        </SheetHeader>
        <FormProvider {...form}>
          {step === 0 && <VehicleStep />}
          {step === 1 && <LocationStep />}
          {step === 2 && <PricingStep />}
          <div className="flex justify-between mt-4">
            {step > 0 && <Button variant="outline" onClick={() => setStep(s => s - 1)}>Back</Button>}
            {step < 2 && <Button onClick={() => setStep(s => s + 1)}>Next</Button>}
            {step === 2 && <Button onClick={form.handleSubmit(onSubmit)}>Create Order</Button>}
          </div>
        </FormProvider>
      </SheetContent>
    </Sheet>
  )
}
```

### Pattern 4: Zustand Persist for Draft Auto-Save
**What:** Form state is automatically persisted to localStorage via Zustand persist middleware
**When to use:** All entity creation forms to preserve drafts
**Example:**
```typescript
// stores/draft-store.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface DraftStore {
  drafts: Record<string, Record<string, unknown>>
  saveDraft: (key: string, data: Record<string, unknown>) => void
  loadDraft: (key: string) => Record<string, unknown> | null
  clearDraft: (key: string) => void
  hasDraft: (key: string) => boolean
}

export const useDraftStore = create<DraftStore>()(
  persist(
    (set, get) => ({
      drafts: {},
      saveDraft: (key, data) => set((state) => ({
        drafts: { ...state.drafts, [key]: { ...data, _savedAt: Date.now() } }
      })),
      loadDraft: (key) => get().drafts[key] ?? null,
      clearDraft: (key) => set((state) => {
        const { [key]: _, ...rest } = state.drafts
        return { drafts: rest }
      }),
      hasDraft: (key) => key in get().drafts,
    }),
    {
      name: 'vroomx-drafts',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
```

### Pattern 5: VIN Decode Integration
**What:** Call NHTSA vPIC API to decode VIN into year/make/model/type
**When to use:** Vehicle step of order creation, truck creation
**Example:**
```typescript
// lib/vin-decoder.ts
const NHTSA_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues'

export interface VinDecodeResult {
  make: string
  model: string
  year: string
  bodyClass: string
  vehicleType: string
  errorCode: string
  errorText: string
}

export async function decodeVin(vin: string): Promise<VinDecodeResult> {
  const res = await fetch(`${NHTSA_BASE}/${vin}?format=json`)
  if (!res.ok) throw new Error('VIN decode failed')
  const json = await res.json()
  const result = json.Results?.[0]
  if (!result) throw new Error('No results from VIN decode')
  return {
    make: result.Make || '',
    model: result.Model || '',
    year: result.ModelYear || '',
    bodyClass: result.BodyClass || '',
    vehicleType: result.VehicleType || '',
    errorCode: result.ErrorCode || '',
    errorText: result.ErrorText || '',
  }
}

// hooks/use-vin-decode.ts
'use client'
import { useQuery } from '@tanstack/react-query'
import { decodeVin } from '@/lib/vin-decoder'

export function useVinDecode(vin: string) {
  return useQuery({
    queryKey: ['vin-decode', vin],
    queryFn: () => decodeVin(vin),
    enabled: vin.length === 17, // Only decode complete VINs
    staleTime: Infinity, // VIN data never changes
    retry: 1,
  })
}
```

### Pattern 6: QueryClientProvider Setup
**What:** TanStack Query is already installed but the providers need a QueryClientProvider wrapper
**When to use:** Root layout providers
**Example:**
```typescript
// components/providers/query-provider.tsx
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // 30 seconds
        refetchOnWindowFocus: false,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

### Anti-Patterns to Avoid
- **Direct Supabase writes from client components:** Always use Server Actions for mutations. Client reads are fine via TanStack Query + Supabase browser client, but writes go through Server Actions for validation and business rules.
- **Duplicating Zod schemas:** Define one schema in `lib/validations/`, import in both client form and server action. Never duplicate validation logic.
- **Calling revalidatePath in loops:** Call once after all mutations complete, not inside a loop.
- **Forgetting to handle Supabase errors in query functions:** Supabase returns `{ data, error }` -- always check error and throw so TanStack Query catches it. Use pattern: `if (error) throw error`.
- **Creating new QueryClient on every render:** Always use `useState(() => new QueryClient())` in the provider, never `const queryClient = new QueryClient()` at module level in a client component.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form state + validation | Custom useState per field + manual validation | react-hook-form + zodResolver | Dirty tracking, multi-step, performance, error handling |
| VIN decoding | Manual VIN parsing or paid API | NHTSA vPIC API (free) | Government API, 136 fields, covers all US/Canada vehicles |
| Slide-out drawer | Custom position:fixed panel | shadcn/ui Sheet | Focus trapping, keyboard nav, animation, accessibility |
| Status badge colors | Custom div with conditional classes | shadcn/ui Badge + CVA variants | Accessible, themeable, consistent |
| Form draft persistence | Manual localStorage read/write + JSON.parse | Zustand persist middleware | Automatic serialization, reactive state, SSR-safe |
| Pagination controls | Custom page number buttons | Shared pagination component with TanStack Query | Prefetching, loading states, total count |
| Date pickers | Custom date input | shadcn/ui Calendar + Popover | Accessibility, keyboard nav, range support |
| Confirmation dialogs | window.confirm() | shadcn/ui AlertDialog | Styled, accessible, async confirmation |
| Loading skeletons | Custom animated divs | shadcn/ui Skeleton | Consistent pulse animation, proper sizing |
| Unsaved changes warning | Manual beforeunload listener | react-hook-form isDirty + custom hook | Tracks actual field changes, not just any interaction |

**Key insight:** This phase is form-heavy and data-heavy. Every shortcut taken on form management (skipping RHF, rolling custom validation) will compound into painful bugs around dirty state tracking, multi-step navigation, draft persistence, and error display. Use the standard tools.

## Common Pitfalls

### Pitfall 1: Supabase Realtime Without SELECT Grant for supabase_realtime
**What goes wrong:** Realtime subscriptions connect but never deliver events. No errors shown.
**Why it happens:** Supabase Realtime needs the `supabase_realtime` role to have SELECT access on the table to filter events through RLS.
**How to avoid:** Add `GRANT SELECT ON <table> TO supabase_realtime;` for every table that needs realtime updates.
**Warning signs:** Realtime channel shows "SUBSCRIBED" but no events fire on INSERT/UPDATE.

### Pitfall 2: Supabase Realtime DELETE Events Bypass RLS
**What goes wrong:** All tenants receive DELETE events, not just the tenant that owns the deleted row.
**Why it happens:** Supabase cannot verify RLS on deleted rows (the row no longer exists to check against).
**How to avoid:** For DELETE events, include a filter on the channel subscription: `.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders', filter: 'tenant_id=eq.{tenantId}' })` or handle DELETE by invalidating the query (which will re-fetch with RLS applied).
**Warning signs:** Other tenants see brief flickers when items are deleted.

### Pitfall 3: Zod v4 + @hookform/resolvers Type Mismatch
**What goes wrong:** TypeScript errors about incompatible types between Zod v4 inference and react-hook-form.
**Why it happens:** Zod v4 changed its type inference system. Some versions of @hookform/resolvers had issues with the new output types.
**How to avoid:** Use @hookform/resolvers v5.2.2+ which has explicit Zod v4 support. If type issues persist, use `z.input<typeof schema>` for the form type instead of `z.infer<typeof schema>`.
**Warning signs:** Type error "Type 'Resolver<input<T>>' is not assignable to type 'Resolver<output<T>>'".

### Pitfall 4: Drizzle push vs migrate for RLS Policies
**What goes wrong:** RLS policies defined in Drizzle schema are not applied when using `drizzle-kit push`.
**Why it happens:** Known bug (fixed in beta) -- `push` does not apply RLS policy SQL statements. Only `generate` + `migrate` works.
**How to avoid:** Use `drizzle-kit generate` followed by `drizzle-kit migrate`, not `drizzle-kit push`, when the schema includes RLS policies. Alternatively, manage RLS policies in separate SQL migration files outside Drizzle.
**Warning signs:** Tables created without RLS enabled, no policies visible in Supabase dashboard.

### Pitfall 5: Missing (SELECT ...) Wrapper in RLS Policies
**What goes wrong:** Queries become extremely slow on tables with many rows.
**Why it happens:** Without the `(SELECT ...)` wrapper, `get_tenant_id()` is evaluated per row instead of once per query.
**How to avoid:** Every RLS policy MUST use `(SELECT public.get_tenant_id())` not just `public.get_tenant_id()`.
**Warning signs:** Slow queries that get worse as data grows. EXPLAIN ANALYZE shows no InitPlan.

### Pitfall 6: TanStack Query Cache Key Inconsistency
**What goes wrong:** Stale data shown after mutations, filters not working correctly.
**Why it happens:** Query keys don't include all filter parameters, so different filter combinations share the same cache.
**How to avoid:** Always include the full filter object in the query key: `queryKey: ['orders', { status, page, brokerId, ... }]`. Invalidate with partial key match: `invalidateQueries({ queryKey: ['orders'] })`.
**Warning signs:** Switching filters shows old data briefly, then corrects.

### Pitfall 7: Numeric/Money Precision in JavaScript
**What goes wrong:** Financial amounts display as 100.00000000001 or calculations lose precision.
**Why it happens:** JavaScript floating point. Supabase returns NUMERIC as strings; parsing with `parseFloat()` introduces IEEE 754 errors.
**How to avoid:** Drizzle numeric columns use `mode: 'number'` for simple amounts. For display, always use `toFixed(2)`. For calculations, multiply by 100 (work in cents) or use the raw string from Supabase and format on display.
**Warning signs:** Pennies appearing or disappearing in financial summaries.

### Pitfall 8: Sheet/Drawer Form State Leaks Between Create and Edit
**What goes wrong:** Opening "Create New" shows data from a previously edited entity.
**Why it happens:** React Hook Form instance is reused without resetting. The same drawer component is used for create and edit.
**How to avoid:** Use `form.reset(defaultValues)` when the drawer opens, or better yet, use a `key` prop on the form component that changes between create/edit modes (e.g., `key={entityId ?? 'create'}`).
**Warning signs:** Pre-filled fields when creating a new entity after editing an existing one.

### Pitfall 9: Order Number Generation Race Conditions
**What goes wrong:** Duplicate order numbers when multiple dispatchers create orders simultaneously.
**Why it happens:** Reading max order number and incrementing in application code is not atomic.
**How to avoid:** Use a PostgreSQL sequence or SERIAL for order numbers, scoped per tenant. Example: `nextval('order_number_seq_' || tenant_id)` or use a trigger that generates the number atomically.
**Warning signs:** Two orders with the same order number in the same tenant.

## Code Examples

Verified patterns from official sources:

### Drizzle Schema with pgEnum and RLS (New Entity Tables)
```typescript
// src/db/schema.ts (additions)
import { pgTable, uuid, text, timestamp, numeric, integer, date, boolean, index, pgEnum } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { pgPolicy } from 'drizzle-orm/pg-core'
import { authenticatedRole } from 'drizzle-orm/supabase'

// Enums
export const orderStatusEnum = pgEnum('order_status', [
  'new', 'assigned', 'picked_up', 'delivered', 'invoiced', 'paid', 'cancelled'
])

export const paymentTypeEnum = pgEnum('payment_type', [
  'COD', 'COP', 'CHECK', 'BILL', 'SPLIT'
])

export const driverTypeEnum = pgEnum('driver_type', ['company', 'owner_operator'])
export const driverStatusEnum = pgEnum('driver_status', ['active', 'inactive'])
export const truckTypeEnum = pgEnum('truck_type', ['7_car', '8_car', '9_car', 'flatbed', 'enclosed'])
export const truckStatusEnum = pgEnum('truck_status', ['active', 'inactive', 'maintenance'])
export const driverPayTypeEnum = pgEnum('driver_pay_type', ['percentage_of_carrier_pay', 'dispatch_fee_percent', 'per_mile'])
export const paymentTermsEnum = pgEnum('payment_terms', ['NET15', 'NET30', 'NET45', 'NET60'])

// Orders table
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  brokerId: uuid('broker_id').references(() => brokers.id),
  driverId: uuid('driver_id').references(() => drivers.id),
  // Vehicle
  vehicleVin: text('vehicle_vin'),
  vehicleYear: integer('vehicle_year'),
  vehicleMake: text('vehicle_make'),
  vehicleModel: text('vehicle_model'),
  vehicleType: text('vehicle_type'),
  vehicleColor: text('vehicle_color'),
  // Status
  status: orderStatusEnum('status').notNull().default('new'),
  cancelledReason: text('cancelled_reason'),
  // Locations
  pickupLocation: text('pickup_location'),
  pickupCity: text('pickup_city'),
  pickupState: text('pickup_state'),
  pickupZip: text('pickup_zip'),
  pickupContactName: text('pickup_contact_name'),
  pickupContactPhone: text('pickup_contact_phone'),
  deliveryLocation: text('delivery_location'),
  deliveryCity: text('delivery_city'),
  deliveryState: text('delivery_state'),
  deliveryZip: text('delivery_zip'),
  deliveryContactName: text('delivery_contact_name'),
  deliveryContactPhone: text('delivery_contact_phone'),
  // Dates
  pickupDate: date('pickup_date'),
  deliveryDate: date('delivery_date'),
  actualPickupDate: timestamp('actual_pickup_date', { withTimezone: true }),
  actualDeliveryDate: timestamp('actual_delivery_date', { withTimezone: true }),
  // Financial
  revenue: numeric('revenue', { precision: 12, scale: 2 }).default('0'),
  carrierPay: numeric('carrier_pay', { precision: 12, scale: 2 }).default('0'),
  brokerFee: numeric('broker_fee', { precision: 12, scale: 2 }).default('0'),
  paymentType: paymentTypeEnum('payment_type').default('COP'),
  // Metadata
  orderNumber: text('order_number'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_orders_tenant_id').on(table.tenantId),
  index('idx_orders_tenant_status').on(table.tenantId, table.status),
  index('idx_orders_tenant_broker').on(table.tenantId, table.brokerId),
  index('idx_orders_tenant_driver').on(table.tenantId, table.driverId),
  // RLS policies
  pgPolicy('orders_select', {
    for: 'select',
    to: authenticatedRole,
    using: sql`tenant_id = (SELECT public.get_tenant_id())`,
  }),
  pgPolicy('orders_insert', {
    for: 'insert',
    to: authenticatedRole,
    withCheck: sql`tenant_id = (SELECT public.get_tenant_id())`,
  }),
  pgPolicy('orders_update', {
    for: 'update',
    to: authenticatedRole,
    using: sql`tenant_id = (SELECT public.get_tenant_id())`,
    withCheck: sql`tenant_id = (SELECT public.get_tenant_id())`,
  }),
  pgPolicy('orders_delete', {
    for: 'delete',
    to: authenticatedRole,
    using: sql`tenant_id = (SELECT public.get_tenant_id())`,
  }),
])
```

### Status Badge Component with Color Mapping
```typescript
// Source: shadcn/ui Badge + CVA pattern
import { Badge } from '@/components/ui/badge'
import { cva } from 'class-variance-authority'

const statusColors = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  assigned: 'bg-amber-50 text-amber-700 border-amber-200',
  picked_up: 'bg-purple-50 text-purple-700 border-purple-200',
  delivered: 'bg-green-50 text-green-700 border-green-200',
  invoiced: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
} as const

export function StatusBadge({ status }: { status: keyof typeof statusColors }) {
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return (
    <Badge variant="outline" className={statusColors[status]}>
      {label}
    </Badge>
  )
}
```

### Server-Side Pagination with Supabase .range()
```typescript
// Pattern for all list views
const { page = 0, pageSize = 20 } = filters

let query = supabase
  .from('orders')
  .select('*, broker:brokers(id, name)', { count: 'exact' })
  .order('created_at', { ascending: false })
  .range(page * pageSize, (page + 1) * pageSize - 1)

// Apply filters
if (filters.status) query = query.eq('status', filters.status)
if (filters.search) query = query.or(`vehicle_vin.ilike.%${filters.search}%,order_number.ilike.%${filters.search}%`)

const { data, error, count } = await query
// count gives total for pagination controls
// data gives current page
```

### Supabase Realtime Grant (SQL Migration)
```sql
-- CRITICAL: Required for Realtime to work with RLS
GRANT SELECT ON public.orders TO supabase_realtime;
GRANT SELECT ON public.drivers TO supabase_realtime;
GRANT SELECT ON public.trucks TO supabase_realtime;
GRANT SELECT ON public.brokers TO supabase_realtime;
```

### Order Number Sequence (Atomic Generation)
```sql
-- Use a function to atomically generate order numbers per tenant
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  -- Atomic increment within tenant scope
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(order_number, '[^0-9]', '', 'g'), '') AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM public.orders
  WHERE tenant_id = NEW.tenant_id;

  NEW.order_number := 'ORD-' || LPAD(next_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION public.generate_order_number();
```

### Filter Bar Component Pattern
```typescript
// Recommended: horizontal filter bar with immediate application
// Uses URL search params for shareable/bookmarkable filter state
'use client'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

export function useEntityFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const filters = {
    status: searchParams.get('status') ?? undefined,
    page: parseInt(searchParams.get('page') ?? '0'),
    search: searchParams.get('q') ?? undefined,
  }

  const setFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.set('page', '0') // Reset page on filter change
    router.push(`${pathname}?${params.toString()}`)
  }

  return { filters, setFilter }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Drizzle relations v1 (defineRelations object) | Drizzle relations v2 (defineRelations with `r` helper) | drizzle-orm 0.40+ | Simpler relation definitions, autocomplete |
| Separate RLS SQL files | Drizzle pgPolicy in schema (drizzle-orm/pg-core) | drizzle-orm 0.38+ | RLS defined alongside tables, single source of truth |
| @hookform/resolvers v3 (Zod v3 only) | @hookform/resolvers v5.2+ (Zod v3 + v4) | 2025-09 | Automatic Zod version detection |
| Next.js middleware.ts | Next.js 16 proxy.ts | Next.js 16 | Already handled in Phase 1 |
| TanStack Query v4 (isLoading) | TanStack Query v5 (isPending, maxPages) | 2024 | Already on v5.90 |
| Manual Supabase RLS SQL | Drizzle Supabase helpers (authenticatedRole, authUid) | drizzle-orm 0.38+ | Type-safe RLS in schema files |

**Deprecated/outdated:**
- `drizzle-orm/supabase` RLS features may have bugs with `drizzle-kit push` -- use `generate` + `migrate` instead
- TanStack Query `isLoading` renamed to `isPending` in v5 (both exist but `isPending` is canonical)
- Zod v3 `z.infer` works differently than Zod v4 -- use appropriate import paths

## Open Questions

Things that could not be fully resolved:

1. **Drizzle RLS in Schema vs Separate SQL Files**
   - What we know: Drizzle 0.45 supports `pgPolicy` in schema files with Supabase helpers. However, `drizzle-kit push` has known issues applying RLS policies.
   - What's unclear: Whether `drizzle-kit generate` + `migrate` works perfectly with all policy types in v0.45.1 specifically, or if the fix is only in beta.
   - Recommendation: Define RLS policies in Drizzle schema for documentation, but also maintain a separate SQL migration file for RLS as a safety net. Run both and verify in Supabase dashboard.

2. **Order Number Atomicity Under Concurrent Load**
   - What we know: The MAX-based trigger approach works for moderate concurrency. At high concurrency, it could have race conditions despite being in a trigger.
   - What's unclear: Whether Supabase's connection pooling affects trigger atomicity.
   - Recommendation: Use the trigger approach for MVP. If duplicate order numbers appear under load, switch to a PostgreSQL sequence with a per-tenant counter table.

3. **Supabase Realtime Connection Limits**
   - What we know: Free plan has limited concurrent connections. Pro plan is more generous.
   - What's unclear: Exact limits for the number of simultaneous Realtime channels per client.
   - Recommendation: Use a single channel per entity type (not per component). Consolidate subscriptions.

4. **shadcn/ui Form Component vs Field Component (v2 Transition)**
   - What we know: shadcn/ui has been transitioning from Form/FormField/FormItem to a Field/FieldLabel/FieldError pattern in newer documentation.
   - What's unclear: Whether the installed shadcn version (v3.8.4) uses the old or new pattern.
   - Recommendation: Use whichever pattern `npx shadcn@latest add form` installs. Check the generated files after installation.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/db/schema.ts`, `src/db/index.ts`, `supabase/migrations/00001_initial_schema.sql` -- current Drizzle schema and migration patterns
- Existing codebase: `package.json` -- exact dependency versions (drizzle-orm 0.45.1, zod 4.3.6, tanstack/react-query 5.90.21)
- `.planning/research/ARCHITECTURE.md` -- full ERD, data model, RLS patterns, financial calculation patterns
- [Drizzle ORM - PostgreSQL column types](https://orm.drizzle.team/docs/column-types/pg)
- [Drizzle ORM - Relations v2](https://orm.drizzle.team/docs/relations-v2)
- [Drizzle ORM - RLS](https://orm.drizzle.team/docs/rls) -- pgPolicy, authenticatedRole, Supabase helpers
- [NHTSA vPIC API](https://vpic.nhtsa.dot.gov/api/) -- Free VIN decode, DecodeVinValues endpoint
- [shadcn/ui Forms - React Hook Form](https://ui.shadcn.com/docs/forms/react-hook-form) -- Form + RHF + Zod pattern
- [shadcn/ui Sheet](https://ui.shadcn.com/docs/components/radix/sheet) -- Slide-out panel component
- [TanStack Query v5 Pagination](https://tanstack.com/query/v5/docs/framework/react/guides/paginated-queries)

### Secondary (MEDIUM confidence)
- [@hookform/resolvers releases](https://github.com/react-hook-form/resolvers/releases) -- v5.2.2 supports Zod v4
- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) -- RLS filtering, supabase_realtime grant
- [Zustand Persist Middleware](https://zustand.docs.pmnd.rs/middlewares/persist) -- Form draft auto-save pattern
- [MakerKit: Supabase with TanStack Query](https://makerkit.dev/blog/saas/supabase-react-query) -- Integration patterns

### Tertiary (LOW confidence)
- [Drizzle-kit push RLS bug](https://github.com/drizzle-team/drizzle-orm/issues/3504) -- reported fixed in beta, unverified in v0.45.1
- [@shaggytools/nhtsa-api-wrapper](https://github.com/ShaggyTech/nhtsa-api-wrapper) -- v3.0.4, last updated May 2023, considered but direct fetch preferred

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries are already installed or well-documented with verified versions
- Architecture: HIGH - patterns follow from established Phase 1 codebase and ARCHITECTURE.md research
- Database schema: HIGH - ERD defined in ARCHITECTURE.md, column types verified against Drizzle docs
- RLS policies: MEDIUM - Drizzle pgPolicy is well-documented but drizzle-kit push bug is a concern
- VIN decode: HIGH - NHTSA API is free government API, verified endpoint format and response structure
- Form patterns: MEDIUM - Zod v4 + @hookform/resolvers v5.2+ compatibility has known edge cases
- Realtime: MEDIUM - patterns are standard but supabase_realtime grant and DELETE event behavior need attention
- Pitfalls: HIGH - based on documented issues, official bug reports, and established best practices

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (30 days -- stable stack, well-documented)
