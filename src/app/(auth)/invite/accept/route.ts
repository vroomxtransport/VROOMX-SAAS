import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { redirect } from 'next/navigation'

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
    // Mark as expired
    await admin.from('invites').update({ status: 'expired' }).eq('id', invite.id)
    redirect('/login?error=' + encodeURIComponent('This invite has expired'))
  }

  // 2. Check if user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // User is logged in -- add to tenant directly
    try {
      // Check if already a member
      const { data: existingMembership } = await admin
        .from('tenant_memberships')
        .select('id')
        .eq('tenant_id', invite.tenant_id)
        .eq('user_id', user.id)
        .single()

      if (existingMembership) {
        // Already a member -- mark invite as accepted and redirect
        await admin
          .from('invites')
          .update({ status: 'accepted', accepted_at: new Date().toISOString() })
          .eq('id', invite.id)
        redirect('/dashboard')
      }

      // Add to tenant_memberships
      const { error: memberError } = await admin
        .from('tenant_memberships')
        .insert({
          tenant_id: invite.tenant_id,
          user_id: user.id,
          role: invite.role,
        })

      if (memberError) {
        console.error('Failed to add member:', memberError)
        redirect('/dashboard?error=' + encodeURIComponent('Failed to join team'))
      }

      // Update user's app_metadata with new tenant_id and role
      // CRITICAL: This is necessary for JWT hook to include tenant info
      await admin.auth.admin.updateUserById(user.id, {
        app_metadata: {
          tenant_id: invite.tenant_id,
          role: invite.role,
          plan: 'trial', // Will be updated on next JWT refresh via hook
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
      // Next.js redirect() throws a NEXT_REDIRECT error -- re-throw it
      if (err instanceof Error && 'digest' in err && typeof (err as any).digest === 'string' && (err as any).digest.startsWith('NEXT_REDIRECT')) {
        throw err
      }
      console.error('Invite acceptance error:', err)
      redirect('/dashboard?error=' + encodeURIComponent('Failed to join team'))
    }
  }

  // 3. Not logged in -- redirect to login/signup with invite context
  // Store token in URL so after login, user can be redirected back
  redirect(`/login?invite_token=${token}`)
}
