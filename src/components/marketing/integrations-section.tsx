'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Zap,
  CreditCard,
  Receipt,
  MapPin,
  Map as MapIcon,
  MessageSquare,
  Workflow,
  Phone,
  Building2,
  Cloud,
  FileSignature,
  HardDrive,
  Monitor,
  Folder,
  Activity,
  type LucideIcon,
} from 'lucide-react'

/**
 * TMS-relevant integration categories. Each entry uses a distinctive
 * Lucide icon with a brand-representative tint color. Inline SVG avoids
 * external CDN dependencies, CORS issues, and any CSP exceptions.
 */
type Integration = {
  name: string
  icon: LucideIcon
  color: string
  bg: string
}

const ICONS_ROW1: Integration[] = [
  { name: 'Stripe', icon: CreditCard, color: '#635BFF', bg: '#EEECFF' },
  { name: 'QuickBooks', icon: Receipt, color: '#2CA01C', bg: '#E5F5E3' },
  { name: 'Google Maps', icon: MapPin, color: '#4285F4', bg: '#E3EEFC' },
  { name: 'Mapbox', icon: MapIcon, color: '#111827', bg: '#E7E9EC' },
  { name: 'Slack', icon: MessageSquare, color: '#4A154B', bg: '#EFE3EF' },
  { name: 'Zapier', icon: Workflow, color: '#FF4A00', bg: '#FFE4D9' },
  { name: 'Twilio', icon: Phone, color: '#F22F46', bg: '#FFE1E5' },
]

const ICONS_ROW2: Integration[] = [
  { name: 'HubSpot', icon: Building2, color: '#FF7A59', bg: '#FFEADF' },
  { name: 'Salesforce', icon: Cloud, color: '#00A1E0', bg: '#D9F1FB' },
  { name: 'DocuSign', icon: FileSignature, color: '#D4A017', bg: '#FBF1D3' },
  { name: 'Google Drive', icon: HardDrive, color: '#1A73E8', bg: '#E3EEFC' },
  { name: 'Microsoft', icon: Monitor, color: '#5E5E5E', bg: '#E9E9E9' },
  { name: 'Dropbox', icon: Folder, color: '#0061FF', bg: '#DAE8FF' },
  { name: 'Sentry', icon: Activity, color: '#362D59', bg: '#E4E2ED' },
]

// Repeat the icons so the marquee loop is seamless across wide screens
const repeatedIcons = <T,>(icons: T[], repeat = 4): T[] =>
  Array.from({ length: repeat }).flatMap(() => icons)

function IntegrationIcon({ icon: Icon, name, color, bg }: Integration) {
  return (
    <div
      className="h-20 w-20 flex-shrink-0 rounded-2xl shadow-sm ring-1 ring-border-subtle flex items-center justify-center"
      style={{ backgroundColor: bg }}
      aria-label={name}
      title={name}
    >
      <Icon className="h-10 w-10" style={{ color }} strokeWidth={2} aria-hidden="true" />
    </div>
  )
}

export function IntegrationsSection() {
  return (
    <section className="relative overflow-hidden bg-background py-20 sm:py-28 lg:py-32">
      {/* Subtle dot grid background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,color-mix(in_oklch,var(--foreground)_6%,transparent)_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="relative mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
          <Zap className="h-3 w-3 text-brand" aria-hidden="true" />
          Integrations
        </span>

        <h2 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Connect the tools you already use
        </h2>

        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
          VroomX plugs into your accounting, telematics, payments, and
          communication stack so your data stays in sync — automatically.
        </p>

        <div className="mt-8">
          <Button asChild size="lg">
            <Link href="/signup">Start free trial</Link>
          </Button>
        </div>

        {/* Carousel */}
        <div className="relative mt-14 overflow-hidden py-3">
          {/* Row 1 — scrolls left */}
          <div className="flex w-max gap-10 whitespace-nowrap animate-marquee transform-gpu will-change-transform">
            {repeatedIcons(ICONS_ROW1, 4).map((icon, i) => (
              <IntegrationIcon key={`row1-${i}`} {...icon} />
            ))}
          </div>

          {/* Row 2 — scrolls right */}
          <div className="mt-6 flex w-max gap-10 whitespace-nowrap animate-marquee-reverse transform-gpu will-change-transform">
            {repeatedIcons(ICONS_ROW2, 4).map((icon, i) => (
              <IntegrationIcon key={`row2-${i}`} {...icon} />
            ))}
          </div>

          {/* Fade overlays on the left and right edges */}
          <div className="pointer-events-none absolute left-0 top-0 h-full w-16 bg-gradient-to-r from-background to-transparent sm:w-24" />
          <div className="pointer-events-none absolute right-0 top-0 h-full w-16 bg-gradient-to-l from-background to-transparent sm:w-24" />
        </div>
      </div>
    </section>
  )
}
