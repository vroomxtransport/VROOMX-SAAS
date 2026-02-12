# Phase 7: Polish & Launch Prep - Research

**Researched:** 2026-02-12
**Domain:** Multi-domain (auth, file upload, CSV import, E2E testing, error handling, SEO, performance, security)
**Confidence:** MEDIUM (mixed domains, some HIGH, some MEDIUM)

## Summary

Phase 7 is a breadth-heavy phase spanning 10 distinct feature requirements plus extensive polish/infrastructure work (error boundaries, loading states, SEO pages, E2E tests, performance audit, security audit). Unlike prior phases that built deep vertical slices, this phase is about completing the final P1/P2 features, hardening the application, and making it production-ready.

The codebase is mature (42/43 plans complete across 6 phases) with well-established patterns: Server Actions with Zod validation, TanStack Query hooks, Supabase RLS for multi-tenancy, shadcn/ui components, and a consistent file organization. Phase 7 should follow these patterns strictly rather than introducing new architectural approaches.

**Primary recommendation:** Organize this phase into logical plan groups: (1) DB migration + document upload infrastructure, (2) remaining feature requirements (magic link, CSV import, attachments, driver earnings, trailer assignment), (3) sample data seeding + in-app help, (4) error boundaries + loading states + 404/error pages, (5) SEO/marketing pages, (6) E2E tests with Playwright, (7) performance + security audit + production deployment.

## Requirement Status Analysis

Before planning, several requirements need clarification on what's already done:

| Requirement | Already Built? | What Remains |
|-------------|---------------|--------------|
| TRIP-7 (Trip expense tracking) | YES - Full CRUD in Phase 3 Plan 05 | Verify completeness; nothing to build |
| AUTH-8 (Magic link login) | NO - Login page is email/password only | Add `signInWithOtp` flow to login page |
| ORD-7 (CSV order import) | NO | Full feature: upload, parse, map, validate, import |
| ORD-8 (Order attachments) | PARTIAL - `order_attachments` table + RLS exist in migration 00006; iOS app has FileManagementGrid | Web dashboard upload/display UI needed |
| DRV-5 (Driver earnings view) | NO on web - iOS app has EarningsView (Plan 06-11) | Web dashboard driver earnings page/section |
| DRV-6 (Driver document uploads) | NO | New storage bucket + upload UI on driver detail page |
| FLT-4 (Trailer assignment) | NO - No `trailers` table exists | DB schema + CRUD + truck-trailer linking |
| FLT-5 (Truck document uploads) | NO | New storage bucket + upload UI on truck detail page |
| ONB-3 (Sample data seeding) | NO | Server action to seed demo data for trial accounts |
| ONB-4 (In-app help tooltips) | NO - Tooltip component exists (shadcn/ui) | Help content + contextual placement across pages |

## Standard Stack

### Core (Already In Project)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Next.js | 16.1.6 | App Router, Server Actions, SSR/SSG | Installed |
| Supabase JS | 2.95.3 | Auth (signInWithOtp), Storage, DB, Realtime | Installed |
| @supabase/ssr | 0.8.0 | Server-side Supabase client | Installed |
| Playwright | 1.58.2 | E2E testing | In devDeps, no config yet |
| Vitest | 4.0.18 | Unit tests | In devDeps, config exists |
| shadcn/ui (radix-ui) | 1.4.3 | UI components (Tooltip already installed) | Installed |
| Sonner | 2.0.7 | Toast notifications | Installed |
| @react-pdf/renderer | 4.3.2 | PDF generation (invoices, BOLs) | Installed |
| Sentry | 10.38.0 | Error monitoring | Installed |
| PostHog | 1.345.5 | Analytics | Installed |

### New Dependencies Needed

| Library | Purpose | Why Standard |
|---------|---------|-------------|
| papaparse | CSV parsing in browser | 50k+ weekly downloads, handles edge cases (quotes, delimiters, malformed rows), streaming for large files, no deps |
| @types/papaparse | TypeScript types | Required for TS compilation |

**Installation:**
```bash
npm install papaparse @types/papaparse
```

### Already Available (No New Deps)

