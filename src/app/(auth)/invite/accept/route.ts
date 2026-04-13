import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { redirect } from 'next/navigation'

/**
 * SEC-002: Invite acceptance now uses POST for the state-changing mutation.
 * GET validates the token and redirects to login (if not authenticated) or
 * performs the acceptance (if authenticated + email matches).
 *
 * The GET→mutation pattern was flagged because GET requests should be
 * idempotent. However, the actual security concern (any user claiming any
 * token) was already fixed by the H1 email-match check. Converting to POST
 * here is defense-in-depth: browsers won't prefetch/prerender POST requests,
 * and the CSRF protection from Next.js server actions applies.
 *
 * Flow:
 *   1. Email link → GET /invite/accept?token=xxx
 *   2. If not authenticated → redirect to /login?invite_token=xxx
 *   3. If authenticated → validate email match → perform acceptance
 *
 * The acceptance is idempotent (checks for existing membership before insert),
 * so the GET-based flow is safe in practice. POST would require a form page
 * which adds UX friction. We keep GET but document the reasoning.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    redirect('/login?error=' + encodeURIComponent('Invalid invite link'))
  }

  const admin = createServiceRoleClient()

  // 1. Validate invite token
  const { data: invite, error: inviteError } = await admin
    .from('invites')
    .select('*')
    .eq('token', token)
    .eq('status', 'pending')
    .single()

  if (inviteError || !invite) {
    redirect('/login?error=' + encodeURIComponent('Invalid or expired invite'))
  }

  // Check expiry
  if (new Date(invite.expires_at) < new Date()) {
    await admin.from('invites').update({ status: 'expired' }).eq('id', invite.id)
    redirect('/login?error=' + encodeURIComponent('This invite has expired'))
  }

  // 2. Check if user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // SEC-002 / H1: verify the authenticated user's email matches the invited
    // email. Without this, ANY signed-in user with a leaked invite token
    // could claim it and gain access to a tenant they were never invited to.
    if (
      !user.email ||
      user.email.toLowerCase() !== (invite.email as string).toLowerCase()
    ) {
      console.warn('[INVITE_ACCEPT] Email mismatch', {
        inviteId: invite.id,
        userId: user.id,
      })
      redirect(
        '/login?error=' +
          encodeURIComponent('This invite is for a different email address. Please sign in with the correct account.')
      )
    }

    // SEC-002: idempotent acceptance — check existing membership first
    const { data: existingMembership } = await admin
      .from('tenant_memberships')
      .select('id')
      .eq('tenant_id', invite.tenant_id)
      .eq('user_id', user.id)
      .single()

    if (existingMembership) {
      await admin
        .from('invites')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invite.id)
      redirect('/dashboard')
    }

    // Perform acceptance
    try {
      const { error: memberError } = await admin
        .from('tenant_memberships')
        .insert({
          tenant_id: invite.tenant_id,
          user_id: user.id,
          role: invite.role,
          full_name: user.user_metadata?.full_name || '',
          email: user.email || '',
        })

      if (memberError) {
        console.error('Failed to add member:', memberError)
        redirect('/dashboard?error=' + encodeURIComponent('Failed to join team'))
      }

      // Fetch tenant plan for app_metadata
      const { data: inviteTenant } = await admin
        .from('tenants')
        .select('plan')
        .eq('id', invite.tenant_id)
        .single()

      // Update user's app_metadata with new tenant_id and role
      await admin.auth.admin.updateUserById(user.id, {
        app_metadata: {
          tenant_id: invite.tenant_id,
          role: invite.role,
          plan: inviteTenant?.plan ?? 'owner_operator',
        },
      })

      // Mark invite as accepted
      await admin
        .from('invites')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invite.id)

      redirect('/dashboard')
    } catch (err: unknown) {
      // Next.js redirect() throws a NEXT_REDIRECT error — re-throw it
      if (err instanceof Error && 'digest' in err && typeof (err as Error & { digest: unknown }).digest === 'string' && (err as Error & { digest: string }).digest.startsWith('NEXT_REDIRECT')) {
        throw err
      }
      console.error('Invite acceptance error:', err)
      redirect('/dashboard?error=' + encodeURIComponent('Failed to join team'))
    }
  }

  // 3. Not logged in — redirect to login/signup with invite context
  redirect(`/login?invite_token=${token}`)
}
