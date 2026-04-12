import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CompanySection } from '../company-section'
import type { TenantRole } from '@/types'

export default async function OrderDefaultsPage() {
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

  let factoringFeeRate: string | null = null
  let fetchError = false

  try {
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('factoring_fee_rate')
      .eq('id', tenantId)
      .single()

    if (error || !tenant) {
      console.error('[SETTINGS/ORDER-DEFAULTS] Failed to fetch tenant:', error)
      fetchError = true
    } else {
      factoringFeeRate = tenant.factoring_fee_rate ?? '0'
    }
  } catch (e) {
    console.error('[SETTINGS/ORDER-DEFAULTS] Data fetch failed:', e)
    fetchError = true
  }

  if (fetchError) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-sm text-amber-800">
          Unable to load order defaults. Please refresh the page.
        </p>
      </div>
    )
  }

  return <CompanySection factoringFeeRate={factoringFeeRate ?? '0'} />
}