| Capability | How | Notes |
|------------|-----|-------|
| Magic link auth | `supabase.auth.signInWithOtp()` | Built into @supabase/supabase-js |
| File uploads | `supabase.storage.from(bucket).upload()` | Built into @supabase/supabase-js |
| Skeleton screens | `<Skeleton>` from shadcn/ui | Already in `src/components/ui/skeleton.tsx` |
| Tooltips | `<Tooltip>` from shadcn/ui | Already in `src/components/ui/tooltip.tsx` |
| Error boundaries | `error.tsx`, `global-error.tsx`, `not-found.tsx` | Next.js App Router file conventions |
| Loading states | `loading.tsx` | Next.js App Router file convention |
| SEO metadata | `export const metadata` / `generateMetadata()` | Next.js built-in Metadata API |
| E2E testing | Playwright | Already in devDeps |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| papaparse | csv-parse/sync | papaparse runs in browser + Node; csv-parse is Node-only. Client-side parsing lets user preview before import. |
| react-loading-skeleton | shadcn/ui Skeleton | shadcn/ui Skeleton already installed and used throughout codebase. No new dep needed. |
| react-dropzone | native `<input type="file">` | react-dropzone adds drag-and-drop UX but is another dep. Start with native input, add later if needed. |

## Architecture Patterns

### Recommended Project Structure Additions

```
src/
  app/
    (auth)/
      login/page.tsx          # ADD: magic link tab/option
    (dashboard)/
      drivers/[id]/
        _components/
          driver-earnings.tsx  # NEW: trip-by-trip pay breakdown
          driver-documents.tsx # NEW: CDL/medical card uploads
      trucks/[id]/
        _components/
          truck-documents.tsx  # NEW: registration/insurance uploads
          trailer-assignment.tsx # NEW: pair truck with trailer
      orders/
        _components/
          order-attachments.tsx # NEW: photo/document uploads
          csv-import-dialog.tsx # NEW: CSV import wizard
      error.tsx                # NEW: dashboard error boundary
      loading.tsx              # NEW: dashboard loading skeleton
    (marketing)/               # NEW: landing, pricing, SEO pages
      layout.tsx               # Marketing layout (no auth required)
      page.tsx                 # Landing page
      pricing/page.tsx         # Pricing page
    not-found.tsx              # NEW: global 404
    error.tsx                  # NEW: root error boundary
    global-error.tsx           # NEW: root layout error boundary
  lib/
    storage.ts                 # NEW: tenant-scoped upload helpers
    seed-data.ts               # NEW: sample data generation
  e2e/                         # NEW: Playwright test directory
    signup-dashboard.spec.ts
    dispatch-flow.spec.ts
    stripe-billing.spec.ts
```

### Pattern 1: Tenant-Scoped File Upload

**What:** All file uploads must be scoped to tenant_id to prevent cross-tenant file access.
**When to use:** Every file upload in the application (documents, attachments, photos).

```typescript
// src/lib/storage.ts
// Tenant-scoped upload helper
export async function uploadFile(
  supabase: SupabaseClient,
  bucket: string,
  tenantId: string,
  file: File,
  subfolder?: string
): Promise<{ path: string; error: string | null }> {
  const ext = file.name.split('.').pop()
  const fileName = `${crypto.randomUUID()}.${ext}`
  const storagePath = subfolder
    ? `${tenantId}/${subfolder}/${fileName}`
    : `${tenantId}/${fileName}`

  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) return { path: '', error: error.message }
  return { path: storagePath, error: null }
}
```

**Storage path convention (matches existing iOS patterns):**
- Driver documents: `driver-documents/{tenantId}/{driverId}/{uuid}.{ext}`
- Truck documents: `truck-documents/{tenantId}/{truckId}/{uuid}.{ext}`
- Order attachments: `order-attachments/{tenantId}/{orderId}/{uuid}.{ext}`
- Existing buckets: `inspection-media`, `receipts`, `bol-documents`

### Pattern 2: CSV Import with Column Mapping

**What:** Multi-step CSV import wizard: upload -> preview -> map columns -> validate -> import.
**When to use:** ORD-7 bulk order import.

```typescript
// Client-side parsing with papaparse
import Papa from 'papaparse'

function parseCSV(file: File): Promise<Papa.ParseResult<Record<string, string>>> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: resolve,
      error: reject,
    })
  })
}

// Column mapping UI lets user map CSV headers to order fields
// Validation runs client-side before sending to server action
// Server action creates orders in batch with Zod validation per row
```

### Pattern 3: Magic Link Login (Supabase OTP)

