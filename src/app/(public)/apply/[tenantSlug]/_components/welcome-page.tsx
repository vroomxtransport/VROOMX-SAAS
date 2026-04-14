import Image from 'next/image'
import Link from 'next/link'
import { FileText, Clock, CreditCard, Shield, ChevronRight } from 'lucide-react'

interface WelcomePageProps {
  tenantSlug: string
  tenantName: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  logoUrl: string | null
  bannerUrl: string | null
  welcomeMessage: string | null
  estimatedTime: string | null
}

const DEFAULT_MESSAGE =
  'Thank you for your interest in joining our team. Please complete the application below to get started.'

const CHECKLIST = [
  { icon: CreditCard, label: "Valid driver's license (front & back photos)" },
  { icon: Shield, label: 'Medical examiner certificate' },
  { icon: FileText, label: 'Employment history (past 10 years)' },
  { icon: FileText, label: 'Social Security Number' },
]

export function WelcomePage({
  tenantSlug,
  tenantName,
  address,
  city,
  state,
  zip,
  logoUrl,
  bannerUrl,
  welcomeMessage,
  estimatedTime,
}: WelcomePageProps) {
  const addressLine = [address, city, state ? `${state}${zip ? ` ${zip}` : ''}` : zip]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="flex min-h-screen flex-col items-center">
      {/* Banner hero */}
      <div className="relative w-full h-[280px] overflow-hidden">
        {bannerUrl ? (
          <>
            <Image
              src={bannerUrl}
              alt={`${tenantName} banner`}
              fill
              className="object-cover"
              unoptimized
              priority
            />
            {/* Gradient overlay — fade to page bg */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to bottom, rgba(12,18,32,0.2) 0%, rgba(12,18,32,0.6) 60%, #0C1220 100%)',
              }}
            />
          </>
        ) : (
          /* Fallback: brand-color gradient */
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, var(--brand-primary, #192334) 0%, #0C1220 100%)`,
            }}
          />
        )}
      </div>

      {/* Content card */}
      <div className="relative -mt-20 w-full max-w-lg px-4 pb-12">
        {/* Logo + Company info */}
        <div className="flex flex-col items-center text-center mb-8">
          {logoUrl && (
            <div className="mb-4">
              <Image
                src={logoUrl}
                alt={`${tenantName} logo`}
                width={72}
                height={72}
                className="h-[72px] w-[72px] rounded-2xl object-contain bg-white p-2 ring-1 ring-white/20 shadow-lg"
                unoptimized
              />
            </div>
          )}
          <h1 className="text-xl font-bold uppercase tracking-widest text-white">
            {tenantName}
          </h1>
          {addressLine && (
            <p className="mt-1 text-sm text-gray-300">{addressLine}</p>
          )}
        </div>

        {/* Welcome message */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm mb-6">
          <h2 className="text-base font-semibold text-white mb-2">
            Employment Application
          </h2>
          <p className="text-sm leading-relaxed text-gray-300">
            {welcomeMessage || DEFAULT_MESSAGE}
          </p>
        </div>

        {/* What you'll need */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm mb-6">
          <h3 className="text-sm font-semibold text-white mb-4">
            What you&apos;ll need
          </h3>
          <ul className="space-y-3">
            {CHECKLIST.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.label} className="flex items-start gap-3">
                  <div
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: 'var(--brand-primary, #192334)' }}
                  >
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-sm text-gray-300">{item.label}</span>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Estimated time */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Clock className="h-4 w-4 text-gray-300" />
          <span className="text-sm text-gray-300">
            Estimated time: {estimatedTime || '15-20 minutes'}
          </span>
        </div>

        {/* CTA */}
        <Link
          href={`/apply/${tenantSlug}/resume`}
          className="group flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white transition-all hover:brightness-110"
          style={{ backgroundColor: 'var(--brand-primary, #192334)' }}
        >
          Start Application
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  )
}
