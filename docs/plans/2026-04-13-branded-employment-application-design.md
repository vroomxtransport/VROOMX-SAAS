# Branded Employment Application — Design Doc

**Date:** 2026-04-13
**Status:** Approved

## Problem

Tenants (vehicle carriers) need their employment application to feel like it belongs to their brand. Currently, the `/apply/[tenantSlug]/` application uses tenant colors and logo in the header but otherwise looks the same for every tenant. Carriers want a professional, branded first impression for driver applicants.

## Scope

- Full theme customization: colors + logo + custom welcome message + banner image + custom footer text
- Branded welcome/landing page before the form wizard
- Enhanced brand color usage throughout the 8-page wizard
- Settings configuration in existing Settings > Branding page

## Data Model

Add 4 columns to `tenants` table:

| Column | Type | Default | Purpose |
|---|---|---|---|
| `app_welcome_message` | `text` | `null` | Custom welcome text on landing page |
| `app_banner_storage_path` | `text` | `null` | Banner image path in `branding` bucket |
| `app_footer_text` | `text` | `null` | Custom footer on the application |
| `app_estimated_time` | `varchar(50)` | `'15-20 minutes'` | Estimated completion time |

No new tables or RLS policies. Inherits existing `tenants` row access.

## Welcome/Landing Page

New page at `/apply/[tenantSlug]/` — sits before the resume/form entry:

1. **Banner image** — Full-width hero, ~300px height, gradient overlay (bottom fade). Falls back to brand-color gradient if no banner uploaded
2. **Company logo + name** — Centered below/overlapping banner, signed URL for logo
3. **Welcome message** — Custom text or default: "Thank you for your interest in joining our team."
4. **What you'll need** — Checklist: driver's license, medical card, employment history, SSN
5. **Estimated time** — Badge with configured time
6. **"Start Application" CTA** — Large button in `--brand-primary`

**Fallbacks:** No banner = brand-color gradient. No welcome message = default text. No logo = company name only. Always looks polished with zero customization.

## Enhanced Form Branding

Deeper brand color application across the existing 8-page wizard:

- Step indicator pills: active step uses `--brand-primary`
- Progress bar fill: `--brand-primary`
- Section number badges: `--brand-primary` background
- Legal text left borders: `--brand-primary`
- All action buttons: `--brand-primary` with hover brightness
- Signature focus rings: `--brand-primary`
- Footer: custom footer text if configured

No structural changes to the wizard — only ensuring consistent CSS variable usage.

## Settings > Branding Extension

New "Employment Application" section in existing branding page:

- **Banner Image** — Drag-and-drop upload (PNG, JPEG, WebP, max 5MB), preview
- **Welcome Message** — Textarea, max 500 chars
- **Footer Text** — Textarea, max 300 chars
- **Estimated Time** — Text input, max 50 chars, default "15-20 minutes"
- **Live Preview** — Mini card showing welcome page appearance

Server actions: extend `updateBranding()` for new fields, new `uploadBanner()` action.

## Security

- Banner images in `branding` bucket with tenant-scoped paths (`{tenant_id}/banner.*`)
- Signed URLs for banners (1-hour expiry, same as logo)
- Welcome/footer text rendered as plain text (no HTML)
- All fields validated with Zod (string length limits)
- Public read actions already handle tenant data safely

## Files to Modify

- `src/db/schema.ts` — Add 4 columns to tenants table
- `supabase/migrations/` — New migration for columns
- `src/types/database.ts` — Update Tenant interface
- `src/app/(public)/apply/[tenantSlug]/` — New welcome page
- `src/app/(public)/apply/[tenantSlug]/_components/` — Welcome page components
- `src/app/(public)/apply/[tenantSlug]/_components/brand-style.tsx` — Ensure consistent var usage
- `src/app/(dashboard)/settings/branding/` — Add application branding section
- `src/app/actions/tenants.ts` or `branding.ts` — Extend update + add banner upload
- `src/lib/validations/` — Zod schemas for new fields
- `src/lib/queries/` — Update public tenant read to include new columns
