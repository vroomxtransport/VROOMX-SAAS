import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, BarChart3, LayoutGrid, Smartphone, Truck, FileText, MapPin, ClipboardList, Users, Shield } from 'lucide-react'
import { Breadcrumbs } from '@/components/marketing/breadcrumbs'
import { BreadcrumbJsonLd, FAQPageJsonLd } from '@/components/shared/json-ld'
import { FeatureWalkthrough } from '@/components/marketing/feature-walkthrough'
import { RelatedPages } from '@/components/marketing/related-pages'
import { FinalCTA } from '@/components/marketing/final-cta'
import { TimelineContent } from '@/components/ui/timeline-animation'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  getFeatureBySlug,
  getAllFeatureSlugs,
  features,
  type FeaturePage,
} from '@/lib/content/features'

// Icon map — keyed by feature slug
const featureIconMap: Record<string, React.ReactNode> = {
  'profit-tracking': <BarChart3 className="h-5 w-5" />,
  'dispatch-board': <LayoutGrid className="h-5 w-5" />,
  'driver-pay': <FileText className="h-5 w-5" />,
  'invoicing': <FileText className="h-5 w-5" />,
  'driver-app': <Smartphone className="h-5 w-5" />,
  'fleet-management': <Truck className="h-5 w-5" />,
  'compliance': <Shield className="h-5 w-5" />,
  'live-tracking': <MapPin className="h-5 w-5" />,
  'order-management': <ClipboardList className="h-5 w-5" />,
  'team-tools': <Users className="h-5 w-5" />,
}

function getFeatureIcon(slug: string): React.ReactNode {
  return featureIconMap[slug] ?? <Truck className="h-5 w-5" />
}

export async function generateStaticParams() {
  return getAllFeatureSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const feature = getFeatureBySlug(slug)

  if (!feature) {
    return {
      title: 'Feature Not Found | VroomX',
    }
  }

  return {
    title: feature.metaTitle,
    description: feature.metaDescription,
    alternates: {
      canonical: `/features/${feature.slug}`,
    },
    openGraph: {
      title: feature.metaTitle,
      description: feature.metaDescription,
      type: 'website',
      siteName: 'VroomX',
    },
    twitter: {
      card: 'summary_large_image',
      title: feature.metaTitle,
      description: feature.metaDescription,
    },
  }
}

function MetricsSection({ feature }: { feature: FeaturePage }) {
  return (
    <section className="bg-surface-raised py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <TimelineContent animationNum={0}>
          <h2 className="mb-10 text-center text-2xl font-bold tracking-[-0.015em] text-foreground sm:text-3xl">
            By the Numbers
          </h2>
        </TimelineContent>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 lg:gap-12">
          {feature.metrics.map((metric, index) => (
            <TimelineContent key={metric.label} animationNum={index + 1}>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-brand/15 bg-gradient-to-b from-brand/[0.12] to-brand/[0.04]">
                  <BarChart3 className="h-5 w-5 text-brand" aria-hidden="true" />
                </div>
                <p className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                  {metric.value}
                  {metric.suffix && (
                    <span className="text-3xl font-bold text-brand sm:text-4xl">
                      {metric.suffix}
                    </span>
                  )}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {metric.label}
                </p>
              </div>
            </TimelineContent>
          ))}
        </div>
      </div>
    </section>
  )
}

function ProblemSolutionSection({ feature }: { feature: FeaturePage }) {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <TimelineContent animationNum={0}>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Pain quote */}
            <div className="flex flex-col justify-center">
              <h2 className="mb-6 text-2xl font-bold tracking-[-0.015em] text-foreground sm:text-3xl">
                The Problem Every Carrier Knows
              </h2>
              <blockquote className="border-l-2 border-l-brand/30 pl-6">
                <p className="text-lg italic leading-relaxed text-foreground/80">
                  {feature.painQuote}
                </p>
                {feature.painAttribution && (
                  <footer className="mt-4 text-sm font-medium text-muted-foreground">
                    — {feature.painAttribution}
                  </footer>
                )}
              </blockquote>
            </div>

            {/* Solution points */}
            <div className="flex flex-col justify-center">
              <h3 className="mb-6 text-xl font-bold tracking-[-0.015em] text-foreground">
                How VroomX Solves It
              </h3>
              <ul className="flex flex-col gap-4" role="list">
                {feature.solutionPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-4">
                    <div
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-brand/15 bg-gradient-to-b from-brand/[0.12] to-brand/[0.04] text-xs font-bold text-brand"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </div>
                    <p className="text-base leading-relaxed text-foreground/80">{point}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </TimelineContent>
      </div>
    </section>
  )
}