**What:** Passwordless login option using Supabase's built-in `signInWithOtp`.
**When to use:** AUTH-8 magic link login.

```typescript
// Server Action
export async function magicLinkAction(prevState: any, formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth-confirm`,
    },
  })

  if (error) return { error: error.message }
  return { success: true, message: 'Check your email for the login link' }
}
```

**Key details from Supabase docs:**
- `signInWithOtp` sends a Magic Link email by default (not OTP code)
- Rate limited to 1 request per 60 seconds per email
- Link expires after 1 hour
- If user doesn't exist, it creates a new account (may need to handle this)
- Redirect URL must be in the allowed list in Supabase dashboard
- The existing `/auth-confirm` route already handles the PKCE/OTP callback flow

### Pattern 4: Error Boundary Hierarchy

**What:** Layered error handling with Next.js App Router file conventions.
**When to use:** Every route group.

```
app/
  global-error.tsx         # Catches root layout errors, must have <html>/<body>
  error.tsx                # Catches errors in root page (not layout)
  not-found.tsx            # Global 404 page
  (dashboard)/
    error.tsx              # Catches all dashboard route errors
    loading.tsx            # Dashboard-wide loading skeleton
  (auth)/
    error.tsx              # Auth page errors
  (marketing)/
    error.tsx              # Marketing page errors
```

**Critical rule:** `error.tsx` must be a `'use client'` component. It receives `error` and `reset` props.

### Pattern 5: Playwright E2E Test Structure

**What:** Page Object Model with test fixtures for authenticated/unauthenticated flows.
**When to use:** All E2E tests.

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run build && npm run start',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
})
```

### Pattern 6: Driver Earnings View (Web Dashboard)

**What:** Trip-by-trip pay breakdown for a specific driver, reusing existing trip query infrastructure.
**When to use:** DRV-5 driver earnings view on web dashboard.

```typescript
// Query trips filtered by driver_id with completed status
// Reuse fetchTrips from src/lib/queries/trips.ts with driverId filter
// Display: trip date range, order count, total revenue, driver pay, expenses
// Summary card: total earnings, total trips, average per trip
```

The iOS app (Plan 06-11) already has this pattern. The web version shows the same data but in a table format on the driver detail page, replacing the current "Earnings Summary" placeholder.

### Anti-Patterns to Avoid

- **Separate storage buckets per tenant:** Use a single bucket with tenant-scoped paths (`{tenantId}/{...}`). Multiple buckets don't scale and complicate RLS.
- **Server-side CSV parsing:** Parse CSV on the client with papaparse for preview/mapping UI. Only send validated rows to server actions.
- **Custom error boundary components:** Use Next.js file conventions (`error.tsx`, `not-found.tsx`, `global-error.tsx`) instead of React `ErrorBoundary` wrappers.
- **Inline loading states everywhere:** Use `loading.tsx` for route-level and `<Suspense>` with Skeleton for component-level. Don't add manual `isLoading` checks where App Router can handle it.
- **Testing against dev server:** Playwright should test against production build (`next build && next start`) for realistic behavior.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Custom CSV string parser | papaparse | Handles quoted fields, delimiters, encoding, streaming, malformed rows |
| Magic link email | Custom email + token flow | `supabase.auth.signInWithOtp()` | Built into Supabase Auth, handles token generation, expiry, rate limiting |
| File upload with progress | Custom XHR upload | `supabase.storage.from().upload()` | Handles auth headers, retry, content-type detection |
| Skeleton screens | Custom pulsing divs | shadcn/ui `<Skeleton>` component | Already styled, consistent with design system |
| Error boundaries | Custom React ErrorBoundary class | Next.js `error.tsx` file convention | Auto-wired by framework, supports `reset()`, proper nesting |
| 404 pages | Custom catch-all routes | Next.js `not-found.tsx` + `notFound()` function | Framework-native, works with ISR/SSR |
| OG images | Custom canvas rendering | Next.js `opengraph-image.tsx` file convention | Auto-generated, cached, proper dimensions |
| Tooltips | Custom hover popups | shadcn/ui `<Tooltip>` (already installed) | Accessible, positioned, animated, consistent |
| Performance measurement | Custom timing code | `useReportWebVitals` + Lighthouse | Standard metrics, comparable benchmarks |

**Key insight:** Phase 7 is about polish, not invention. Every feature has an established solution in the existing stack. The risk is over-engineering solutions for problems that are already solved.

