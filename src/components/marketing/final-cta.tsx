'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
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
    <section ref={sectionRef} className="bg-background py-20 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <TimelineContent as="div" animationNum={0} timelineRef={sectionRef} customVariants={revealVariants}>
            {/* Gradient border wrapper */}
            <div className="rounded-2xl bg-gradient-to-br from-brand to-[#2a3a4f] p-px shadow-lg">
              {/* Inner card */}
              <div className="rounded-[calc(1rem-1px)] bg-surface p-8 text-center sm:p-12">
                <h2 className="text-3xl font-bold tracking-[-0.015em] text-foreground sm:text-4xl lg:text-[2.75rem]">
                  Every mile you run without knowing your numbers is money you&apos;ll never get back
                </h2>
                <p className="mt-4 text-lg text-muted-foreground">
                  200+ carriers stopped guessing and started seeing Clean Gross, driver costs, and net profit on every load. Most set up in under 5 minutes.
                </p>

                <div className="mt-6 flex items-center justify-center gap-3 text-sm text-muted-foreground">
                  <span className="italic text-foreground/70">&ldquo;I found $4,100/month in hidden losses in my first week.&rdquo;</span>
                  <span className="ml-1 not-italic font-medium text-foreground">Carlos M., 3 trucks</span>
                </div>

                <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Link
                    href="/signup"
                    className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand to-[#2a3a4f] px-6 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:brightness-110"
                  >
                    Start Your Free Trial
                    <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <Link
                    href="/pricing"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border-subtle bg-background px-6 text-sm font-medium text-foreground transition-all hover:bg-accent hover:border-border"
                  >
                    See Pricing
                  </Link>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground">
                  {['No credit card required', 'Set up in 5 minutes', 'Cancel anytime'].map((item) => (
                    <span key={item} className="flex items-center gap-1.5">
                      <HugeiconsIcon icon={Tick02Icon} size={16} className="text-emerald-500" />
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
