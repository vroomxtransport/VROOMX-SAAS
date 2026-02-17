'use server'

import { authorize, safeError } from '@/lib/authz'
import { brokerSchema } from '@/lib/validations/broker'
import { revalidatePath } from 'next/cache'

export async function createBroker(data: unknown) {
  const parsed = brokerSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('brokers.create', { rateLimit: { key: 'createBroker', limit: 30, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { data: broker, error } = await supabase
    .from('brokers')
    .insert({
      tenant_id: tenantId,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      zip: parsed.data.zip || null,
      payment_terms: parsed.data.paymentTerms || null,
      factoring_company: parsed.data.factoringCompany || null,
      notes: parsed.data.notes || null,
    })
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'createBroker') }
  }

  revalidatePath('/brokers')
  return { success: true, data: broker }
}

export async function updateBroker(id: string, data: unknown) {
  const parsed = brokerSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('brokers.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { data: broker, error } = await supabase
    .from('brokers')
    .update({
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      zip: parsed.data.zip || null,
      payment_terms: parsed.data.paymentTerms || null,
      factoring_company: parsed.data.factoringCompany || null,
      notes: parsed.data.notes || null,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'updateBroker') }
  }

  revalidatePath('/brokers')
  return { success: true, data: broker }
}

export async function deleteBroker(id: string) {
  const auth = await authorize('brokers.delete')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('brokers')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: safeError(error, 'deleteBroker') }
  }

  revalidatePath('/brokers')
  return { success: true }
}