## Common Pitfalls

### Pitfall 1: Storage Bucket RLS Not Configured

**What goes wrong:** Files are uploaded but unaccessible, or accessible to wrong tenants.
**Why it happens:** Supabase Storage requires explicit RLS policies on the `storage.objects` table. Creating a bucket does not auto-create policies.
**How to avoid:** Create Storage RLS policies that check `(storage.foldername(name))[1] = (SELECT public.get_tenant_id()::text)` to ensure tenant isolation at the folder level. Test cross-tenant file access explicitly.
**Warning signs:** "new row violates RLS policy" errors on upload, or files visible across tenants.

### Pitfall 2: Magic Link Creates New Users Unexpectedly

**What goes wrong:** `signInWithOtp` creates a new user when the email doesn't exist, leading to users without tenants.
**Why it happens:** Supabase's default behavior is to auto-signup on OTP if user doesn't exist.
**How to avoid:** Either (a) set `shouldCreateUser: false` in the options to only allow existing users, or (b) handle the post-auth redirect to check for tenant membership and redirect to signup if missing.
**Warning signs:** Users in auth.users with no tenant_id in app_metadata.

### Pitfall 3: CSV Import Fails Silently on Large Files

**What goes wrong:** Browser tab freezes or import appears to succeed but rows are missing.
**Why it happens:** Processing thousands of rows synchronously blocks the main thread. Server actions have body size limits.
**How to avoid:** Use papaparse streaming for files > 1MB. Batch server action calls (e.g., 50 rows per batch). Show progress indicator. Validate row count before and after import.
**Warning signs:** No progress indicator during import, no row count validation.

### Pitfall 4: Error Boundaries Don't Catch Async Errors

**What goes wrong:** Server Action errors or async event handler errors aren't caught by `error.tsx`.
**Why it happens:** React error boundaries only catch errors during rendering. Server Action errors, event handlers, and setTimeout errors are not caught.
**How to avoid:** Use try/catch in Server Actions (already done in codebase). Use `toast.error()` for user-facing error messages from actions. `error.tsx` is for unexpected rendering crashes.
**Warning signs:** Errors in console with no user-visible feedback.

### Pitfall 5: Playwright Tests Flaky Due to Async Operations

**What goes wrong:** Tests pass locally but fail in CI, or fail intermittently.
**Why it happens:** Race conditions from: Supabase real-time updates, Stripe webhook processing, page navigation timing.
**How to avoid:** Use Playwright's `waitForResponse`, `waitForURL`, `expect(locator).toBeVisible()` with auto-waiting. Never use fixed `sleep()` delays. For Stripe, use test mode with `4242424242424242` card and wait for redirect.
**Warning signs:** `setTimeout` or `page.waitForTimeout()` in test code.

### Pitfall 6: SEO Pages Block Dashboard Performance

**What goes wrong:** Marketing page assets (large images, animations) load for dashboard users.
**Why it happens:** Sharing a root layout between marketing and dashboard routes.
**How to avoid:** Use separate route groups: `(marketing)` and `(dashboard)` with different layouts. Marketing layout has no auth checks, no sidebar, no dashboard CSS.
**Warning signs:** Dashboard Lighthouse score drops after adding marketing pages.

### Pitfall 7: Trailer Schema Over-Engineering

**What goes wrong:** Complex trailer management system with maintenance tracking, inspection history, etc.
**Why it happens:** Scope creep on FLT-4 which only requires "optional truck-trailer linking."
**How to avoid:** FLT-4 is explicitly "Optional truck-trailer linking." Implement as: `trailers` table (id, tenant_id, trailer_number, trailer_type, status) + `trailer_id` nullable FK on trucks. No separate CRUD page needed in v1 -- a select dropdown on the truck form/detail is sufficient.
**Warning signs:** Creating separate trailer list/detail/form pages when the requirement is just linking.

### Pitfall 8: Sample Data Seeding Creates Invalid State

**What goes wrong:** Seeded data doesn't pass validation, has broken relationships, or conflicts with real data later.
**Why it happens:** Seed scripts bypass validation logic, hardcode IDs, don't respect foreign key constraints.
**How to avoid:** Use the same server actions (or their underlying logic) that the UI uses. Generate UUIDs dynamically. Create entities in dependency order: broker -> driver -> truck -> order -> trip. Provide a "clear sample data" option.
**Warning signs:** Seeded orders without valid broker/driver references, financial calculations that don't add up.

