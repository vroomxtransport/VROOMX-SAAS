import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { SettingsNav } from './_components/settings-nav'
import type { TenantRole } from '@/types'

export const metadata: Metadata = {
  title: 'Settings | VroomX',
}

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const userRole = (user.app_metadata?.role ?? 'dispatcher') as TenantRole

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        subtitle="Manage your organization, team, billing, and preferences"
      />
      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-56 shrink-0">
          <SettingsNav userRole={userRole} />
        </aside>
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
