# Branded Employment Application — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add full theme customization to the public employment application — banner image, welcome message, footer text, estimated time — so each carrier's application feels branded.

**Architecture:** Extend the existing `tenants` table with 4 new columns. Extend the existing branding Zod schema and `updateBranding()` server action. Add a new welcome/landing page at `/apply/[tenantSlug]/` before the form entry. Extend `publicReadTenantBySlug()` to include new fields.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL + Storage), Drizzle (schema), Zod, Tailwind CSS, CSS variables for brand theming.

---

## Task 1: Database Migration — Add Columns

**Files:**
- Modify: `src/db/schema.ts:72-76` (add after `invoiceFooterText`)
- Create: `supabase/migrations/20260413120000_branded_application_fields.sql`

**Step 1: Add columns to Drizzle schema**

In `src/db/schema.ts`, after line 76 (`invoiceFooterText`), add:

```typescript
appWelcomeMessage: text('app_welcome_message'),
appBannerStoragePath: text('app_banner_storage_path'),
appFooterText: text('app_footer_text'),
appEstimatedTime: varchar('app_estimated_time', { length: 50 }).default('15-20 minutes'),
```

**Step 2: Create SQL migration**

Create `supabase/migrations/20260413120000_branded_application_fields.sql`:

```sql
-- Add branded employment application fields to tenants table
BEGIN;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS app_welcome_message text,
  ADD COLUMN IF NOT EXISTS app_banner_storage_path text,
  ADD COLUMN IF NOT EXISTS app_footer_text text,
  ADD COLUMN IF NOT EXISTS app_estimated_time varchar(50) DEFAULT '15-20 minutes';

COMMIT;
```

**Step 3: Run migration**

Use `postgres` npm driver with `DATABASE_URL_DIRECT` (has `@` in password — parse with regex, not URL constructor). Verify columns exist with `SELECT column_name FROM information_schema.columns WHERE table_name = 'tenants' AND column_name LIKE 'app_%'`.

**Step 4: Commit**

```bash
git add src/db/schema.ts supabase/migrations/20260413120000_branded_application_fields.sql
git commit -m "feat(branding): add application branding columns to tenants table"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/types/database.ts:21-25` (add after `invoice_footer_text`)

**Step 1: Add fields to Tenant interface**

After line 25 (`invoice_footer_text`), add:

```typescript
app_welcome_message: string | null
app_banner_storage_path: string | null
app_footer_text: string | null
app_estimated_time: string | null
```

**Step 2: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(branding): add application branding fields to Tenant type"
```

---

## Task 3: Update Public Tenant Query

**Files:**
- Modify: `src/lib/public-auth.ts:40-55`

**Step 1: Add fields to `PublicTenantPublicFields` type**

After `brand_color_secondary` (line 50), add:

```typescript
app_welcome_message: string | null
app_banner_storage_path: string | null
app_footer_text: string | null
app_estimated_time: string | null
```

**Step 2: Update `PUBLIC_TENANT_SELECT` string**

Extend the select string (line 54-55) to include the new columns:

```typescript
const PUBLIC_TENANT_SELECT =
  'id, name, slug, address, city, state, zip, logo_storage_path, brand_color_primary, brand_color_secondary, is_suspended, app_welcome_message, app_banner_storage_path, app_footer_text, app_estimated_time'
