'use server'

import { authorize, safeError } from '@/lib/authz'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { factoringFeeRateSchema, companyProfileSchema } from '@/lib/validations/tenant-settings'
import { revalidatePath } from 'next/cache'

export async function updateFactoringFeeRate(data: unknown) {
  const parsed = factoringFeeRateSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('settings.manage')
  if (!auth.ok) return { error: auth.error }
  const { tenantId } = auth.ctx

  try {
    // Use service-role client to bypass RLS (admin-only action, already authorized above)
    const admin = createServiceRoleClient()
    const { error } = await admin
      .from('tenants')
      .update({ factoring_fee_rate: String(parsed.data.factoringFeeRate) })
      .eq('id', tenantId)

    if (error) throw error

    revalidatePath('/settings')
    revalidatePath('/billing')
    return { success: true }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'updateFactoringFeeRate') }
  }
}

export async function updateCompanyProfile(data: unknown) {
  const parsed = companyProfileSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('settings.manage')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('tenants')
    .update({
      name: parsed.data.name,
      dot_number: parsed.data.dotNumber || null,
      mc_number: parsed.data.mcNumber || null,
      address: parsed.data.address || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      zip: parsed.data.zip || null,
      phone: parsed.data.phone || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId)

  if (error) return { error: safeError(error, 'updateCompanyProfile') }

  revalidatePath('/settings')
  revalidatePath('/settings/profile')
  return { success: true }
}
