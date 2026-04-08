/**
 * Public-portal auth helpers for unauthenticated applicant routes.
 *
 * FIREWALL: This module MUST NOT import from src/lib/authz.ts.
 * It uses a service-role client scoped to each call — never exported as a singleton.
 *
 * Public routes use two separate tokens:
 *   - resumeToken  (72h write window) — used to edit a draft application
 *   - statusToken  (30d read-only)    — used to view status after submission
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { DriverApplication } from '@/types/database'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export function createServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY

  if (!url || !key) {
    throw new Error('public-auth: missing SUPABASE env vars')
  }

  // Instantiated inside function scope — never exported as a module singleton.
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// ---------------------------------------------------------------------------
// Public tenant read helpers
// ---------------------------------------------------------------------------

export type PublicTenantPublicFields = {
  id: string
  name: string
  slug: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  logo_storage_path: string | null
  brand_color_primary: string | null
  brand_color_secondary: string | null
  is_suspended: boolean
}

const PUBLIC_TENANT_SELECT =
  'id, name, slug, address, city, state, zip, logo_storage_path, brand_color_primary, brand_color_secondary, is_suspended'

/**
 * Read only the public-safe tenant fields by slug.
 * Returns null for both nonexistent AND suspended tenants — uniform 404 invariant,
 * no information leakage about whether a tenant exists.
 */
export async function publicReadTenantBySlug(slug: string): Promise<PublicTenantPublicFields | null> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('tenants')
    .select(PUBLIC_TENANT_SELECT)
    .eq('slug', slug)
    .maybeSingle()
  if (!data || data.is_suspended) return null
  return data as PublicTenantPublicFields
}

/**
 * Read only the public-safe tenant fields by id.
 * Returns null for both nonexistent AND suspended tenants — uniform 404 invariant.
 */
export async function publicReadTenantById(id: string): Promise<PublicTenantPublicFields | null> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('tenants')
    .select(PUBLIC_TENANT_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (!data || data.is_suspended) return null
  return data as PublicTenantPublicFields
}

/**
 * Resolve a tenant's logo storage path to a short-lived signed URL.
 *
 * The `branding` bucket is private (see supabase/migrations/00030_branding.sql),
 * so we must mint a signed URL via the service-role client. 1 hour expiry mirrors
 * the existing invoice PDF pattern (src/app/api/invoices/[orderId]/pdf/route.ts).
 *
 * Silent fallback to null on missing path or signing error — a broken logo must
 * never break the public application page.
 */
export async function publicReadTenantLogoUrl(
  logoStoragePath: string | null,
): Promise<string | null> {
  if (!logoStoragePath) return null
  try {
    const supabase = createServiceRoleClient()
    const { data } = await supabase.storage
      .from('branding')
      .createSignedUrl(logoStoragePath, 3600)
    return data?.signedUrl ?? null
  } catch {
    return null
  }
}

export type PublicAuthSuccess = {
  supabase: SupabaseClient
  application: DriverApplication
}

export type PublicAuthError = {
  error: string
}

export type PublicAuthResult = PublicAuthSuccess | PublicAuthError

// ---------------------------------------------------------------------------
// publicAuthForResume
// ---------------------------------------------------------------------------

/**
 * Validate a resumeToken and return the service-role client + application.
 *
 * Blocked if:
 *   - token is not found
 *   - token is expired (resume_token_expires_at < now)
 *   - application status is NOT 'draft' (submitted/approved/etc. cannot be resumed)
 */
export async function publicAuthForResume(token: string): Promise<PublicAuthResult> {
  if (!token || typeof token !== 'string') {
    return { error: 'Invalid token' }
  }

  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('driver_applications')
    .select('*')
    .eq('resume_token', token)
    .single()

  if (error || !data) {
    return { error: 'Invalid or expired token' }
  }

  const application = data as DriverApplication

  // Check token expiry
  if (application.resume_token_expires_at) {
    const expiresAt = new Date(application.resume_token_expires_at)
    if (expiresAt < new Date()) {
      return { error: 'Resume link has expired — please request a new one' }
    }
  }

  // Resume token is only valid for draft applications
  if (application.status !== 'draft') {
    return { error: 'Application is no longer editable' }
  }

  return { supabase, application }
}

// ---------------------------------------------------------------------------
// publicAuthForStatus
// ---------------------------------------------------------------------------

/**
 * Validate a statusToken and return the service-role client + application.
 *
 * Blocked if:
 *   - token is not found
 *   - token is expired (status_token_expires_at < now)
 *   - application status IS 'draft' (status page should not be accessible yet)
 */
export async function publicAuthForStatus(token: string): Promise<PublicAuthResult> {
  if (!token || typeof token !== 'string') {
    return { error: 'Invalid token' }
  }

  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('driver_applications')
    .select('*')
    .eq('status_token', token)
    .single()

  if (error || !data) {
    return { error: 'Invalid or expired token' }
  }

  const application = data as DriverApplication

  // Check token expiry
  if (application.status_token_expires_at) {
    const expiresAt = new Date(application.status_token_expires_at)
    if (expiresAt < new Date()) {
      return { error: 'Status link has expired — please contact the carrier' }
    }
  }

  // Status token is only valid for non-draft applications
  if (application.status === 'draft') {
    return { error: 'Application has not been submitted yet' }
  }

  return { supabase, application }
}

// ---------------------------------------------------------------------------
// publicReadApplication
// ---------------------------------------------------------------------------

/**
 * Unified helper that validates a token by type and returns the application.
 * Use this in (public) route handlers instead of calling supabase directly —
 * direct `from('driver_applications')` is lint-banned in the (public) route group.
 *
 * @param token    - the raw token string from the URL
 * @param tokenType - 'resume' | 'status'
 */
export async function publicReadApplication(
  token: string,
  tokenType: 'resume' | 'status'
): Promise<PublicAuthResult> {
  if (tokenType === 'resume') {
    return publicAuthForResume(token)
  }
  return publicAuthForStatus(token)
}
