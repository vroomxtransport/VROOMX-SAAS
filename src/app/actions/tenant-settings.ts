'use server'

import { authorize, safeError } from '@/lib/authz'
import { factoringFeeRateSchema } from '@/lib/validations/tenant-settings'
import { revalidatePath } from 'next/cache'

export async function updateFactoringFeeRate(data: unknown) {
  const parsed = factoringFeeRateSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('settings.manage')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
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
