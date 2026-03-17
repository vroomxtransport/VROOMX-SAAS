'use client'

import { useRef } from 'react'
import { useInView } from 'framer-motion'
import NumberFlow from '@number-flow/react'
import { Zap, TrendingUp, DollarSign } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { TimelineContent } from '@/components/ui/timeline-animation'

interface Metric {
  icon: LucideIcon
  value: number
  prefix: string
  suffix: string
  label: string
  sublabel: string
}

const metrics: Metric[] = [
  {
    icon: Zap,
    value: 47,
    prefix: '',
    suffix: '%',
    label: 'Bill Same-Day, Get Paid Faster',
    sublabel: 'vs. 0% with spreadsheets and most dispatch tools',
  },
  {
    icon: TrendingUp,
    value: 3.2,
    prefix: '',
    suffix: 'x',
    label: 'More Loads Per Dispatcher',
    sublabel: 'Without adding a single office hire',
  },
  {
    icon: DollarSign,
    value: 12400,
    prefix: '$',
    suffix: '',
    label: 'Saved Per Month',
    sublabel: 'Average 20-truck fleet vs. legacy tools',
  },
]

export function MetricsBanner() {
  const sectionRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(triggerRef, { once: true, margin: '-10% 0px' })

  return (
    <section ref={sectionRef} className="relative">
      <div className="bg-surface-raised py-12 sm:py-16 lg:py-20">
        <div
          ref={triggerRef}
          className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8"
        >
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 lg:gap-12">
            {metrics.map((metric, idx) => {
              const Icon = metric.icon
              const isDecimal = !Number.isInteger(metric.value)
              return (
                <TimelineContent
                  key={metric.label}
                  as="div"
                  animationNum={idx}
                  timelineRef={sectionRef}
                >
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-brand/15 bg-gradient-to-b from-brand/[0.12] to-brand/[0.04]">
                      <Icon className="h-5 w-5 text-brand" />
                    </div>
                    <p className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                      {metric.prefix}
                      <NumberFlow
                        value={isInView ? metric.value : 0}
                        format={{
                          useGrouping: true,
                          minimumFractionDigits: isDecimal ? 1 : 0,
                          maximumFractionDigits: isDecimal ? 1 : 0,
                        }}
                        transformTiming={{
                          duration: 1000,
                          easing: 'ease-out',
                        }}
                      />
                      {metric.suffix}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {metric.label}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {metric.sublabel}
                    </p>
                  </div>
                </TimelineContent>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
