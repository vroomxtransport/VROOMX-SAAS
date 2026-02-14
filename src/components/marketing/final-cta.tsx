'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { TimelineContent } from '@/components/ui/timeline-animation'

const revealVariants = {
  visible: (i: number) => ({
    y: 0, opacity: 1, filter: "blur(0px)",
    transition: { delay: i * 0.15, duration: 0.5 },
  }),
  hidden: { filter: "blur(10px)", y: 20, opacity: 0 },
}

export function FinalCTA() {
  const sectionRef = useRef<HTMLDivElement>(null)

  return (
    <section ref={sectionRef} className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <TimelineContent as="div" animationNum={0} timelineRef={sectionRef} customVariants={revealVariants}>
            {/* Gradient border wrapper */}
            <div className="rounded-2xl bg-gradient-to-br from-brand to-amber-500 p-px shadow-lg">
              {/* Inner card */}
              <div className="rounded-[calc(1rem-1px)] bg-surface p-8 text-center sm:p-12">
                <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                  Ready to modernize your auto transport business?
                </h2>
                <p className="mt-4 text-lg text-muted-foreground">
                  Join carriers who are dispatching smarter and delivering faster
                  with VroomX.
                </p>

                <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Link
                    href="/signup"
                    className="group inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-brand to-amber-500 px-6 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:brightness-110"
                  >
                    Start Free Trial
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <Link
                    href="/pricing"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border-subtle bg-background px-6 text-sm font-medium text-foreground transition-all hover:bg-accent hover:border-border"
                  >
                    Compare Plans
                  </Link>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground">
                  {['14-day free trial', 'No credit card', 'Cancel anytime'].map((item) => (
                    <span key={item} className="flex items-center gap-1.5">
                      <Check className="h-4 w-4 text-emerald-500" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </TimelineContent>
        </div>
      </div>
    </section>
  )
}
