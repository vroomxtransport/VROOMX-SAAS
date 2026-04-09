'use server'

import { authorize, safeError } from '@/lib/authz'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { factoringFeeRateSchema, companyProfileSchema, brandingSchema } from '@/lib/validations/tenant-settings'
import { uploadFile, deleteFile } from '@/lib/storage'
import { revalidatePath } from 'next/cache'

export async function updateFactoringFeeRate(data: unknown) {
  const parsed = factoringFeeRateSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('settings.manage', { rateLimit: { key: 'updateSettings', limit: 20, windowMs: 60_000 } })
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

  const auth = await authorize('settings.manage', { rateLimit: { key: 'updateSettings', limit: 20, windowMs: 60_000 } })
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

export async function updateBranding(data: unknown) {
  const parsed = brandingSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('settings.manage', { rateLimit: { key: 'updateSettings', limit: 20, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('tenants')
    .update({
      brand_color_primary: parsed.data.brandColorPrimary || null,
      brand_color_secondary: parsed.data.brandColorSecondary || null,
      invoice_header_text: parsed.data.invoiceHeaderText || null,
      invoice_footer_text: parsed.data.invoiceFooterText || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId)

  if (error) return { error: safeError(error, 'updateBranding') }

  revalidatePath('/settings')
  revalidatePath('/settings/branding')
  return { success: true }
}

const ALLOWED_LOGO_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
const MAX_LOGO_SIZE = 5 * 1024 * 1024 // 5 MB

export async function uploadLogo(formData: FormData) {
  const auth = await authorize('settings.manage', { rateLimit: { key: 'uploadLogo', limit: 10, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const file = formData.get('logo') as File | null
  if (!file || file.size === 0) return { error: 'No file provided.' }

  if (!ALLOWED_LOGO_MIME.has(file.type)) {
    return { error: 'File must be a PNG, JPEG, WebP, or SVG image.' }
  }
  if (file.size > MAX_LOGO_SIZE) {
    return { error: 'File too large. Maximum size is 5MB.' }
  }

  // Fetch existing logo path for cleanup
  const { data: tenant } = await supabase
    .from('tenants')
    .select('logo_storage_path')
    .eq('id', tenantId)
    .single()

  // Delete old logo if one exists
  if (tenant?.logo_storage_path) {
    await deleteFile(supabase, 'branding', tenant.logo_storage_path)
  }

  const { path, error: uploadError } = await uploadFile(
    supabase,
    'branding',
    tenantId,
    'logo',
    file,
  )
  if (uploadError) return { error: uploadError }

  const { error: updateError } = await supabase
    .from('tenants')
    .update({ logo_storage_path: path, updated_at: new Date().toISOString() })
    .eq('id', tenantId)

  if (updateError) {
    // Best-effort cleanup of newly uploaded file
    await deleteFile(supabase, 'branding', path)
    return { error: safeError(updateError, 'uploadLogo') }
  }

  revalidatePath('/settings')
  revalidatePath('/settings/branding')
  return { success: true, path }
}

export async function deleteLogo() {
  const auth = await authorize('settings.manage', { rateLimit: { key: 'deleteLogo', limit: 10, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { data: tenant } = await supabase
    .from('tenants')
    .select('logo_storage_path')
    .eq('id', tenantId)
    .single()

  if (!tenant?.logo_storage_path) return { success: true }

  const { error: deleteError } = await deleteFile(supabase, 'branding', tenant.logo_storage_path)
  if (deleteError) return { error: safeError({ message: deleteError }, 'deleteLogo') }

  const { error: updateError } = await supabase
    .from('tenants')
    .update({ logo_storage_path: null, updated_at: new Date().toISOString() })
    .eq('id', tenantId)

  if (updateError) return { error: safeError(updateError, 'deleteLogo') }

  revalidatePath('/settings')
  revalidatePath('/settings/branding')
  return { success: true }
}
