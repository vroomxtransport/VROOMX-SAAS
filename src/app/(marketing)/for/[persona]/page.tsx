import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Check, Users, Truck, Zap, Star } from 'lucide-react'

import {
  getPersonaBySlug,
  getAllPersonaSlugs,
  type PersonaPage,
} from '@/lib/content/personas'
import { Breadcrumbs } from '@/components/marketing/breadcrumbs'
import { BreadcrumbJsonLd, FAQPageJsonLd } from '@/components/shared/json-ld'
import { BeforeAfterComparison } from '@/components/marketing/before-after'
import { FinalCTA } from '@/components/marketing/final-cta'
import { RelatedPages } from '@/components/marketing/related-pages'
import { TimelineContent } from '@/components/ui/timeline-animation'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

// ---------------------------------------------------------------------------
// Static params
// ---------------------------------------------------------------------------

export function generateStaticParams() {
  return getAllPersonaSlugs().map((slug) => ({ persona: slug }))
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ persona: string }>
}): Promise<Metadata> {
  const { persona: slug } = await params
  const persona = getPersonaBySlug(slug)

  if (!persona) {
    return { title: 'Not Found' }
  }

  return {
    title: persona.metaTitle,
    description: persona.metaDescription,
    alternates: {
      canonical: `/for/${persona.slug}`,
    },
    openGraph: {
      title: persona.metaTitle,
      description: persona.metaDescription,
      type: 'website',
      siteName: 'VroomX',
    },
    twitter: {
      card: 'summary_large_image',
      title: persona.metaTitle,
      description: persona.metaDescription,
    },
  }
}

// ---------------------------------------------------------------------------
// Feature card icon — cycles through a small set of semantic icons
// ---------------------------------------------------------------------------

const featureIcons = [Zap, Truck, Check, Star, Users, ArrowRight]

function FeatureIcon({ index }: { index: number }) {
  const Icon = featureIcons[index % featureIcons.length] ?? Zap
  return <Icon className="h-5 w-5" aria-hidden="true" />
}

// ---------------------------------------------------------------------------
// Related personas helper — build RelatedPages data from other personas
// ---------------------------------------------------------------------------

