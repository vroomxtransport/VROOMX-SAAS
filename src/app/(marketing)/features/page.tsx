import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'
import { Breadcrumbs } from '@/components/marketing/breadcrumbs'
import { BreadcrumbJsonLd } from '@/components/shared/json-ld'
import { FinalCTA } from '@/components/marketing/final-cta'
import { TimelineContent } from '@/components/ui/timeline-animation'
import { featuresHubSections } from '@/lib/content/features'

export const metadata: Metadata = {
  title: 'Auto Transport TMS Features | VroomX',
  description:
    'Every feature your auto transport fleet needs: profit tracking, smart dispatch, driver pay automation, invoicing, fleet management, and compliance. Built for carriers.',
  alternates: {
    canonical: '/features',
  },
  openGraph: {
    title: 'Auto Transport TMS Features | VroomX',
    description:
      'Every feature your auto transport fleet needs: profit tracking, smart dispatch, driver pay automation, invoicing, fleet management, and compliance.',
    type: 'website',
    siteName: 'VroomX',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auto Transport TMS Features | VroomX',
    description:
      'Every feature your auto transport fleet needs: profit tracking, smart dispatch, driver pay automation, invoicing, and more.',
  },
}

const breadcrumbItems = [{ label: 'Features', href: '/features' }]

const breadcrumbJsonLdItems = [
  { name: 'Home', url: '/' },
  { name: 'Features', url: '/features' },
]

export default function FeaturesPage() {
  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbJsonLdItems} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-background py-20 sm:py-28">
        <div className="hero-light-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={breadcrumbItems} />

          <div className="mx-auto mt-8 max-w-3xl text-center">
            <TimelineContent animationNum={0}>
              <span className="section-kicker">Platform</span>
            </TimelineContent>

            <TimelineContent animationNum={1}>
              <h1 className="mt-4 text-4xl font-bold tracking-[-0.015em] text-foreground sm:text-5xl lg:text-[3.25rem]">
                Every Feature Your Fleet Needs,{' '}
                <span className="text-brand">Nothing It Doesn&apos;t</span>
              </h1>
            </TimelineContent>

            <TimelineContent animationNum={2}>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                VroomX is built top-to-bottom for auto transport carriers. Real
                financial visibility, automated dispatch, and a driver app that
                actually works — without the enterprise price tag.
              </p>
            </TimelineContent>

            <TimelineContent animationNum={3}>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/signup"
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand to-[#2a3a4f] px-6 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:brightness-110"
                >
                  Start Free Trial
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border-subtle bg-background px-6 text-sm font-medium text-foreground transition-all hover:border-border hover:bg-accent"
                >
                  See Pricing
                </Link>
              </div>
            </TimelineContent>
          </div>
        </div>
      </section>

      {/* Feature Sections Grid */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuresHubSections.map((section, index) => (
              <TimelineContent key={section.title} animationNum={index}>
                <div className="group flex h-full flex-col rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-border">
                  <h2 className="mb-2 text-lg font-bold tracking-[-0.015em] text-foreground">
                    {section.title}
                  </h2>
                  <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                    {section.description}
                  </p>

                  <ul className="mb-6 flex flex-1 flex-col gap-2.5" role="list">
                    {section.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                          aria-hidden="true"
                        />
                        <span className="text-sm text-foreground/80">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {section.link && (
                    <Link
                      href={section.link}
                      className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-brand transition-colors hover:text-brand/80"
                      aria-label={`Learn more about ${section.title}`}
                    >
                      Learn more
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  )}
                </div>
              </TimelineContent>
            ))}
          </div>
        </div>
      </section>

      <FinalCTA />
    </>
  )
}
