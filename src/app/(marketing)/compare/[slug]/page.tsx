import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Check, X, AlertTriangle, Minus, ArrowRight, BarChart3 } from 'lucide-react'

import {
  getComparisonBySlug,
  getAllComparisonSlugs,
  comparisons,
  type ComparisonRow,
  type ComparisonStatus,
} from '@/lib/content/comparisons'
import { Breadcrumbs } from '@/components/marketing/breadcrumbs'
import { ComparisonVerdict } from '@/components/marketing/comparison-verdict'
import { FinalCTA } from '@/components/marketing/final-cta'
import { RelatedPages } from '@/components/marketing/related-pages'
import { BreadcrumbJsonLd, FAQPageJsonLd } from '@/components/shared/json-ld'
import { TimelineContent } from '@/components/ui/timeline-animation'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Static params + metadata
// ---------------------------------------------------------------------------

export function generateStaticParams() {
  return getAllComparisonSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const comparison = getComparisonBySlug(slug)

  if (!comparison) {
    return { title: 'Not Found' }
  }

  return {
    title: comparison.metaTitle,
    description: comparison.metaDescription,
    alternates: {
      canonical: `/compare/${slug}`,
    },
    openGraph: {
      title: comparison.metaTitle,
      description: comparison.metaDescription,
      type: 'website',
      siteName: 'VroomX',
    },
    twitter: {
      card: 'summary_large_image',
      title: comparison.metaTitle,
      description: comparison.metaDescription,
    },
  }
}

// ---------------------------------------------------------------------------
// Score calculation helpers
// ---------------------------------------------------------------------------

function calcScores(rows: ComparisonRow[]) {
  let vroomxWins = 0
  let competitorWins = 0
  let ties = 0

  for (const row of rows) {
    const v = row.vroomxStatus
    const c = row.competitorStatus

    if (v === 'vroomx' && c !== 'vroomx') {
      vroomxWins++
    } else if (c === 'vroomx' && v !== 'vroomx') {
      competitorWins++
    } else if (v === 'both' && c === 'both') {
      ties++
    } else if (v === 'neither' && c === 'neither') {
      ties++
    } else if (v === 'competitor' && c === 'competitor') {
      ties++
    } else if (v === c) {
      ties++
    } else if (v === 'vroomx') {
      vroomxWins++
    } else if (c === 'vroomx') {
      competitorWins++
    } else {
      // both or neither with mixed — call it a tie
      ties++
    }
  }

  return { vroomxWins, competitorWins, ties }
}

// ---------------------------------------------------------------------------
// Status cell component
// ---------------------------------------------------------------------------

