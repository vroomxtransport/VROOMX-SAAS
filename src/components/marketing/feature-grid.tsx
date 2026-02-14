'use client'

import { useRef } from 'react'
import {
  ClipboardList,
  Route,
  Smartphone,
  Receipt,
  Truck,
  ShieldCheck,
} from 'lucide-react'
import { TimelineContent } from '@/components/ui/timeline-animation'
import { VerticalCutReveal } from '@/components/ui/vertical-cut-reveal'

const features = [
  {
    icon: ClipboardList,
    title: 'Load Management',
    description:
      'Create and track vehicle transport orders with VIN decoding, multi-step intake wizards, and real-time status updates from new to delivered.',
    gradient: 'from-blue-500 to-blue-600',
  },
  {
    icon: Route,
    title: 'Smart Dispatch',
    description:
      'Build optimized trips, assign orders and drivers, visualize routes on a Kanban board, and auto-calculate driver pay across three pay models.',
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    icon: Smartphone,
    title: 'Driver Mobile App',
    description:
      'Native iOS app with offline-capable inspections, photo and video capture, digital BOL generation, and real-time order status updates.',
    gradient: 'from-cyan-500 to-blue-500',
  },
  {
    icon: Receipt,
    title: 'Automated Billing',
    description:
      'Generate branded PDF invoices, send via email, record payments, and track receivables with aging analysis and collection metrics.',
    gradient: 'from-emerald-500 to-green-600',
  },
  {
    icon: Truck,
    title: 'Fleet Operations',
    description:
      'Manage trucks, trailers, and drivers in one place. Track documents with expiry alerts, upload CDLs and medical cards, monitor fleet health.',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise Security',
    description:
      'Row-level security isolates every carrier. Role-based access, team invitations, and SOC-2 aligned infrastructure you can trust.',
    gradient: 'from-rose-500 to-pink-600',
  },
]

const revealVariants = {
  visible: (i: number) => ({
    y: 0, opacity: 1, filter: "blur(0px)",
    transition: { delay: i * 0.15, duration: 0.5 },
  }),
  hidden: { filter: "blur(10px)", y: 20, opacity: 0 },
}

export function FeatureGrid() {
  const sectionRef = useRef<HTMLDivElement>(null)

  return (
    <section ref={sectionRef} className="relative border-t border-border-subtle bg-muted/30 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <TimelineContent as="div" animationNum={0} timelineRef={sectionRef} customVariants={revealVariants}>
            <p className="text-sm font-semibold text-brand uppercase tracking-wider mb-3">
              Platform
            </p>
          </TimelineContent>
          <TimelineContent as="div" animationNum={1} timelineRef={sectionRef} customVariants={revealVariants}>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              <VerticalCutReveal splitBy="words" staggerDuration={0.15} staggerFrom="first" reverse={true} containerClassName="justify-center"
                transition={{ type: "spring", stiffness: 250, damping: 40 }}>
                Everything you need to run your fleet
              </VerticalCutReveal>
            </h2>
          </TimelineContent>
          <TimelineContent as="div" animationNum={2} timelineRef={sectionRef} customVariants={revealVariants}>
            <p className="mt-4 text-lg text-muted-foreground">
              From load intake to final payment — one platform, zero spreadsheets.
            </p>
          </TimelineContent>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, idx) => (
            <TimelineContent key={feature.title} as="div" animationNum={3 + idx} timelineRef={sectionRef} customVariants={revealVariants}>
              <div className="group rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm transition-all duration-200 hover:border-border hover:shadow-md card-hover">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${feature.gradient}`}>
                  <feature.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="mt-4 text-base font-bold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </TimelineContent>
          ))}
        </div>
      </div>
    </section>
  )
}
