import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RolesSection } from '../roles-section'
import type { TenantRole } from '@/types'

export default async function RolesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const tenantId = user.app_metadata?.tenant_id
  const userRole = (user.app_metadata?.role ?? 'dispatcher') as TenantRole

  if (!tenantId) {
    redirect('/login')
  }

  if (userRole !== 'owner' && userRole !== 'admin') {
    redirect('/settings/profile')
  }

  let customRolesData: Array<{ id: string; name: string; description: string | null; permissions: string[]; created_at: string }> = []
  let fetchError = false

  try {
    const { data: customRoles, error } = await supabase
      .from('custom_roles')
      .select('id, name, description, permissions, created_at')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true })

    if (error) {
      console.error('[SETTINGS/ROLES] Failed to fetch custom roles:', error)
      fetchError = true
    } else {
      customRolesData = customRoles ?? []
    }
  } catch (e) {
    console.error('[SETTINGS/ROLES] Data fetch failed:', e)
    fetchError = true
  }

  if (fetchError) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-sm text-amber-800">
          Unable to load roles. Please refresh the page.
        </p>
      </div>
    )
  }

  return <RolesSection customRoles={customRolesData} />
}
