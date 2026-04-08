import { notFound } from 'next/navigation'
import {
  publicAuthForResume,
  publicReadTenantById,
  publicReadTenantLogoUrl,
} from '@/lib/public-auth'
import { ApplicationWizard } from '../_components/application-wizard'
import { TenantHeader } from '../_components/tenant-header'
import { BrandStyle } from '../_components/brand-style'
import Link from 'next/link'

interface Props {
  params: Promise<{ tenantSlug: string }>
  searchParams: Promise<{ token?: string }>
}

export default async function FormPage({ params, searchParams }: Props) {
  const { tenantSlug } = await params
  const { token } = await searchParams

  if (!token) notFound()

  // Validate resume token
  const authResult = await publicAuthForResume(token)
  if ('error' in authResult) notFound()

  const { application } = authResult

  // Load tenant for header rendering
  const tenant = await publicReadTenantById(application.tenant_id)
  // publicReadTenantById returns null for both nonexistent and suspended tenants
  if (!tenant) notFound()

  // Resolve carrier logo to a 1h signed URL (private branding bucket)
  const logoUrl = await publicReadTenantLogoUrl(tenant.logo_storage_path)

  return (
    // Dark navy outer shell — neutral chrome, brand color is applied to accents only
    <div className="min-h-screen" style={{ backgroundColor: '#0C1220' }}>
      <BrandStyle
        primary={tenant.brand_color_primary}
        secondary={tenant.brand_color_secondary}
      />
      {/* Persistent top bar */}
      <div
        className="sticky top-0 z-20 border-b border-white/10 px-4"
        style={{ backgroundColor: '#0C1220' }}
      >
        {/* 2px brand accent line under the sticky bar */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[2px]"
          style={{ background: 'var(--brand-primary, #192334)' }}
        />
        <div className="mx-auto flex max-w-4xl items-center justify-between py-2.5">
          {/* Centered "Application For Employment" label */}
          <TenantHeader
            name={tenant.name}
            address={tenant.address}
            city={tenant.city}
            state={tenant.state}
            zip={tenant.zip}
            logoUrl={logoUrl}
          />
          <span className="hidden text-xs font-semibold uppercase tracking-widest text-white/40 sm:block">
            Application For Employment
          </span>
          <Link
            href="/login"
            className="text-xs text-white/40 hover:text-white/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded"
          >
            &larr; Back to Login
          </Link>
        </div>
      </div>

      {/* Wizard mounts here */}
      <ApplicationWizard
        resumeToken={token}
        application={application}
        tenantSlug={tenantSlug}
        tenantName={tenant.name}
      />
    </div>
  )
}