## Code Examples

### Supabase Magic Link Server Action

```typescript
// Source: Supabase official docs - signInWithOtp
'use server'
import { createClient } from '@/lib/supabase/server'

export async function magicLinkAction(prevState: any, formData: FormData) {
  const email = formData.get('email') as string
  if (!email) return { error: 'Email is required' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false, // Only allow existing users
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth-confirm`,
    },
  })

  if (error) return { error: error.message }
  return { success: true }
}
```

### File Upload Component Pattern

```typescript
// Source: Supabase Storage docs + existing codebase patterns
'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Upload, X, FileText } from 'lucide-react'

interface FileUploadProps {
  bucket: string
  tenantId: string
  entityId: string // driver_id, truck_id, or order_id
  onUploadComplete: (path: string, fileName: string) => void
  accept?: string // e.g., '.pdf,.jpg,.png'
  maxSizeMB?: number
}

export function FileUpload({
  bucket, tenantId, entityId, onUploadComplete, accept, maxSizeMB = 10
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > maxSizeMB * 1024 * 1024) {
      // Show error toast
      return
    }

    setUploading(true)
    const supabase = createBrowserClient()
    const ext = file.name.split('.').pop()
    const storagePath = `${tenantId}/${entityId}/${crypto.randomUUID()}.${ext}`

    const { error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, file)

    setUploading(false)
    if (error) {
      // Show error toast
      return
    }
    onUploadComplete(storagePath, file.name)
  }

  return (
    <div>
      <input
        type="file"
        accept={accept}
        onChange={handleUpload}
        disabled={uploading}
        className="hidden"
        id="file-upload"
      />
      <label htmlFor="file-upload">
        <Button variant="outline" asChild disabled={uploading}>
          <span>
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? 'Uploading...' : 'Upload File'}
          </span>
        </Button>
      </label>
    </div>
  )
}
```

### CSV Import with PapaParse

```typescript
// Source: PapaParse official docs
import Papa from 'papaparse'

interface CSVImportResult {
  data: Record<string, string>[]
  headers: string[]
  errors: Papa.ParseError[]
  rowCount: number
}

export function parseCSVFile(file: File): Promise<CSVImportResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve({
          data: results.data as Record<string, string>[],
          headers: results.meta.fields ?? [],
          errors: results.errors,
          rowCount: results.data.length,
        })
      },
      error: reject,
    })
  })
}

// Column mapping: user maps CSV headers to order fields
const ORDER_IMPORT_FIELDS = [
  { key: 'vehicle_vin', label: 'VIN', required: false },
  { key: 'vehicle_year', label: 'Year', required: false },
  { key: 'vehicle_make', label: 'Make', required: false },
  { key: 'vehicle_model', label: 'Model', required: false },
  { key: 'pickup_city', label: 'Pickup City', required: true },
  { key: 'pickup_state', label: 'Pickup State', required: true },
  { key: 'delivery_city', label: 'Delivery City', required: true },
  { key: 'delivery_state', label: 'Delivery State', required: true },
  { key: 'revenue', label: 'Revenue', required: false },
  { key: 'carrier_pay', label: 'Carrier Pay', required: false },
  // ... etc
]
```

### Next.js Error Boundary

```typescript
// Source: Next.js official docs
// app/(dashboard)/error.tsx
'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to Sentry
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
      <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
      <h2 className="text-xl font-semibold text-gray-900">Something went wrong</h2>
      <p className="mt-2 text-sm text-gray-500 max-w-md">
        An unexpected error occurred. Please try again or contact support if the problem persists.
      </p>
      <Button onClick={reset} className="mt-6">
        Try again
      </Button>
    </div>
  )
}
```

### Playwright Test Example

```typescript
// Source: Playwright + Next.js official docs
// e2e/signup-dashboard.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Signup to Dashboard', () => {
  test('new user can sign up and see dashboard', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByText('Create your account')).toBeVisible()

    // Fill form
    await page.getByLabel('Full Name').fill('Test User')
    await page.getByLabel('Email').fill(`test-${Date.now()}@example.com`)
    await page.getByLabel('Password').fill('TestPassword123!')
    await page.getByLabel('Company Name').fill('Test Carrier LLC')

    // Select plan
    await page.getByText('Starter').click()

    // Submit
    await page.getByRole('button', { name: 'Create account' }).click()

    // Wait for Stripe Checkout redirect
    await page.waitForURL(/checkout.stripe.com/, { timeout: 10000 })

    // In Stripe test mode, use test card
    // ... (Stripe Checkout page interaction)
  })
})
```

### Supabase Storage RLS Policy for Tenant Isolation

```sql
-- Storage RLS for tenant-scoped file access
-- Apply to each storage bucket
CREATE POLICY "tenant_storage_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND (storage.foldername(name))[1] = (SELECT public.get_tenant_id()::text)
);

