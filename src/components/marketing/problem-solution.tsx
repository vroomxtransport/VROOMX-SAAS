'use client'

import { useRef } from 'react'
import { X, CheckCircle, ArrowRight } from 'lucide-react'
import { TimelineContent } from '@/components/ui/timeline-animation'
import { VerticalCutReveal } from '@/components/ui/vertical-cut-reveal'

const problems = [
  {
    title: 'Spreadsheet juggling',
    description:
      'Orders scattered across Excel files, Google Sheets, and email threads. Nothing synced, nothing reliable.',
  },
  {
    title: 'Payment tracking chaos',
    description:
      'Chasing invoices manually, losing track of who paid what, and reconciling at month-end in a panic.',
  },
  {
    title: 'Zero fleet visibility',
    description:
      'No idea where your trucks are, which drivers are available, or how much capacity you actually have.',
  },
  {
    title: 'Manual paperwork everywhere',
    description:
      'Handwritten BOLs, photo inspections lost in camera rolls, and condition reports you can never find.',
  },
]

const solutions = [
  {
    title: 'Single command center',
    description:
      'Every order, trip, truck, and driver in one dashboard. Real-time pipeline from intake to delivery.',
  },
  {
    title: 'Automated invoicing',
    description:
      'Generate branded PDF invoices, email them directly, and track payments with aging analysis built in.',
  },
  {
    title: 'Real-time fleet tracking',
    description:
      'See every truck on the road, monitor driver assignments, and know your live capacity at a glance.',
  },
  {
    title: 'Digital BOL & inspections',
    description:
      'Drivers capture inspections on mobile with photos and signatures. BOLs generated and stored automatically.',
  },
]

const revealVariants = {
  visible: (i: number) => ({
    y: 0, opacity: 1, filter: "blur(0px)",
    transition: { delay: i * 0.15, duration: 0.5 },
  }),
  hidden: { filter: "blur(10px)", y: 20, opacity: 0 },
}

export function ProblemSolution() {
  const sectionRef = useRef<HTMLDivElement>(null)

  return (
    <section ref={sectionRef} className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <TimelineContent as="div" animationNum={0} timelineRef={sectionRef} customVariants={revealVariants}>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              The old way is{' '}
              <span className="relative">
                costing you loads
                <span className="absolute inset-x-0 -bottom-1 h-3 bg-red-500/10 rounded-sm -skew-x-6" />
              </span>
            </h2>
          </TimelineContent>
          <TimelineContent as="div" animationNum={1} timelineRef={sectionRef} customVariants={revealVariants}>
            <p className="mt-4 text-lg text-muted-foreground">
              Most carriers run their fleet on duct tape and spreadsheets.
              There&apos;s a better way.
            </p>
          </TimelineContent>
        </div>

        <div className="relative mt-16 grid gap-8 lg:grid-cols-2 lg:gap-16">
          {/* Problems */}
          <TimelineContent as="div" animationNum={2} timelineRef={sectionRef} customVariants={revealVariants}>
            <div className="rounded-2xl border border-red-200/50 bg-gradient-to-br from-red-50/40 to-transparent p-8 dark:border-red-500/10 dark:from-red-950/20">
              <div className="flex items-center gap-3 mb-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
                  <X className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-600 dark:text-red-400">The Problem</h3>
                  <p className="text-xs text-red-500/60">What you deal with every day</p>
                </div>
              </div>
              <div className="space-y-5">
                {problems.map((item) => (
                  <div key={item.title} className="flex gap-4 group">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/10 ring-2 ring-red-500/10 transition-colors group-hover:bg-red-500/20">
                      <X className="h-3.5 w-3.5 text-red-500" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{item.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TimelineContent>

          {/* Connecting arrow */}
          <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-surface shadow-sm">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Solutions */}
          <TimelineContent as="div" animationNum={3} timelineRef={sectionRef} customVariants={revealVariants}>
            <div className="rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/40 to-transparent p-8 dark:border-emerald-500/10 dark:from-emerald-950/20 relative">
              {/* Subtle glow */}
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-8">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-emerald-600 dark:text-emerald-400">The VroomX Way</h3>
                    <p className="text-xs text-emerald-500/60">How it should work</p>
                  </div>
                </div>
                <div className="space-y-5">
                  {solutions.map((item) => (
                    <div key={item.title} className="flex gap-4 group">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 ring-2 ring-emerald-500/10 transition-colors group-hover:bg-emerald-500/20">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{item.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </div>
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
