'use server'

import { authorize, safeError } from '@/lib/authz'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getResend } from '@/lib/resend/client'
import { inviteSchema } from '@/lib/validations/invite'
import { checkTierLimit } from '@/lib/tier'
import { InviteEmail } from '@/components/email/invite-email'
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

  // Check for existing pending invite to same email in this tenant
  const admin = createServiceRoleClient()
  const { data: existingInvite } = await admin
    .from('invites')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('email', parsed.data.email)
    .eq('status', 'pending')
    .single()

  if (existingInvite) {
    return { error: 'An invite has already been sent to this email address' }
  }

  // Duplicate membership is caught by unique constraint on acceptance

  // Create invite token (crypto.randomUUID)
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours

  const { error: insertError } = await admin
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
    console.error('Failed to create invite:', insertError)
    return { error: 'Failed to create invite' }
  }

  // Fetch tenant name for email
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single()

  // Send invite email via Resend with React Email template
  const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/accept?token=${token}`
  const inviterName = auth.ctx.user.email || 'A team member'

  try {
    await getResend().emails.send({
      from: `${tenant?.name || 'VroomX'} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
      to: [parsed.data.email],
      subject: `You've been invited to join ${tenant?.name || 'a team'} on VroomX`,
      react: InviteEmail({
        tenantName: tenant?.name || 'Your team',
        inviterName,
        role: parsed.data.role,
        acceptUrl,
      }),
    })
  } catch (emailError) {
    console.error('Failed to send invite email:', emailError)
    // Don't fail the invite -- it's created in DB. User can resend.
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function revokeInvite(inviteId: string) {
  const auth = await authorize('settings.manage')
  if (!auth.ok) return { error: auth.error }
  const { tenantId } = auth.ctx

  const admin = createServiceRoleClient()

  const { error } = await admin
    .from('invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
    .eq('tenant_id', tenantId) // Security: only revoke own tenant's invites

  if (error) {
    return { error: safeError(error, 'revokeInvite') }
  }

  revalidatePath('/settings')
  return { success: true }
}
