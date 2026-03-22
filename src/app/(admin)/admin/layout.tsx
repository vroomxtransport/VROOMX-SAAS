import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '../_components/admin-sidebar'

export const metadata = {
  title: 'Admin — VroomX',
  robots: { index: false, follow: false },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 1. Create Supabase client
  let supabase
  try {
    supabase = await createClient()
  } catch (e) {
    console.error('[ADMIN_LAYOUT] Failed to create Supabase client:', e)
    redirect('/login')
  }

  // 2. Authenticate — use getUser() (never getSession()) per project rules
  let user
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) {
      console.error('[ADMIN_LAYOUT] Auth failed:', error?.message)
      redirect('/login')
    }
    user = data.user
  } catch (e) {
    // Re-throw Next.js redirect/notFound signals
    if (e && typeof e === 'object' && 'digest' in e) throw e
    console.error('[ADMIN_LAYOUT] Auth exception:', e)
    redirect('/login')
  }

  // 3. Check platform admin allow-list (server-side env var only — never client)
  const adminEmails = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (!user.email || !adminEmails.includes(user.email.toLowerCase())) {
    // Not a platform admin — send back to tenant dashboard
    redirect('/dashboard')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--sidebar-bg)]">
      {/* Admin sidebar — fixed width, no collapse needed */}
      <AdminSidebar userEmail={user.email} />

      {/* Main content area */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Subtle top bar to reinforce admin context */}
        <div className="flex h-10 shrink-0 items-center border-b border-[var(--sidebar-border-color)] bg-[var(--sidebar-bg)] px-6">
          <span className="text-xs font-medium text-amber-400/80 tracking-wide">
            Platform Admin Console
          </span>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto bg-[#0f0f0e]">
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
