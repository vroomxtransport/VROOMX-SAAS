import { notFound } from 'next/navigation'
import { getApplicationStatus } from '@/app/actions/driver-applications'
import {
  publicReadTenantBySlug,
  publicReadTenantLogoUrl,
} from '@/lib/public-auth'
import { BrandStyle } from '../../_components/brand-style'
import { TenantHeader } from '../../_components/tenant-header'
import Link from 'next/link'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'

interface Props {
  params: Promise<{ tenantSlug: string; statusToken: string }>
}

type StepStatus = 'done' | 'active' | 'pending' | 'rejected'

interface TimelineStep {
  label: string
  description: string
  status: StepStatus
}

function buildTimeline(
  overallStatus: string,
  stepsCompleted: number,
  stepsTotal: number,
): TimelineStep[] {
  const isRejected = overallStatus === 'rejected' || overallStatus === 'pending_adverse_action'
  const isApproved = overallStatus === 'approved'

  return [
    {
      label: 'Application submitted',
      description: 'Your application has been received.',
      status: 'done',
    },
    {
      label: 'Under review',
      description: 'A compliance officer is reviewing your application.',
      status:
        overallStatus === 'submitted'
          ? 'pending'
          : overallStatus === 'draft'
            ? 'pending'
            : 'done',
    },
    {
      label: 'Background checks',
      description: `Compliance checks in progress (${stepsCompleted} of ${stepsTotal} steps completed).`,
      status:
        overallStatus === 'in_review'
          ? 'active'
          : overallStatus === 'pending_adverse_action' || overallStatus === 'rejected'
            ? 'done'
            : isApproved
              ? 'done'
              : 'pending',
    },
    {
      label: 'Decision',
      description: isApproved
        ? 'Congratulations — you have been cleared to drive!'
        : isRejected
          ? 'A decision has been made on your application. You will receive an email with details.'
          : 'Pending completion of all compliance checks.',
      status: isApproved ? 'done' : isRejected ? 'rejected' : 'pending',
    },
  ]
}

export default async function StatusPage({ params }: Props) {
  const { tenantSlug, statusToken } = await params

  const result = await getApplicationStatus(statusToken)
  if ('error' in result) notFound()

  // Load tenant for branding (uniform 404 invariant — suspended tenants return null)
  const tenant = await publicReadTenantBySlug(tenantSlug)
  if (!tenant) notFound()

  // Cross-tenant chrome spoofing defense: the URL slug must match the
  // application's actual tenant. Otherwise an attacker could pair a valid
  // statusToken from carrier A with carrier B's slug and render carrier B's
  // branding around carrier A's application status — a phishing primitive.
  // Uniform 404 to avoid leaking tenant existence.
  if (tenant.id !== result.tenantId) notFound()

  const logoUrl = await publicReadTenantLogoUrl(tenant.logo_storage_path)

  const {
    status,
    submittedAt,
    overallPipelineStatus,
    stepsCompleted,
    stepsTotal,
    rejectionReason,
  } = result

  const timeline = buildTimeline(
    overallPipelineStatus ?? status,
    stepsCompleted ?? 0,
    stepsTotal ?? 10,
  )

  const formattedDate = submittedAt
    ? new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(submittedAt))
    : null

  return (
    <div className="flex min-h-screen flex-col items-center justify-start px-4 py-12" style={{ backgroundColor: '#0C1220' }}>
      <BrandStyle
        primary={tenant.brand_color_primary}
        secondary={tenant.brand_color_secondary}
      />

      {/* Carrier branding header above the status card */}
      <div className="w-full max-w-lg mb-6">
        <TenantHeader
          name={tenant.name}
          address={tenant.address}
          city={tenant.city}
          state={tenant.state}
          zip={tenant.zip}
          logoUrl={logoUrl}
        />
      </div>

      <div className="w-full max-w-lg">
        {/* Status card */}
        <div className="rounded-xl bg-white px-8 py-10 shadow-2xl">
          <header className="mb-8 text-center">
            <h1 className="text-xl font-bold text-[#192334]">Application Status</h1>
            {formattedDate && (
              <p className="mt-1 text-xs text-muted-foreground">Submitted {formattedDate}</p>
            )}
          </header>

          {/* Timeline */}
          <ol role="list" className="space-y-0" aria-label="Application progress timeline">
            {timeline.map((step, idx) => {
              const isLast = idx === timeline.length - 1
              const icon =
                step.status === 'done' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" aria-hidden="true" />
                ) : step.status === 'rejected' ? (
                  <XCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
                ) : step.status === 'active' ? (
                  <Clock className="h-5 w-5 text-[var(--brand-secondary,#fb7232)] animate-pulse" aria-hidden="true" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-gray-200 bg-white" aria-hidden="true" />
                )

              return (
                <li key={step.label} className="relative flex gap-4">
                  {/* Vertical connector line */}
                  {!isLast && (
                    <div
                      className="absolute left-2.5 top-6 h-full w-px bg-gray-100"
                      aria-hidden="true"
                    />
                  )}

                  <div className="relative z-10 shrink-0 pt-0.5">{icon}</div>

                  <div className={`pb-6 ${isLast ? '' : ''}`}>
                    <p
                      className={`text-sm font-semibold ${
                        step.status === 'done'
                          ? 'text-[#192334]'
                          : step.status === 'active'
                            ? 'text-[var(--brand-secondary,#fb7232)]'
                            : step.status === 'rejected'
                              ? 'text-red-600'
                              : 'text-muted-foreground'
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
                  </div>
                </li>
              )
            })}
          </ol>

          {/* Rejection reason — only if present + whitelisted display */}
          {rejectionReason && status === 'rejected' && (
            <div className="mt-2 rounded-lg border border-red-100 bg-red-50 p-4 text-xs text-red-700">
              <p className="font-semibold">Basis for decision:</p>
              <p className="mt-1">{rejectionReason}</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 border-t border-gray-100 pt-5 text-center">
            <p className="text-xs text-muted-foreground">
              Questions? Contact the carrier directly. Bookmark this page to check back on your status.
            </p>
            <Link
              href={`/apply/${tenantSlug}`}
              className="mt-3 inline-block text-xs text-[#192334] underline hover:text-[var(--brand-secondary,#fb7232)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#192334)] rounded"
            >
              Return to application page
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
