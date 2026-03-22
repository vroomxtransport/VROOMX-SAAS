'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminAuthContext {
  /** Service-role client — bypasses RLS for cross-tenant admin queries */
  supabase: SupabaseClient
  user: { id: string; email: string }
}

export type AdminAuthResult =
  | { ok: true; ctx: AdminAuthContext }
  | { ok: false; error: string }

// ---------------------------------------------------------------------------
// Admin authorization
// ---------------------------------------------------------------------------

/**
 * Verify the current session belongs to a platform admin.
 *
 * Uses getUser() (never getSession()) to confirm identity server-side,
 * then checks the email against the PLATFORM_ADMIN_EMAILS env var.
 *
 * Returns a service-role Supabase client that bypasses RLS — callers
 * must NEVER expose this client to the browser.
 */
export async function authorizeAdmin(): Promise<AdminAuthResult> {
  // 1. Authenticate via the normal (RLS-scoped) server client
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user?.email) {
    return { ok: false, error: 'Not authenticated' }
  }

  // 2. Check email against allowlist
  const adminEmails = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (adminEmails.length === 0) {
    console.error('[ADMIN_AUTH] PLATFORM_ADMIN_EMAILS env var is empty or missing')
    return { ok: false, error: 'Admin access is not configured' }
  }

  if (!adminEmails.includes(user.email.toLowerCase())) {
    return { ok: false, error: 'Not authorized as platform admin' }
  }

  // 3. Return service-role client (bypasses RLS for cross-tenant operations)
  const serviceClient = createServiceRoleClient()

  return {
    ok: true,
    ctx: {
      supabase: serviceClient,
      user: { id: user.id, email: user.email },
    },
  }
}
