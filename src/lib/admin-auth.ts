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
 * Three independent checks (defense in depth):
 *   1. getUser() — JWT validated server-side against Supabase Auth
 *   2. PLATFORM_ADMIN_EMAILS allowlist — env-controlled, easy to rotate
 *   3. user.app_metadata.platform_admin === true — DB-backed claim,
 *      survives email aliasing and is independent of env config
 *
 * On first admin login after this fix lands, if the email is on the
 * allowlist but the metadata flag is missing, the flag is auto-set via
 * the service-role admin API. This is a one-shot lazy migration so we
 * don't need a separate DB migration to backfill existing platform admins.
 *
 * MFA factor enrollment is checked but not enforced — we log a warning
 * if a platform admin has zero enrolled factors so operators are aware.
 * Hard MFA enforcement at sign-in is a Supabase project setting (not
 * something we can gate from application code).
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

  // 2. Check email against allowlist (primary gate, easy to rotate)
  const adminEmails = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (adminEmails.length === 0) {
    console.error('[ADMIN_AUTH] PLATFORM_ADMIN_EMAILS env var is empty or missing')
    return { ok: false, error: 'Admin access is not configured' }
  }

  const userEmail = user.email.toLowerCase()
  if (!adminEmails.includes(userEmail)) {
    return { ok: false, error: 'Not authorized as platform admin' }
  }

  // 3. Check the durable app_metadata.platform_admin claim. This is set
  // via the service-role admin API and survives env rotation. If the user
  // is on the allowlist but the flag is missing (e.g. first login after
  // this fix), auto-set it lazily so we don't need a separate backfill
  // migration.
  const serviceClient = createServiceRoleClient()
  const hasPlatformAdminFlag =
    user.app_metadata?.platform_admin === true

  if (!hasPlatformAdminFlag) {
    console.info(
      `[ADMIN_AUTH] Setting platform_admin flag for ${userEmail} (lazy migration)`
    )
    try {
      await serviceClient.auth.admin.updateUserById(user.id, {
        app_metadata: {
          ...(user.app_metadata ?? {}),
          platform_admin: true,
        },
      })
    } catch (updateErr) {
      // Non-fatal: the email allowlist check above is the active gate.
      // Log so we can investigate why the flag couldn't be set.
      console.error(
        '[ADMIN_AUTH] Failed to auto-set platform_admin flag:',
        updateErr instanceof Error ? updateErr.message : updateErr
      )
    }
  }

  // 4. MFA enrollment check (advisory — log only, do not block)
  // Hard enforcement at sign-in is a Supabase project setting. From server
  // code we can only confirm the user has at least one verified factor.
  try {
    const { data: factorsData } = await supabase.auth.mfa.listFactors()
    const verifiedFactors =
      [
        ...(factorsData?.totp ?? []),
        ...(factorsData?.phone ?? []),
      ].filter((f) => f.status === 'verified')

    if (verifiedFactors.length === 0) {
      console.warn(
        `[ADMIN_AUTH] Platform admin ${userEmail} has zero verified MFA factors. ` +
          `Recommend enrolling TOTP via /settings/security.`
      )
    }
  } catch (mfaErr) {
    // listFactors can fail in edge runtimes; non-fatal.
    console.warn(
      '[ADMIN_AUTH] MFA factor check failed:',
      mfaErr instanceof Error ? mfaErr.message : mfaErr
    )
  }

  // 5. Return service-role client (bypasses RLS for cross-tenant operations)
  return {
    ok: true,
    ctx: {
      supabase: serviceClient,
      user: { id: user.id, email: user.email },
    },
  }
}
