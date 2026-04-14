import { notFound } from 'next/navigation'
import {
  publicReadTenantBySlug,
  publicReadTenantLogoUrl,
  publicReadTenantBannerUrl,
} from '@/lib/public-auth'
import { BrandStyle } from './_components/brand-style'
import { WelcomePage } from './_components/welcome-page'

interface Props {
  params: Promise<{ tenantSlug: string }>
}

export default async function ApplyLandingPage({ params }: Props) {
  const { tenantSlug } = await params

  const tenant = await publicReadTenantBySlug(tenantSlug)
  if (!tenant) notFound()

  const [logoUrl, bannerUrl] = await Promise.all([
    publicReadTenantLogoUrl(tenant.logo_storage_path),
    publicReadTenantBannerUrl(tenant.app_banner_storage_path),
  ])

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0C1220' }}>
      <BrandStyle
        primary={tenant.brand_color_primary}
        secondary={tenant.brand_color_secondary}
      />
      <WelcomePage
        tenantSlug={tenantSlug}
        tenantName={tenant.name}
        address={tenant.address}
        city={tenant.city}
        state={tenant.state}
        zip={tenant.zip}
        logoUrl={logoUrl}
        bannerUrl={bannerUrl}
        welcomeMessage={tenant.app_welcome_message}
        estimatedTime={tenant.app_estimated_time}
      />
    </div>
  )
}
