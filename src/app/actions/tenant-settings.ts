'use server'

import { authorize, safeError } from '@/lib/authz'
import { factoringFeeRateSchema } from '@/lib/validations/tenant-settings'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { tenants } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function updateFactoringFeeRate(data: unknown) {
  const parsed = factoringFeeRateSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('settings.manage')
  if (!auth.ok) return { error: auth.error }
  const { tenantId } = auth.ctx

  try {
    await db
      .update(tenants)
      .set({ factoringFeeRate: String(parsed.data.factoringFeeRate) })
      .where(eq(tenants.id, tenantId))

    revalidatePath('/settings')
    revalidatePath('/billing')
    return { success: true }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'updateFactoringFeeRate') }
  }
}
