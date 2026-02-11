'use server'

import { createClient } from '@/lib/supabase/server'
import { brokerSchema } from '@/lib/validations/broker'
import { revalidatePath } from 'next/cache'

export async function createBroker(data: unknown) {
  const parsed = brokerSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()

  // Get tenant_id from authenticated user's app_metadata
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) {
    return { error: 'No tenant found' }
  }

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
    return { error: error.message }
  }

  revalidatePath('/brokers')
  return { data: broker }
}

export async function updateBroker(id: string, data: unknown) {
  const parsed = brokerSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

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
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/brokers')
  return { data: broker }
}

export async function deleteBroker(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase.from('brokers').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/brokers')
  return { success: true }
}