function StatusCell({
  status,
  detail,
  isVroomx,
}: {
  status: ComparisonStatus
  detail: string
  isVroomx?: boolean
}) {
  let icon: React.ReactNode

  switch (status) {
    case 'vroomx':
      icon = isVroomx ? (
        <Check className="h-4 w-4 shrink-0 text-emerald-500" />
      ) : (
        <X className="h-4 w-4 shrink-0 text-red-400" />
      )
      break
    case 'competitor':
      icon = isVroomx ? (
        <X className="h-4 w-4 shrink-0 text-red-400" />
      ) : (
        <Check className="h-4 w-4 shrink-0 text-emerald-500" />
      )
      break
    case 'both':
      icon = <Check className="h-4 w-4 shrink-0 text-emerald-500" />
      break
    case 'neither':
      icon = <Minus className="h-4 w-4 shrink-0 text-muted-foreground" />
      break
  }

  const isWin = (isVroomx && status === 'vroomx') || (!isVroomx && status === 'competitor')

  return (
    <td
      className={cn(
        'px-4 py-3 align-top text-sm',
        isVroomx && 'bg-brand/[0.06]'
      )}
    >
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2">
          {icon}
          <span
            className={cn(
              'text-muted-foreground',
              isWin && 'font-medium text-foreground'
            )}
          >
            {detail}
          </span>
        </div>
      </div>
    </td>
  )
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const comparison = getComparisonBySlug(slug)

  if (!comparison) {
    notFound()
  }

  const { vroomxWins, competitorWins, ties } = calcScores(comparison.rows)
  const totalCategories = comparison.rows.length

  // Related comparisons — all slugs except the current one
  const allSlugs = getAllComparisonSlugs()
  const relatedSlugs = allSlugs.filter((s) => s !== slug)
  const relatedPages = relatedSlugs.map((s) => {
    const c = comparisons[s]
    return {
      title: `VroomX vs ${c.competitorName}`,
      description: c.subtitle,
      href: `/compare/${s}`,
      icon: <BarChart3 className="h-5 w-5" />,
    }
  })

  return (
    <>
      {/* Structured data */}
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: '/' },
          { name: 'Compare', url: '/compare' },
          {
            name: `VroomX vs ${comparison.competitorName}`,
            url: `/compare/${slug}`,
          },
        ]}
      />
      <FAQPageJsonLd faqs={comparison.faqs} />

      {/* ------------------------------------------------------------------ */}
      {/* 1. Hero                                                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-background py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: 'Compare', href: '/compare' },
              {
                label: `VroomX vs ${comparison.competitorName}`,
                href: `/compare/${slug}`,
              },
            ]}
          />

          <div className="mt-8 max-w-3xl">
            <TimelineContent animationNum={0}>
              <p className="section-kicker mb-4">Side-by-Side Comparison</p>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                {comparison.headline}
              </h1>
            </TimelineContent>

            <TimelineContent animationNum={1}>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground max-w-2xl">
                {comparison.subtitle}
              </p>
            </TimelineContent>

            <TimelineContent animationNum={2}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand to-[#2a3a4f] px-6 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:brightness-110"
                >
                  Start Free Trial
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#comparison-table"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border-subtle bg-background px-6 text-sm font-medium text-foreground transition-all hover:bg-accent hover:border-border"
                >
                  See Full Comparison
                </a>
              </div>
            </TimelineContent>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Verdict box                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-background pb-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ComparisonVerdict
            competitorName={comparison.competitorName}
            vroomxWins={vroomxWins}
            competitorWins={competitorWins}
            ties={ties}
            totalCategories={totalCategories}
            summary={comparison.verdictSummary}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Head-to-head comparison table                                     */}
      {/* ------------------------------------------------------------------ */}
      <section id="comparison-table" className="bg-surface-raised py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <TimelineContent animationNum={0}>
            <div className="mx-auto max-w-2xl text-center mb-12">
              <p className="section-kicker mb-4 justify-center">Feature Breakdown</p>
              <h2 className="text-3xl font-bold tracking-[-0.015em] text-foreground sm:text-4xl">
                VroomX vs {comparison.competitorName}
              </h2>
              <p className="mt-4 text-muted-foreground">
                {totalCategories} categories compared side by side
              </p>
            </div>
          </TimelineContent>

          <TimelineContent animationNum={1}>
            <div className="rounded-2xl border border-border-subtle bg-surface shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border-subtle">
                      <th
                        scope="col"
                        className="sticky left-0 z-10 bg-muted/50 px-4 py-3.5 text-left text-sm font-semibold text-muted-foreground min-w-[160px]"
                      >
                        Feature
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3.5 text-left text-sm font-bold text-brand bg-brand/[0.06] min-w-[200px]"
                      >
                        VroomX TMS
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3.5 text-left text-sm font-semibold text-muted-foreground min-w-[200px]"
                      >
                        {comparison.competitorName}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.rows.map((row, idx) => (
                      <tr
                        key={row.feature}
                        className={cn(
                          'border-b border-border-subtle/50 last:border-0',
                          idx % 2 === 0 ? 'bg-surface' : 'bg-background/50'
                        )}
                      >
                        <td className="sticky left-0 z-10 px-4 py-3 text-sm font-medium text-foreground bg-inherit">
                          {row.feature}
                        </td>
                        <StatusCell
                          status={row.vroomxStatus}
                          detail={row.vroomxDetail}
                          isVroomx
                        />
                        <StatusCell
                          status={row.competitorStatus}
                          detail={row.competitorDetail}
                        />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TimelineContent>

          {/* Legend */}
          <TimelineContent animationNum={2}>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                Supported
              </span>
              <span className="flex items-center gap-1.5">
                <X className="h-3.5 w-3.5 text-red-400" />
                Not supported
              </span>
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Partial
              </span>
              <span className="flex items-center gap-1.5">
                <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                Not applicable
              </span>
            </div>
          </TimelineContent>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Deep-dive differentiators                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-background py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <TimelineContent animationNum={0}>
            <div className="mx-auto max-w-2xl text-center mb-16">
              <p className="section-kicker mb-4 justify-center">Why VroomX Wins</p>
              <h2 className="text-3xl font-bold tracking-[-0.015em] text-foreground sm:text-4xl">
                Where the difference actually matters
              </h2>
            </div>
          </TimelineContent>

          <div className="space-y-24">
            {comparison.differentiators.map((diff, index) => {
              const isEven = index % 2 === 0

              return (
                <TimelineContent key={diff.title} animationNum={index + 1}>
                  <div
                    className={cn(
                      'grid grid-cols-1 items-center gap-12 lg:grid-cols-2',
                      !isEven && 'lg:[&>*:first-child]:order-2'
                    )}
                  >
                    {/* Text side */}
                    <div>
                      <p className="section-kicker mb-3">
                        {String(index + 1).padStart(2, '0')}
                      </p>
                      <h3 className="text-2xl font-bold tracking-[-0.015em] text-foreground sm:text-3xl">
                        {diff.title}
                      </h3>
                      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                        {diff.description}
                      </p>

                      {/* Bullet points synthesised from the title/description */}
                      <ul className="mt-6 space-y-3">
                        {[
                          'Built specifically for auto-transport carriers',
                          'Automatic calculations — no manual spreadsheet work',
                          'Real-time data, not end-of-month reports',
                        ].map((bullet) => (
                          <li key={bullet} className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-brand/15 bg-gradient-to-b from-brand/[0.12] to-brand/[0.04]">
                              <Check className="h-3 w-3 text-brand" />
                            </span>
                            <span className="text-sm text-muted-foreground">{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Visual placeholder */}
                    <div className="rounded-2xl bg-surface-raised border border-border-subtle p-8 flex items-center justify-center min-h-[240px]">
                      <div className="text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-brand/15 bg-gradient-to-b from-brand/[0.12] to-brand/[0.04]">
                          <BarChart3 className="h-6 w-6 text-brand" />
                        </div>
                        <p className="text-sm font-medium text-foreground">{diff.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Screenshot placeholder</p>
                      </div>
                    </div>
                  </div>
                </TimelineContent>
              )
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 5. Pricing comparison                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-surface-raised py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <TimelineContent animationNum={0}>
            <div className="mx-auto max-w-2xl text-center mb-12">
              <p className="section-kicker mb-4 justify-center">Pricing</p>
              <h2 className="text-3xl font-bold tracking-[-0.015em] text-foreground sm:text-4xl">
                What you actually pay
              </h2>
            </div>
          </TimelineContent>

          <TimelineContent animationNum={1}>
            <div className="mx-auto max-w-3xl grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* VroomX card */}
              <div className="widget-card-primary shimmer-border flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-brand">
                    VroomX TMS
                  </span>
                  <span className="inline-flex items-center rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                    {comparison.pricing.vroomxPlan}
                  </span>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-foreground">
                    {comparison.pricing.vroomxPrice}
                  </span>
                </div>

                <ul className="space-y-2.5 flex-1">
                  {comparison.pricing.vroomxIncludes.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand to-[#2a3a4f] px-4 text-sm font-semibold text-white transition-all hover:brightness-110"
                >
                  Start Free Trial
                </Link>
              </div>

              {/* Competitor card */}
              <div className="rounded-2xl border border-border-subtle bg-surface p-6 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {comparison.competitorName}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                    {comparison.pricing.competitorPlan}
                  </span>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-muted-foreground">
                    {comparison.pricing.competitorPrice}
                  </span>
                </div>

                <ul className="space-y-2.5 flex-1">
                  {comparison.pricing.competitorIncludes.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm">
                      <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 h-10" />
              </div>
            </div>
          </TimelineContent>

          {/* Pricing verdict */}
          <TimelineContent animationNum={2}>
            <div className="mx-auto mt-8 max-w-3xl rounded-xl border border-border-subtle bg-surface p-4 text-center">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {comparison.pricing.verdict}
              </p>
            </div>
          </TimelineContent>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 6. Switcher testimonial                                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-background py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <TimelineContent animationNum={0}>
            <div className="mx-auto max-w-3xl">
              <div className="widget-card-primary rounded-2xl p-8 sm:p-10 text-center">
                <p className="section-kicker mb-6 justify-center">
                  From {comparison.switcherTestimonial.previousProduct} Switcher
                </p>

                <blockquote className="text-lg font-medium leading-relaxed text-foreground sm:text-xl">
                  &ldquo;{comparison.switcherTestimonial.quote}&rdquo;
                </blockquote>

                <div className="mt-6 flex items-center justify-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand to-[#2a3a4f] text-sm font-bold text-white">
                    {comparison.switcherTestimonial.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">
                      {comparison.switcherTestimonial.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {comparison.switcherTestimonial.role}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TimelineContent>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 7. FAQ                                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-surface-raised py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <TimelineContent animationNum={0}>
            <div className="mx-auto max-w-2xl text-center mb-12">
              <p className="section-kicker mb-4 justify-center">FAQ</p>
              <h2 className="text-3xl font-bold tracking-[-0.015em] text-foreground sm:text-4xl">
                Common questions about switching
              </h2>
            </div>
          </TimelineContent>

          <TimelineContent animationNum={1}>
            <div className="mx-auto max-w-2xl">
              <Accordion type="single" collapsible className="space-y-1">
                {comparison.faqs.map((faq, index) => (
                  <AccordionItem
                    key={index}
                    value={`faq-${index}`}
                    className="rounded-xl border border-border-subtle bg-surface px-5"
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
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 8. Related comparisons                                               */}
      {/* ------------------------------------------------------------------ */}
      {relatedPages.length > 0 && (
        <RelatedPages
          title="More Comparisons"
          pages={relatedPages}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 9. Final CTA                                                         */}
      {/* ------------------------------------------------------------------ */}
      <FinalCTA />
    </>
  )
}
