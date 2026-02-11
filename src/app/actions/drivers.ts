'use server'

import { createClient } from '@/lib/supabase/server'
import { driverSchema } from '@/lib/validations/driver'
import { revalidatePath } from 'next/cache'

export async function createDriver(data: unknown) {
  const parsed = driverSchema.safeParse(data)
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

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) {
    return { error: 'No tenant found' }
  }

  const { data: driver, error } = await supabase
    .from('drivers')
    .insert({
      tenant_id: tenantId,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      zip: parsed.data.zip || null,
      license_number: parsed.data.licenseNumber || null,
      driver_type: parsed.data.driverType,
      driver_status: parsed.data.driverStatus,
      pay_type: parsed.data.payType,
      pay_rate: String(parsed.data.payRate),
      notes: parsed.data.notes || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/drivers')
  return { data: driver }
}

export async function updateDriver(id: string, data: unknown) {
  const parsed = driverSchema.safeParse(data)
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

  const { data: driver, error } = await supabase
    .from('drivers')
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      zip: parsed.data.zip || null,
      license_number: parsed.data.licenseNumber || null,
      driver_type: parsed.data.driverType,
      driver_status: parsed.data.driverStatus,
      pay_type: parsed.data.payType,
      pay_rate: String(parsed.data.payRate),
      notes: parsed.data.notes || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/drivers')
  return { data: driver }
}

export async function deleteDriver(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase.from('drivers').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/drivers')
  return { success: true }
}

export async function updateDriverStatus(id: string, status: 'active' | 'inactive') {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const { data: driver, error } = await supabase
    .from('drivers')
    .update({ driver_status: status })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/drivers')
  return { data: driver }
}