function FAQAccordion({ feature }: { feature: FeaturePage }) {
  return (
    <section className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <TimelineContent animationNum={0}>
          <div className="mb-10 text-center">
            <span className="section-kicker">FAQ</span>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.015em] text-foreground sm:text-4xl">
              Common Questions
            </h2>
          </div>
        </TimelineContent>

        <TimelineContent animationNum={1}>
          <div className="rounded-2xl border border-border-subtle bg-surface p-2 shadow-sm">
            <Accordion type="single" collapsible className="w-full">
              {feature.faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`faq-${index}`}
                  className="border-border-subtle px-4 last:border-b-0"
                >
                  <AccordionTrigger className="cursor-pointer py-5 text-left text-[15px] font-semibold !no-underline transition hover:!no-underline hover:text-brand">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="leading-relaxed text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </TimelineContent>
      </div>
    </section>
  )
}

export default async function FeatureDeepDivePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const feature = getFeatureBySlug(slug)

  if (!feature) {
    notFound()
  }

  const breadcrumbItems = [
    { label: 'Features', href: '/features' },
    { label: feature.title, href: `/features/${feature.slug}` },
  ]

  const breadcrumbJsonLdItems = [
    { name: 'Home', url: '/' },
    { name: 'Features', url: '/features' },
    { name: feature.title, url: `/features/${feature.slug}` },
  ]

  // Resolve related feature pages from slugs
  const relatedPages = feature.relatedFeatures
    .map((relatedSlug) => {
      const relatedFeature = features[relatedSlug] as FeaturePage | undefined
      if (!relatedFeature) return null
      return {
        title: relatedFeature.title,
        description: relatedFeature.subtitle,
        href: `/features/${relatedFeature.slug}`,
        icon: getFeatureIcon(relatedFeature.slug),
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbJsonLdItems} />
      <FAQPageJsonLd faqs={feature.faqs} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-background py-20 sm:py-28">
        <div className="hero-light-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={breadcrumbItems} />

          <div className="mt-8 max-w-3xl">
            <TimelineContent animationNum={0}>
              <span className="section-kicker">{feature.kicker}</span>
            </TimelineContent>

            <TimelineContent animationNum={1}>
              <h1 className="mt-4 text-4xl font-bold tracking-[-0.015em] text-foreground sm:text-5xl">
                {feature.headline}
              </h1>
            </TimelineContent>

            <TimelineContent animationNum={2}>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                {feature.subtitle}
              </p>
            </TimelineContent>

            <TimelineContent animationNum={3}>
              <div className="mt-8">
                <Link
                  href="/signup"
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand to-[#2a3a4f] px-6 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:brightness-110"
                >
                  {feature.ctaText}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </TimelineContent>
          </div>
        </div>
      </section>

      {/* Problem + Solution */}
      <ProblemSolutionSection feature={feature} />

      {/* Feature Walkthrough */}
      <div className="border-t border-border-subtle">
        <FeatureWalkthrough steps={feature.walkthrough} />
      </div>

      {/* Metrics */}
      <MetricsSection feature={feature} />

      {/* FAQ */}
      <FAQAccordion feature={feature} />

      {/* Related Features */}
      {relatedPages.length > 0 && (
        <div className="border-t border-border-subtle">
          <RelatedPages title="Explore More Features" pages={relatedPages} />
        </div>
      )}

      <FinalCTA />
    </>
  )
}
