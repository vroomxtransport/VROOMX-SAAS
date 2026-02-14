'use client'

import { useRef } from 'react'
import { TimelineContent } from '@/components/ui/timeline-animation'

const carriers = [
  'APEX AUTO',
  'NATIONWIDE CARRIERS',
  'EAGLE TRANSPORT',
  'VELOCITY HAUL',
  'COAST LOGISTICS',
  'SUMMIT FREIGHT',
  'TITAN MOTORS',
  'PACIFIC ROUTE',
  'LIBERTY HAUL',
  'PRIME FLEET',
]

const revealVariants = {
  visible: (i: number) => ({
    y: 0, opacity: 1, filter: "blur(0px)",
    transition: { delay: i * 0.15, duration: 0.5 },
  }),
  hidden: { filter: "blur(10px)", y: 20, opacity: 0 },
}

export function LogoStrip() {
  const sectionRef = useRef<HTMLDivElement>(null)

  return (
    <section ref={sectionRef} className="border-y border-border-subtle bg-background py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <TimelineContent as="div" animationNum={0} timelineRef={sectionRef} customVariants={revealVariants}>
          <p className="text-center text-sm text-muted-foreground">
            Trusted by carriers hauling 10,000+ vehicles per month
          </p>
        </TimelineContent>
        <TimelineContent as="div" animationNum={1} timelineRef={sectionRef} customVariants={revealVariants}>
          <div className="overflow-hidden marquee-fade-mask mt-6 group">
            <div className="flex animate-marquee w-max gap-x-12">
              {[...carriers, ...carriers].map((name, i) => (
                <span key={`${name}-${i}`} className="flex items-center gap-0">
                  <span className="text-lg font-bold uppercase tracking-[0.25em] text-muted-foreground/40 transition-colors hover:text-muted-foreground/60 whitespace-nowrap select-none">
                    {name}
                  </span>
                  <span className="text-muted-foreground/20 mx-2">◆</span>
                </span>
              ))}
            </div>
          </div>
        </TimelineContent>
      </div>
    </section>
  )
}