```

**Step 3: Add `publicReadTenantBannerUrl` function**

After `publicReadTenantLogoUrl` (line 111), add a similar function for banner images:

```typescript
export async function publicReadTenantBannerUrl(
  bannerStoragePath: string | null,
): Promise<string | null> {
  if (!bannerStoragePath) return null
  try {
    const supabase = createServiceRoleClient()
    const { data } = await supabase.storage
      .from('branding')
      .createSignedUrl(bannerStoragePath, 3600)
    return data?.signedUrl ?? null
  } catch {
    return null
  }
}
```

**Step 4: Commit**

```bash
git add src/lib/public-auth.ts
git commit -m "feat(branding): include application branding in public tenant query"
```

---

## Task 4: Extend Zod Schema & Server Actions

**Files:**
- Modify: `src/lib/validations/tenant-settings.ts:22-37`
- Modify: `src/app/actions/tenant-settings.ts:69-95` (updateBranding) and after line 178 (new uploadBanner)

**Step 1: Extend brandingSchema**

In `src/lib/validations/tenant-settings.ts`, add fields to `brandingSchema` (after `invoiceFooterText`):

```typescript
appWelcomeMessage: z.string().max(500).optional().or(z.literal('')),
appFooterText: z.string().max(300).optional().or(z.literal('')),
appEstimatedTime: z.string().max(50).optional().or(z.literal('')),
```

**Step 2: Extend updateBranding action**

In `src/app/actions/tenant-settings.ts`, extend the `.update()` call (lines 81-86) to include:

```typescript
app_welcome_message: parsed.data.appWelcomeMessage || null,
app_footer_text: parsed.data.appFooterText || null,
app_estimated_time: parsed.data.appEstimatedTime || null,
```

**Step 3: Add uploadBanner action**

After `deleteLogo()` (line 178), add `uploadBanner()` and `deleteBanner()` following the exact same pattern as `uploadLogo()`/`deleteLogo()` but using `app_banner_storage_path` column and `'banner'` as the file prefix:

```typescript
export async function uploadBanner(formData: FormData) {
  const auth = await authorize('settings.manage', { rateLimit: { key: 'uploadBanner', limit: 10, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const file = formData.get('banner') as File | null
  if (!file || file.size === 0) return { error: 'No file provided.' }

  if (!ALLOWED_LOGO_MIME.has(file.type)) {
    return { error: 'File must be a PNG, JPEG, or WebP image.' }
  }
  if (file.size > MAX_LOGO_SIZE) {
    return { error: 'File too large. Maximum size is 5MB.' }
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('app_banner_storage_path')
    .eq('id', tenantId)
    .single()

  if (tenant?.app_banner_storage_path) {
    await deleteFile(supabase, 'branding', tenant.app_banner_storage_path)
  }

  const { path, error: uploadError } = await uploadFile(supabase, 'branding', tenantId, 'banner', file)
  if (uploadError) return { error: uploadError }

  const { error: updateError } = await supabase
    .from('tenants')
    .update({ app_banner_storage_path: path, updated_at: new Date().toISOString() })
    .eq('id', tenantId)

  if (updateError) {
    await deleteFile(supabase, 'branding', path)
    return { error: safeError(updateError, 'uploadBanner') }
  }

  revalidatePath('/settings')
  revalidatePath('/settings/branding')
  return { success: true, path }
}

export async function deleteBanner() {
  const auth = await authorize('settings.manage', { rateLimit: { key: 'deleteBanner', limit: 10, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { data: tenant } = await supabase
    .from('tenants')
    .select('app_banner_storage_path')
    .eq('id', tenantId)
    .single()

  if (!tenant?.app_banner_storage_path) return { success: true }

  const { error: deleteError } = await deleteFile(supabase, 'branding', tenant.app_banner_storage_path)
  if (deleteError) return { error: safeError({ message: deleteError }, 'deleteBanner') }

  const { error: updateError } = await supabase
    .from('tenants')
    .update({ app_banner_storage_path: null, updated_at: new Date().toISOString() })
    .eq('id', tenantId)

  if (updateError) return { error: safeError(updateError, 'deleteBanner') }

  revalidatePath('/settings')
  revalidatePath('/settings/branding')
  return { success: true }
}
```

**Step 4: Commit**

```bash
git add src/lib/validations/tenant-settings.ts src/app/actions/tenant-settings.ts
git commit -m "feat(branding): extend branding schema + actions for application fields"
```

---

## Task 5: Welcome/Landing Page

**Files:**
- Create: `src/app/(public)/apply/[tenantSlug]/page.tsx` — Welcome landing page
- Create: `src/app/(public)/apply/[tenantSlug]/_components/welcome-page.tsx` — Client component

**Step 1: Create the server page component**

`src/app/(public)/apply/[tenantSlug]/page.tsx`:

This server component loads tenant data (including new branding fields), generates signed URLs for logo and banner, and renders the WelcomePage client component. Pattern matches `resume/page.tsx` exactly:
- Call `publicReadTenantBySlug(tenantSlug)` 
- Call `publicReadTenantLogoUrl()` and `publicReadTenantBannerUrl()`
- Render `<BrandStyle>` + `<WelcomePage>`

**Step 2: Create the WelcomePage client component**

`src/app/(public)/apply/[tenantSlug]/_components/welcome-page.tsx`:

Layout (top to bottom):
1. **Banner hero** — If `bannerUrl` exists, full-width image (300px tall) with gradient overlay fading to `#0C1220`. If no banner, render a gradient using `var(--brand-primary)` → darker shade.
2. **Logo + Company name** — Centered. Logo in a white-background rounded square (same pattern as `tenant-header.tsx` line 36-42). Company name below.
3. **Welcome message** — Tenant's `app_welcome_message` or default: "Thank you for your interest in joining our team. Please complete the application below to get started."
4. **What you'll need** — Static checklist card with items: Valid driver's license (front & back photos), Medical card, Employment history, Social Security Number. Each with a check icon.
5. **Estimated time** — Badge: "Estimated time: {app_estimated_time || '15-20 minutes'}"
6. **CTA button** — `<Link href={/apply/${tenantSlug}/resume}>` styled as large button with `bg-[var(--brand-primary)]` and hover brightness.

Props interface:
```typescript
interface WelcomePageProps {
  tenantSlug: string
  tenantName: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  logoUrl: string | null
  bannerUrl: string | null
  welcomeMessage: string | null
  estimatedTime: string | null
}
```

**Step 3: Commit**

```bash
git add src/app/\(public\)/apply/\[tenantSlug\]/page.tsx src/app/\(public\)/apply/\[tenantSlug\]/_components/welcome-page.tsx
git commit -m "feat(branding): add branded welcome/landing page for employment application"
```

---

## Task 6: Settings > Branding — Application Section

**Files:**
- Modify: `src/app/(dashboard)/settings/branding/page.tsx:17-39` — Pass new props
- Modify: `src/app/(dashboard)/settings/branding/_components/branding-form.tsx` — Add application branding section

**Step 1: Update branding page to pass new fields**

In `page.tsx`, extend the `.select()` query to include `app_welcome_message, app_banner_storage_path, app_footer_text, app_estimated_time`. Generate a signed banner URL. Pass all new fields as props to `<BrandingForm>`.

**Step 2: Add application branding section to form**

In `branding-form.tsx`, after the existing Invoice section, add a new "Employment Application" section with:
- **Banner upload** — Same drag-and-drop pattern as logo upload, calls `uploadBanner()`/`deleteBanner()`. Shows preview if banner exists.
- **Welcome message** — `<Textarea>` bound to form state, max 500 chars, with placeholder showing default text
- **Application footer** — `<Textarea>` bound to form state, max 300 chars
- **Estimated time** — `<Input>` bound to form state, max 50 chars, placeholder "15-20 minutes"

The save button already calls `updateBranding()` which now handles the new fields.

**Step 3: Add mini preview card**

Below the form fields, add a preview card showing a simplified mockup of how the welcome page will look:
- Small banner image (or gradient fallback)
- Logo + company name
- Welcome message text
- CTA button in brand color

This follows the same pattern as the existing invoice preview in the form.

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/settings/branding/
git commit -m "feat(branding): add application branding controls to Settings > Branding"
```

---

## Task 7: Enhanced Form Branding

**Files:**
- Audit: `src/app/(public)/apply/[tenantSlug]/_components/step-indicator.tsx`
- Audit: `src/app/(public)/apply/[tenantSlug]/_components/application-wizard.tsx`
- Audit: `src/app/(public)/apply/[tenantSlug]/_components/signature-box.tsx`
- Audit: All page components (`page1-` through `page8-`)

**Step 1: Audit CSS variable usage**

Search all components for hardcoded colors that should use `var(--brand-primary)` or `var(--brand-secondary)` instead. Focus on:
- Button backgrounds
- Progress bar fills
- Section badge backgrounds
- Legal text left borders
- Focus rings
- Active step indicators

**Step 2: Replace hardcoded colors with CSS variables**

For any instance where a color is hardcoded instead of using the brand variable, swap to `var(--brand-primary, #192334)`. The `BrandStyle` component already injects these variables.

**Step 3: Add footer text**

If the tenant has `app_footer_text`, display it at the bottom of the wizard below the navigation buttons. Pass it through from the form page's server component.

**Step 4: Commit**

```bash
git add src/app/\(public\)/apply/
git commit -m "feat(branding): enhance brand color consistency across application wizard"
```

---

## Task 8: Verify End-to-End

**Step 1: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 2: Build check**

Run: `npm run build`
Expected: Successful build

**Step 3: Visual verification**

Run: `npm run dev` and navigate to:
- `/apply/[tenantSlug]/` — Welcome page renders with fallbacks (no banner configured yet)
- `/settings/branding` — New application section visible with all form fields
- Configure banner + welcome message in settings, verify welcome page updates

**Step 4: Security check**

Verify:
- Banner signed URLs expire correctly
- Welcome message renders as plain text (no HTML injection)
- Zod validates all new fields with length limits
- `authorize('settings.manage')` gates all new actions

**Step 5: Spawn debugger + security-auditor agents**

Per project rules, spawn both agents before committing:
- Debugger: verify end-to-end correctness of new welcome page + settings flow
- Security-auditor: verify `uploadBanner`/`deleteBanner` follow same security pattern as `uploadLogo`/`deleteLogo`, verify public query doesn't expose sensitive fields
