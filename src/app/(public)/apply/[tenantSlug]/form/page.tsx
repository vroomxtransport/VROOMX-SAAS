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

  const authResult = await publicAuthForResume(token)
  if ('error' in authResult) notFound()

  const { application } = authResult

  const tenant = await publicReadTenantById(application.tenant_id)
  if (!tenant) notFound()

  const logoUrl = await publicReadTenantLogoUrl(tenant.logo_storage_path)

  return (
    <div className="min-h-screen bg-gray-50/80">
      <BrandStyle
        primary={tenant.brand_color_primary}
        secondary={tenant.brand_color_secondary}
      />

      {/* Top header bar */}
      <div className="sticky top-0 z-20 border-b border-gray-200/80 bg-white/80 backdrop-blur-xl">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[2px] opacity-40"
          style={{ background: 'linear-gradient(90deg, transparent, var(--brand-primary, #192334), transparent)' }}
        />
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 sm:px-6 py-2.5">
          <TenantHeader
            name={tenant.name}
            address={tenant.address}
            city={tenant.city}
            state={tenant.state}
            zip={tenant.zip}
            logoUrl={logoUrl}
          />
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground lg:block">
            Application For Employment
          </span>
          <Link
            href="/login"
            className="text-xs text-muted-foreground hover:text-gray-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 rounded px-2 py-1"
          >
            &larr; Back
          </Link>
        </div>
      </div>

      {/* Wizard */}
      <ApplicationWizard
        resumeToken={token}
        application={application}
        tenantSlug={tenantSlug}
        tenantName={tenant.name}
      />
    </div>
  )
}
