'use server'

import { authorize, safeError } from '@/lib/authz'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { inviteSchema } from '@/lib/validations/invite'
import { checkTierLimit } from '@/lib/tier'
import { revalidatePath } from 'next/cache'

export async function sendInvite(data: unknown) {
  const parsed = inviteSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('settings.manage', { rateLimit: { key: 'sendInvite', limit: 5, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Check user limit before inviting (count accepted members only)
  const tierCheck = await checkTierLimit(supabase, tenantId, 'users')
  if (!tierCheck.allowed) {
    if (tierCheck.limit === 0) {
      return { error: 'Your account is suspended. Please update your payment method.' }
    }
    return { error: `Team member limit reached (${tierCheck.current}/${tierCheck.limit}). Upgrade your plan to add more team members.` }
  }

  // Use the authenticated user's client for DB operations (passes RLS via JWT tenant_id)
  // Service role client is ONLY used for admin auth API calls below

  // Check for existing pending invite to same email in this tenant
  const { data: existingInvite } = await supabase
    .from('invites')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('email', parsed.data.email)
    .eq('status', 'pending')
    .single()

  if (existingInvite) {
    return { error: 'An invite has already been sent to this email address' }
  }

  // Create invite token
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours

  const { error: insertError } = await supabase
    .from('invites')
    .insert({
      tenant_id: tenantId,
      email: parsed.data.email,
      role: parsed.data.role,
      token,
      invited_by: auth.ctx.user.id,
      expires_at: expiresAt.toISOString(),
      status: 'pending',
    })

  if (insertError) {
    console.error('[INVITE] Failed to create invite:', insertError.message, insertError.code, insertError.details)
    return { error: 'Failed to create invite. Please try again.' }
  }

  // Use Supabase Admin API to invite user by email (requires service role)
  // This creates an auth user (if new) and sends Supabase's built-in invite email
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectTo = `${appUrl}/auth-confirm?next=${encodeURIComponent(`/invite/accept?token=${token}`)}`

  try {
    const admin = createServiceRoleClient()
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      parsed.data.email,
      {
        redirectTo,
        data: {
          invited_tenant_id: tenantId,
          invited_role: parsed.data.role,
        },
      }
    )

    if (inviteError) {
      // User may already exist in auth — that's OK, they'll use the login flow
      console.log('[INVITE] Supabase invite note:', inviteError.message)
    }
  } catch (err) {
    // Non-fatal: invite record exists, user can still accept via login page
    console.error('[INVITE] Supabase invite email failed (non-fatal):', err)
  }

  revalidatePath('/settings')
  revalidatePath('/dispatchers')
  return { success: true }
}

export async function revokeInvite(inviteId: string) {
  const auth = await authorize('settings.manage')
  if (!auth.ok) return { error: auth.error }
  const { tenantId } = auth.ctx

  // Use service role — RLS has no UPDATE policy for authenticated users
  const admin = createServiceRoleClient()
  const { error } = await admin
    .from('invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: safeError(error, 'revokeInvite') }
  }

  revalidatePath('/settings')
  return { success: true }
}
