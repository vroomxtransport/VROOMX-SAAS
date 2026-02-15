'use server'

import { createClient } from '@/lib/supabase/server'
import { driverSchema } from '@/lib/validations/driver'
import { checkTierLimit } from '@/lib/tier'
import { getResend } from '@/lib/resend/client'
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

  // Tier limit check: block if user limit reached or account suspended
  const tierCheck = await checkTierLimit(supabase, tenantId, 'users')
  if (!tierCheck.allowed) {
    if (tierCheck.limit === 0) {
      return { error: 'Your account is suspended. Please update your payment method.' }
    }
    return { error: `Team member limit reached (${tierCheck.current}/${tierCheck.limit}). Upgrade your plan to add more team members.` }
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

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) {
    return { error: 'No tenant found' }
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
    .eq('tenant_id', tenantId)
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

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) {
    return { error: 'No tenant found' }
  }

  const { error } = await supabase
    .from('drivers')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

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

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) {
    return { error: 'No tenant found' }
  }

  const { data: driver, error } = await supabase
    .from('drivers')
    .update({ driver_status: status })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/drivers')
  return { data: driver }
}

export async function sendDriverAppInvitation(driverId: string) {
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

  // Fetch driver (scoped to tenant)
  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select('first_name, last_name, email')
    .eq('id', driverId)
    .eq('tenant_id', tenantId)
    .single()

  if (driverError || !driver) {
    return { error: 'Driver not found' }
  }

  if (!driver.email) {
    return { error: 'Driver does not have an email address' }
  }

  // Fetch tenant name for the email
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single()

  const carrierName = tenant?.name || 'Your carrier'

  try {
    const resend = getResend()
    await resend.emails.send({
      from: 'VroomX <noreply@vroomx.com>',
      to: driver.email,
      subject: "You've been invited to the VroomX Driver App",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <h1 style="font-size: 24px; font-weight: 700; color: #111; margin-bottom: 8px;">Welcome to VroomX</h1>
          <p style="font-size: 16px; color: #555; line-height: 1.5; margin-bottom: 24px;">
            Hi ${driver.first_name},<br/><br/>
            <strong>${carrierName}</strong> has invited you to use the VroomX Driver App to manage your loads, inspections, and trip updates.
          </p>
          <a href="https://apps.apple.com/app/vroomx-driver/id0000000000" style="display: inline-block; background: #fb7232; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Download the App
          </a>
          <p style="font-size: 13px; color: #999; margin-top: 32px; line-height: 1.5;">
            Once installed, sign in with this email address (<strong>${driver.email}</strong>) to get started.
          </p>
        </div>
      `,
    })
  } catch {
    return { error: 'Failed to send invitation email. Please try again.' }
  }

  return { success: true }
}
