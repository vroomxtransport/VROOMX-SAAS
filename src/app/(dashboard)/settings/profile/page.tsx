import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from './_components/profile-form'

export default async function CompanyProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) {
    redirect('/login')
  }

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('name, dot_number, mc_number, address, city, state, zip, phone')
    .eq('id', tenantId)
    .single()

  if (error || !tenant) {
    return (
      <div className="widget-card">
        <p className="text-sm text-muted-foreground text-center">
          Unable to load company profile. Please refresh the page.
        </p>
      </div>
    )
  }

  return <ProfileForm tenant={tenant} />
}
