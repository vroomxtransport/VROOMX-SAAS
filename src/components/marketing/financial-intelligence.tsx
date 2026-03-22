'use client'

import { ArrowRight, ClipboardList, Calculator, Wallet, Truck, ShieldCheck, TrendingUp } from 'lucide-react'
import { RadialOrbitalTimeline } from '@/components/ui/radial-orbital-timeline'

const timelineData = [
  {
    id: '1',
    title: 'Orders & Dispatch',
    description:
      'Create orders, assign to trips, and dispatch drivers\u2014all in one streamlined workflow.',
    icon: <ClipboardList />,
    status: 'completed' as const,
  },
  {
    id: '2',
    title: 'Financial Intelligence',
    description:
      'Clean Gross, driver settlements, profit-per-truck, and break-even analysis in real time.',
    icon: <Calculator />,
    status: 'completed' as const,
  },
  {
    id: '3',
    title: 'Driver Settlements',
    description:
      'Four pay models with per-order overrides. Generate, approve, and track payroll automatically.',
    icon: <Wallet />,
    status: 'completed' as const,
  },
  {
    id: '4',
    title: 'Fleet Management',
    description:
      'Track trucks, trailers, fuel, and maintenance with document expiry alerts.',
    icon: <Truck />,
    status: 'in-progress' as const,
  },
  {
    id: '5',
    title: 'Compliance & Safety',
    description:
      'FMCSA-aligned DQF tracking, DOT inspection logs, and cargo damage claims.',
    icon: <ShieldCheck />,
    status: 'in-progress' as const,
  },
  {
    id: '6',
    title: 'Growth Analytics',
    description:
      'Revenue trends, broker scorecards, and route profitability to scale smarter.',
    icon: <TrendingUp />,
    status: 'pending' as const,
  },
]

export function FinancialIntelligence() {
  return (
    <section className="bg-background py-20 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-kicker mb-4">Platform Features</p>
          <h2 className="text-3xl font-bold tracking-[-0.015em] text-foreground sm:text-4xl lg:text-[2.75rem]">
            Everything You Need to Run Your Fleet
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            From dispatch to driver settlements, every module works together so nothing
            falls through the cracks.
          </p>
        </div>

        {/* Orbital Timeline */}
        <div className="mt-16 flex justify-center">
          <RadialOrbitalTimeline timelineData={timelineData} />
        </div>

        {/* CTA */}
        <div className="mt-12 flex justify-center">
          <a
            href="/signup"
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-semibold text-white shadow-md transition-all hover:bg-brand/90 hover:shadow-lg"
          >
            Start Your Free Trial
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </section>
  )
}
