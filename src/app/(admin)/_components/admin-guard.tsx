import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * AdminGuard – server component for additional page-level admin checks.
 *
 * Include this at the top of an admin page when you need an extra guard
 * beyond the layout-level check (e.g. for pages accessible via direct URL
 * in nested layouts that may not inherit the admin layout).
 *
 * Renders nothing — only redirects unauthenticated / non-admin users.
 */
export async function AdminGuard() {
  let supabase
  try {
    supabase = await createClient()
  } catch {
    redirect('/login')
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) redirect('/login')

  const adminEmails = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (!adminEmails.includes(user.email.toLowerCase())) redirect('/dashboard')

  return null
}
