import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSignedUrl } from '@/lib/storage'
import { BrandingForm } from './_components/branding-form'

export const metadata: Metadata = { title: 'Branding | VroomX' }

export default async function BrandingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tenant } = await supabase
    .from('tenants')
    .select(
      'name, logo_storage_path, brand_color_primary, brand_color_secondary, invoice_header_text, invoice_footer_text',
    )
    .single()

  let logoUrl: string | null = null
  if (tenant?.logo_storage_path) {
    // Signed URL valid for 1 hour — page is server-rendered on each request
    const { url } = await getSignedUrl(supabase, 'branding', tenant.logo_storage_path, 3600)
    logoUrl = url || null
  }

  return (
    <BrandingForm
      tenantName={tenant?.name ?? ''}
      initialLogoUrl={logoUrl}
      initialBrandColorPrimary={tenant?.brand_color_primary ?? '#1a2b3f'}
      initialBrandColorSecondary={tenant?.brand_color_secondary ?? ''}
      initialInvoiceHeaderText={tenant?.invoice_header_text ?? ''}
      initialInvoiceFooterText={tenant?.invoice_footer_text ?? ''}
    />
  )
}
