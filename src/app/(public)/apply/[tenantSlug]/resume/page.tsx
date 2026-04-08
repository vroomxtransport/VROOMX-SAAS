import { notFound } from 'next/navigation'
import {
  publicReadTenantBySlug,
  publicReadTenantLogoUrl,
} from '@/lib/public-auth'
import { BrandStyle } from '../_components/brand-style'
import { TenantHeader } from '../_components/tenant-header'
import { ResumeForm } from './_components/resume-form'

interface Props {
  params: Promise<{ tenantSlug: string }>
}

export default async function ResumePage({ params }: Props) {
  const { tenantSlug } = await params

  // Load tenant by slug — uniform 404 invariant for nonexistent + suspended tenants
  const tenant = await publicReadTenantBySlug(tenantSlug)
  if (!tenant) notFound()

  const logoUrl = await publicReadTenantLogoUrl(tenant.logo_storage_path)

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: '#0C1220' }}
    >
      <BrandStyle
        primary={tenant.brand_color_primary}
        secondary={tenant.brand_color_secondary}
      />

      {/* Carrier branding header above the form card */}
      <div className="w-full max-w-md mb-6">
        <TenantHeader
          name={tenant.name}
          address={tenant.address}
          city={tenant.city}
          state={tenant.state}
          zip={tenant.zip}
          logoUrl={logoUrl}
        />
      </div>

      <div className="w-full max-w-md">
        <ResumeForm tenantSlug={tenantSlug} />
      </div>
    </div>
  )
}