function buildRelatedPages(
  currentSlug: string,
  allSlugs: string[],
  getPersona: (slug: string) => PersonaPage | undefined,
) {
  return allSlugs
    .filter((s) => s !== currentSlug)
    .map((s) => {
      const p = getPersona(s)
      return p
        ? {
            title: `For ${p.name}`,
            description: p.subtitle,
            href: `/for/${p.slug}`,
            icon: <Users className="h-5 w-5" aria-hidden="true" />,
          }
        : null
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PersonaPage({
  params,
}: {
  params: Promise<{ persona: string }>
}) {
  const { persona: slug } = await params
  const persona = getPersonaBySlug(slug)

  if (!persona) {
    notFound()
  }

  const allSlugs = getAllPersonaSlugs()
  const relatedPages = buildRelatedPages(slug, allSlugs, getPersonaBySlug)

  const breadcrumbItems = [
    { label: 'For', href: '/for' },
    { label: persona.name, href: `/for/${persona.slug}` },
  ]

  const jsonLdBreadcrumbs = [
    { name: 'Home', url: '/' },
    { name: 'For', url: '/for' },
    { name: persona.name, url: `/for/${persona.slug}` },
  ]

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Structured data                                                      */}
      {/* ------------------------------------------------------------------ */}
      <BreadcrumbJsonLd items={jsonLdBreadcrumbs} />
      <FAQPageJsonLd faqs={persona.faqs} />

      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-background py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={breadcrumbItems} />

          <div className="mx-auto mt-6 max-w-3xl">
            {/* Kicker pill */}
            <TimelineContent animationNum={0}>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/[0.07] px-4 py-1.5">
                <span className="text-sm font-semibold text-brand">
                  For {persona.name}
                </span>
              </div>
            </TimelineContent>

            <TimelineContent animationNum={1}>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                {persona.headline}
              </h1>
            </TimelineContent>

            <TimelineContent animationNum={2}>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl">
                {persona.subtitle}
              </p>
            </TimelineContent>

            <TimelineContent animationNum={3}>
              <div className="mt-10">
                <Link
                  href="/signup"
                  className="group inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-br from-brand to-[#2a3a4f] px-6 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:brightness-110"
                >
                  Start Free — Built for {persona.name}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </TimelineContent>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Before / After                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-muted/20 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <TimelineContent animationNum={0}>
            <h2 className="mb-10 text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Your Day, Before and After
            </h2>
          </TimelineContent>

          <BeforeAfterComparison items={persona.beforeAfterItems} />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Feature Highlights                                                   */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-background py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <TimelineContent animationNum={0}>
            <h2 className="mb-4 text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Built for {persona.name}
            </h2>
            <p className="mx-auto mb-12 max-w-xl text-center text-base text-muted-foreground">
              Every feature in VroomX was designed around how carriers actually
              operate — not generic logistics software retrofitted for auto
              transport.
            </p>
          </TimelineContent>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {persona.features.map((feature, index) => (
              <TimelineContent key={feature.title} animationNum={index + 1}>
                <div className="group flex h-full flex-col rounded-2xl border border-border-subtle bg-surface p-6 transition-all hover:border-brand/20 hover:shadow-md">
                  {/* Icon */}
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-brand/15 bg-gradient-to-b from-brand/[0.12] to-brand/[0.04] text-brand">
                    <FeatureIcon index={index} />
                  </div>

                  <h3 className="mb-2 text-base font-semibold text-foreground">
                    {feature.title}
                  </h3>

                  <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>

                  {feature.link && (
                    <Link
                      href={feature.link}
                      className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand transition-colors hover:text-brand/80"
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

      {/* ------------------------------------------------------------------ */}
      {/* Testimonials                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-muted/20 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <TimelineContent animationNum={0}>
            <h2 className="mb-12 text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              What {persona.name} Say
            </h2>
          </TimelineContent>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {persona.testimonials.map((testimonial, index) => (
              <TimelineContent key={testimonial.name} animationNum={index + 1}>
                <figure className="widget-card flex h-full flex-col rounded-2xl p-6">
                  {/* Star rating */}
                  <div className="mb-4 flex gap-0.5" aria-label="5 out of 5 stars">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 fill-amber-400 text-amber-400"
                        aria-hidden="true"
                      />
                    ))}
                  </div>

                  <blockquote className="flex-1 text-sm leading-relaxed text-foreground">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>

                  <figcaption className="mt-6 border-t border-border-subtle pt-4">
                    <span className="block text-sm font-semibold text-foreground">
                      {testimonial.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {testimonial.role}
                    </span>
                  </figcaption>
                </figure>
              </TimelineContent>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Recommended Plan                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-background py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <TimelineContent animationNum={0}>
            <h2 className="mb-10 text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              The Right Plan for You
            </h2>
          </TimelineContent>

          <TimelineContent animationNum={1}>
            <div className="mx-auto max-w-lg">
              {/* Shimmer-border gradient wrapper */}
              <div className="shimmer-border rounded-2xl bg-gradient-to-br from-brand/30 via-[#2a3a4f]/20 to-brand/10 p-px shadow-lg">
                <div className="relative rounded-[calc(1rem-1px)] bg-surface p-8">
                  {/* Badge */}
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-brand to-[#2a3a4f] px-4 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-md">
                      <Check className="h-3 w-3" />
                      Recommended
                    </span>
                  </div>

                  {/* Plan name and price */}
                  <div className="mb-6 text-center">
                    <p className="text-sm font-semibold uppercase tracking-widest text-brand">
                      {persona.recommendedPlan.name} Plan
                    </p>
                    <p className="mt-1 text-5xl font-bold tracking-tight text-foreground">
                      {persona.recommendedPlan.price}
                    </p>
                  </div>

                  {/* Reason */}
                  <p className="text-center text-sm leading-relaxed text-muted-foreground">
                    {persona.recommendedPlan.reason}
                  </p>

                  {/* CTAs */}
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href={`/signup?plan=${persona.recommendedPlan.name.toLowerCase()}`}
                      className="group flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand to-[#2a3a4f] px-5 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:brightness-110"
                    >
                      Start Free Trial
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    <Link
                      href="/pricing"
                      className="flex flex-1 items-center justify-center rounded-xl border border-border-subtle bg-background px-5 py-3 text-sm font-medium text-foreground transition-all hover:bg-accent hover:border-border"
                    >
                      Compare all plans
                    </Link>
                  </div>

                  {/* Trust signals */}
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                    {['No credit card required', '14-day free trial', 'Cancel anytime'].map(
                      (item) => (
                        <span key={item} className="flex items-center gap-1">
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                          {item}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TimelineContent>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FAQ                                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-muted/20 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <TimelineContent animationNum={0}>
              <h2 className="mb-10 text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Frequently Asked Questions
              </h2>
            </TimelineContent>

            <TimelineContent animationNum={1}>
              <div className="rounded-2xl border border-border-subtle bg-surface">
                <Accordion type="single" collapsible className="px-6">
                  {persona.faqs.map((faq, index) => (
                    <AccordionItem
                      key={index}
                      value={`faq-${index}`}
                      className="border-border-subtle last:border-0"
                    >
                      <AccordionTrigger className="text-left text-sm font-semibold text-foreground hover:no-underline">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </TimelineContent>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Related Personas                                                     */}
      {/* ------------------------------------------------------------------ */}
      {relatedPages.length > 0 && (
        <RelatedPages title="Built for Every Carrier Type" pages={relatedPages} />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Final CTA                                                            */}
      {/* ------------------------------------------------------------------ */}
      <FinalCTA />
    </>
  )
}
