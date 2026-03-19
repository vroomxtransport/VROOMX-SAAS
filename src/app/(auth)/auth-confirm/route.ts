import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'signup' | 'recovery' | 'invite' | 'email' | null
  const nextParam = searchParams.get('next') ?? '/dashboard'
  // Prevent open redirect: only allow relative paths starting with /
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/dashboard'

  // Handle code exchange (PKCE flow)
  const code = searchParams.get('code')
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // If next already points to invite/accept, use it directly
      if (next.includes('/invite/accept')) {
        return NextResponse.redirect(new URL(next, request.url))
      }

      // Check if the authenticated user has a pending invite
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        const redirectUrl = await findPendingInviteRedirect(user.email, request.url)
        if (redirectUrl) return NextResponse.redirect(redirectUrl)
      }

      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      type: type === 'invite' ? 'invite' : type,
      token_hash,
    })

    if (!error) {
      // If next already points to invite/accept, use it directly
      if (next.includes('/invite/accept')) {
        return NextResponse.redirect(new URL(next, request.url))
      }

      // Check if the authenticated user has a pending invite
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        const redirectUrl = await findPendingInviteRedirect(user.email, request.url)
        if (redirectUrl) return NextResponse.redirect(redirectUrl)
      }

      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  // If verification fails, redirect to login with error
  return NextResponse.redirect(
    new URL('/login?error=' + encodeURIComponent('Email verification failed. Please try again.'), request.url)
  )
}

/**
 * Check if user has a pending invite and return redirect URL to accept it.
 * Returns null if no pending invite found.
 */
async function findPendingInviteRedirect(
  email: string,
  baseUrl: string,
): Promise<URL | null> {
  try {
    const admin = createServiceRoleClient()
    const { data: invite } = await admin
      .from('invites')
      .select('token')
      .eq('email', email)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (invite?.token) {
      return new URL(`/invite/accept?token=${invite.token}`, baseUrl)
    }
  } catch {
    // Non-fatal: if lookup fails, just go to default redirect
  }
  return null
}
