'use client'

import { useRef } from 'react'
import { Car, Zap, Clock, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { TimelineContent } from '@/components/ui/timeline-animation'

const stats: { value: string; label: string; icon: LucideIcon }[] = [
  { value: '10,000+', label: 'Vehicles dispatched monthly', icon: Car },
  { value: '99.8%', label: 'Uptime SLA', icon: Zap },
  { value: '< 5 min', label: 'Average setup time', icon: Clock },
  { value: '$0', label: 'To start your free trial', icon: Sparkles },
]

const revealVariants = {
  visible: (i: number) => ({
    y: 0, opacity: 1, filter: "blur(0px)",
    transition: { delay: i * 0.15, duration: 0.5 },
  }),
  hidden: { filter: "blur(10px)", y: 20, opacity: 0 },
}

export function StatsBanner() {
  const sectionRef = useRef<HTMLDivElement>(null)

  return (
    <section ref={sectionRef} className="border-y border-border-subtle bg-muted/30 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((stat, idx) => {
            const Icon = stat.icon
            return (
              <TimelineContent key={stat.label} as="div" animationNum={idx} timelineRef={sectionRef} customVariants={revealVariants}>
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10">
                    <Icon className="h-5 w-5 text-brand" />
                  </div>
                  <p className="text-3xl font-extrabold tracking-tight text-brand sm:text-4xl">
                    {stat.value}
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              </TimelineContent>
            )
          })}
        </div>
      </div>
    </section>
  )
}
