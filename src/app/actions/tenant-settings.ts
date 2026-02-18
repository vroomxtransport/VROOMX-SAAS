'use server'

import { authorize, safeError } from '@/lib/authz'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { factoringFeeRateSchema } from '@/lib/validations/tenant-settings'
import { revalidatePath } from 'next/cache'

export async function updateFactoringFeeRate(data: unknown) {
  const parsed = factoringFeeRateSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('settings.manage')
  if (!auth.ok) return { error: auth.error }
  const { tenantId } = auth.ctx

  // Use service-role client — RLS on tenants table doesn't allow user-level updates
  const admin = createServiceRoleClient()

  const { error } = await admin
    .from('tenants')
    .update({
      factoring_fee_rate: String(parsed.data.factoringFeeRate),
    })
    .eq('id', tenantId)

  if (error) {
    return { error: safeError(error, 'updateFactoringFeeRate') }
  }

  revalidatePath('/settings')
  revalidatePath('/billing')
  return { success: true }
}