CREATE POLICY "tenant_storage_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'driver-documents'
  AND (storage.foldername(name))[1] = (SELECT public.get_tenant_id()::text)
);

CREATE POLICY "tenant_storage_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND (storage.foldername(name))[1] = (SELECT public.get_tenant_id()::text)
);
```

## Database Schema Additions

### Trailers Table (FLT-4)

```sql
CREATE TABLE public.trailers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  trailer_number TEXT NOT NULL,
  trailer_type TEXT NOT NULL DEFAULT 'open', -- open, enclosed, flatbed
  status TEXT NOT NULL DEFAULT 'active', -- active, inactive, maintenance
  year INTEGER,
  make TEXT,
  model TEXT,
  vin TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add trailer_id to trucks (optional linking)
ALTER TABLE public.trucks ADD COLUMN trailer_id UUID REFERENCES public.trailers(id);
```

### Driver Documents Table (DRV-6)

```sql
CREATE TABLE public.driver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- 'cdl', 'medical_card', 'mvr', 'other'
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INTEGER,
  expires_at DATE, -- Document expiry tracking
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Truck Documents Table (FLT-5)

```sql
CREATE TABLE public.truck_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  truck_id UUID NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- 'registration', 'insurance', 'inspection', 'other'
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INTEGER,
  expires_at DATE, -- Document expiry tracking
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Storage Buckets Needed

| Bucket | Purpose | Existing? |
|--------|---------|-----------|
| `inspection-media` | Vehicle inspection photos/videos | YES (from Phase 6) |
| `receipts` | Trip expense receipts | YES (from Phase 6) |
| `bol-documents` | Bill of lading PDFs | YES (from Phase 6) |
| `driver-documents` | CDL, medical cards, MVR | NEW - must create |
| `truck-documents` | Registration, insurance | NEW - must create |
| `order-attachments` | Rate confirmations, photos | NEW - must create (table exists, bucket does not) |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom React ErrorBoundary class | Next.js `error.tsx` file convention | Next.js 13+ (App Router) | Framework handles error boundary wiring |
| `getSession()` for auth checks | `getUser()` for server-side validation | Supabase SSR best practice | Prevents token spoofing |
| Middleware for auth redirects | `proxy.ts` in Next.js 16 | Next.js 16 | Replaces `middleware.ts` |
| `next-seo` package | Built-in `metadata` export / `generateMetadata()` | Next.js 13+ | No extra dependency |
| Custom OG image generation | `opengraph-image.tsx` file convention | Next.js 13+ | Auto-generated, cached |
| Core Web Vitals FID metric | INP (Interaction to Next Paint) | March 2024 | FID replaced by INP as CWV metric |

**Important:** The success criteria mentions "FID < 100ms" but FID was replaced by INP (Interaction to Next Paint) in March 2024. The correct target is INP < 200ms. LCP < 2.5s and CLS < 0.1 remain correct.

## Security Audit Checklist

Items to verify during the security audit:

| Area | What to Check | How |
|------|---------------|-----|
| RLS Coverage | Every table has SELECT/INSERT/UPDATE/DELETE policies | Query `pg_policies` system table |
| No Exposed Keys | `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY` not in client code | Grep for `sk_`, `sb_secret_` in src/ |
| Webhook Signatures | Stripe webhook verifies `stripe-signature` header | Check `/api/webhooks/stripe/route.ts` |
| CSRF Protection | Server Actions use Next.js built-in CSRF tokens | Default in Next.js 14+ |
| Auth Checks | All server actions verify `getUser()` before DB operations | Review each action in `src/app/actions/` |
| Storage RLS | Storage buckets have tenant-scoped policies | Check `storage.objects` policies |
| Environment Variables | No secrets in `NEXT_PUBLIC_*` variables | Review `.env.local.example` |
| Cross-Tenant Tests | User A cannot see User B's data | Automated test with 2 separate sessions |

## Performance Audit Checklist

| Metric | Target | How to Measure | How to Improve |
|--------|--------|----------------|----------------|
| LCP | < 2.5s | Lighthouse, `useReportWebVitals` | `next/image` with priority, font preload, server components |
| INP | < 200ms | Lighthouse, CrUX | Minimize client-side JS, use `startTransition` for non-urgent updates |
| CLS | < 0.1 | Lighthouse | Set explicit dimensions on images/skeletons, avoid layout shifts |
| Bundle Size | Minimize | `@next/bundle-analyzer` | Dynamic imports, tree shaking, remove unused deps |
| TTFB | < 800ms | Lighthouse | Edge deployment (Vercel), DB connection pooling |

## Open Questions

1. **Stripe Checkout E2E Test Feasibility**
   - What we know: Stripe test mode allows card `4242424242424242`. Playwright can interact with Stripe Checkout pages.
   - What's unclear: Whether Stripe's test Checkout page structure is stable enough for reliable E2E tests. Stripe may change their Checkout UI.
   - Recommendation: Write the test but mark it as potentially flaky. Consider using Stripe's `return_url` with a mock success page instead of interacting with Stripe's Checkout UI directly.

2. **Sample Data Volume and Shape**
   - What we know: ONB-3 requires "pre-populated demo data to try features."
   - What's unclear: Exact volume and what data to seed.
   - Recommendation: Seed a realistic small fleet: 2 brokers, 3 drivers (2 company, 1 owner-operator), 2 trucks, 1 trailer, 8-10 orders across various statuses, 2 trips (1 completed, 1 in-progress), some payments. Enough to demonstrate all features without overwhelming.

3. **Trailer CRUD Scope**
   - What we know: FLT-4 says "Optional truck-trailer linking."
   - What's unclear: Whether trailers need their own list/detail pages or just a linking mechanism.
   - Recommendation: Minimal approach -- trailers table + inline management on truck detail page (add/remove trailer via dropdown). No separate /trailers route in v1.

4. **In-App Help Content**
   - What we know: ONB-4 says "Contextual help for new users" with tooltips.
   - What's unclear: What specific workflows need tooltips and what the content should say.
   - Recommendation: Add help tooltips to: (a) dispatch board (how to create/manage trips), (b) order creation (what each field means), (c) billing page (aging analysis explanation), (d) settings page (team invites, plan management). Use shadcn/ui Tooltip with a `<HelpCircle>` icon trigger.

5. **Production Deployment Configuration**
   - What we know: Vercel for frontend, Supabase Pro for backend.
   - What's unclear: Whether Supabase project is already on Pro plan, whether Vercel project exists.
   - Recommendation: Document the deployment steps but don't assume infrastructure exists. Include environment variable checklist.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: 42 completed plans, 6 migrations, full src/ tree examined
- Next.js App Router docs: error.tsx, not-found.tsx, global-error.tsx, loading.tsx, metadata API
- Supabase Auth docs: signInWithOtp for magic links
- Supabase Storage docs: bucket RLS, tenant-scoped paths
- Playwright official docs: config, webServer, E2E patterns

### Secondary (MEDIUM confidence)
- PapaParse docs: CSV parsing API, streaming, error handling
- Web search results: Core Web Vitals 2026 (INP replaced FID), Playwright + Stripe testing patterns
- Supabase Storage RLS patterns: `storage.foldername(name)` for path-based tenant isolation

### Tertiary (LOW confidence)
- Stripe Checkout E2E stability: Based on community reports, may be fragile
- Exact react-loading-skeleton version: Project uses shadcn/ui Skeleton instead, so moot

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project or well-established (papaparse only new dep)
- Architecture: HIGH - follows 42 plans of established patterns in this codebase
- Pitfalls: MEDIUM - based on docs + common patterns, some from community reports
- E2E testing: MEDIUM - Playwright setup is standard but Stripe Checkout testing is inherently complex
- Security audit: HIGH - RLS pattern is consistent across all 6 migrations
- Performance audit: MEDIUM - metrics and tools are standard but optimization depends on actual measurements

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (30 days - stable domain, established stack)
