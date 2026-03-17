'use client'

import { useRef } from 'react'
import { useInView } from 'framer-motion'
import NumberFlow from '@number-flow/react'
import { Calculator, SlidersHorizontal, BarChart3, ArrowRight, Truck, Receipt } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { TimelineContent } from '@/components/ui/timeline-animation'
import { cn } from '@/lib/utils'

interface FeatureBullet {
  icon: LucideIcon
  title: string
  description: string
}

const features: FeatureBullet[] = [
  {
    icon: Calculator,
    title: 'Clean Gross Calculator',
    description: 'Revenue minus broker fees minus local fees. Per order. Not estimated. Calculated.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Driver Settlements, Automated',
    description: 'Percentage, dispatch fee, per-car, per-mile. Four pay models. Override rates on any load without touching the driver\'s default.',
  },
  {
    icon: BarChart3,
    title: 'Profit by Truck & Driver',
    description: 'Know which trucks earn their keep and which are bleeding you dry. Revenue per mile, cost per mile, profit per mile.',
  },
  {
    icon: Truck,
    title: 'Break-Even Intelligence',
    description: 'Enter your fixed costs once (insurance, lease, parking, fuel, telematics) and see how much revenue you need each month to break even.',
  },
  {
    icon: Receipt,
    title: 'Broker Receivables & Aging',
    description: 'See who owes you, how late they are, and their payment history. Color-coded aging so you know exactly which broker to call.',
  },
]

interface LineItem {
  label: string
  value: number
  prefix?: string
  color?: string
  bold?: boolean
}

const lineItems: LineItem[] = [
  { label: 'Revenue', value: 2400, prefix: '$' },
  { label: 'Broker Fee', value: -180, prefix: '-$' },
  { label: 'Local Fee', value: -45, prefix: '-$' },
]

const cleanGross: LineItem = {
  label: 'Clean Gross',
  value: 2175,
  prefix: '$',
  color: 'text-brand',
  bold: true,
}

const driverPay: LineItem = {
  label: 'Driver Pay 68%',
  value: -1479,
  prefix: '-$',
}

const netProfit: LineItem = {
  label: 'Net Profit',
  value: 696,
  prefix: '$',
  color: 'text-emerald-500',
  bold: true,
}

function AnimatedValue({
  value,
  prefix,
  isVisible,
}: {
  value: number
  prefix: string
  isVisible: boolean
}) {
  const absValue = Math.abs(value)
  return (
    <span className="tabular-nums">
      {prefix}
      <NumberFlow
        value={isVisible ? absValue : 0}
        format={{ useGrouping: true, maximumFractionDigits: 0 }}
        transformTiming={{ duration: 800, easing: 'ease-out' }}
      />
    </span>
  )
}

function FinancialBreakdown({ isVisible }: { isVisible: boolean }) {
  return (
    <div className="space-y-3 text-sm">
      {lineItems.map((item) => (
        <div key={item.label} className="flex items-center justify-between">
          <span className="text-muted-foreground">{item.label}</span>
          <span className="font-medium text-foreground">
            <AnimatedValue
              value={item.value}
              prefix={item.prefix ?? ''}
              isVisible={isVisible}
            />
          </span>
        </div>
      ))}

      <div className="h-px bg-border-subtle" />

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{cleanGross.label}</span>
        <span className={cn('font-bold', cleanGross.color)}>
          <AnimatedValue
            value={cleanGross.value}
            prefix={cleanGross.prefix ?? ''}
            isVisible={isVisible}
          />
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{driverPay.label}</span>
        <span className="font-medium text-foreground">
          <AnimatedValue
            value={driverPay.value}
            prefix={driverPay.prefix ?? ''}
            isVisible={isVisible}
          />
        </span>
      </div>

      <div className="h-px bg-border-subtle" />

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{netProfit.label}</span>
        <span className={cn('font-bold', netProfit.color)}>
          <AnimatedValue
            value={netProfit.value}
            prefix={netProfit.prefix ?? ''}
            isVisible={isVisible}
          />
        </span>
      </div>
    </div>
  )
}

export function FinancialIntelligence() {
  const sectionRef = useRef<HTMLElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const isCardInView = useInView(cardRef, { once: true, margin: '-10% 0px' })

  return (
    <section ref={sectionRef} className="bg-background py-20 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          {/* Left column */}
          <TimelineContent as="div" animationNum={0} timelineRef={sectionRef}>
            <div>
              <p className="section-kicker mb-4">
                Your Money, In Real Time
              </p>

              <h2 className="text-3xl font-bold tracking-[-0.015em] text-foreground sm:text-4xl lg:text-[2.75rem]">
                You ran 47 loads last month. Which ones lost money?
              </h2>

              <div className="mt-10 space-y-8">
                {features.map((feature) => {
                  const Icon = feature.icon
                  return (
                    <div key={feature.title} className="flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/15 bg-gradient-to-b from-brand/[0.12] to-brand/[0.04]">
                        <Icon className="h-5 w-5 text-brand" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          {feature.title}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/signup"
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-semibold text-white shadow-md transition-all hover:bg-brand/90 hover:shadow-lg"
                >
                  Know Your Numbers on Every Load
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              </div>
            </div>
          </TimelineContent>

          {/* Right column - animated financial card */}
          <TimelineContent as="div" animationNum={1} timelineRef={sectionRef}>
            <div ref={cardRef} className="widget-card-primary shimmer-border rounded-2xl p-6 sm:p-8">
              <div className="mb-6 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand/15 bg-gradient-to-b from-brand/[0.12] to-brand/[0.04]">
                  <Calculator className="h-4 w-4 text-brand" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  Order Financial Breakdown
                </h3>
              </div>
              <FinancialBreakdown isVisible={isCardInView} />
            </div>
          </TimelineContent>
        </div>
      </div>
    </section>
  )
}
