'use client'

import Image from 'next/image'
import { useRef } from 'react'
import { BrowserFrame } from './browser-frame'
import { DeviceFrame } from './device-frame'
import { TimelineContent } from '@/components/ui/timeline-animation'

const revealVariants = {
  visible: (i: number) => ({
    y: 0, opacity: 1, filter: "blur(0px)",
    transition: { delay: i * 0.15, duration: 0.5 },
  }),
  hidden: { filter: "blur(10px)", y: 20, opacity: 0 },
}

function OrdersMockup() {
  return (
    <div className="h-[300px] bg-background p-3">
      {/* Header */}
      <div className="flex items-center justify-between rounded-md border border-border-subtle bg-surface px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 rounded bg-foreground/20" />
          <div className="h-5 w-px bg-border-subtle" />
          <div className="h-2 w-10 rounded bg-muted-foreground/15" />
        </div>
        <div className="h-5 w-20 rounded bg-brand/20" />
      </div>
      {/* Filter bar */}
      <div className="mt-2 flex gap-2">
        {['All', 'Active', 'Delivered', 'Invoiced'].map((f) => (
          <div
            key={f}
            className="h-5 rounded-md bg-muted px-3 text-[8px] leading-5 text-muted-foreground/60"
          >
            {f}
          </div>
        ))}
      </div>
      {/* Table */}
      <div className="mt-2 rounded-md border border-border-subtle bg-surface">
        <div className="flex gap-3 border-b border-border-subtle px-3 py-2">
          <div className="h-1.5 w-14 rounded bg-muted-foreground/20" />
          <div className="h-1.5 w-20 rounded bg-muted-foreground/20" />
          <div className="h-1.5 w-16 rounded bg-muted-foreground/20" />
          <div className="h-1.5 w-12 rounded bg-muted-foreground/20" />
          <div className="ml-auto h-1.5 w-10 rounded bg-muted-foreground/20" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border-subtle px-3 py-2.5 last:border-0"
          >
            <div className="h-1.5 w-14 rounded bg-foreground/12" />
            <div className="h-1.5 w-20 rounded bg-foreground/8" />
            <div className="h-1.5 w-16 rounded bg-foreground/8" />
            <div
              className={`h-4 w-14 rounded-full ${
                i % 3 === 0
                  ? 'bg-emerald-500/15'
                  : i % 3 === 1
                    ? 'bg-amber-500/15'
                    : 'bg-blue-500/15'
              }`}
            />
            <div className="ml-auto h-1.5 w-10 rounded bg-foreground/8" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ProductShowcase() {
  const sectionRef = useRef<HTMLDivElement>(null)

  return (
    <section id="product" ref={sectionRef} className="bg-background py-20 sm:py-28 lg:py-36">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <TimelineContent as="div" animationNum={0} timelineRef={sectionRef} customVariants={revealVariants}>
            <p className="section-kicker mb-3">Product</p>
          </TimelineContent>
          <TimelineContent as="div" animationNum={1} timelineRef={sectionRef} customVariants={revealVariants}>
            <h2 className="text-3xl font-bold tracking-[-0.015em] sm:text-4xl lg:text-[2.75rem] text-foreground">
              See VroomX TMS in action
            </h2>
          </TimelineContent>
          <TimelineContent as="div" animationNum={2} timelineRef={sectionRef} customVariants={revealVariants}>
            <p className="mt-4 text-base sm:text-lg leading-relaxed text-muted-foreground">
              Purpose-built screens for every part of your auto transport workflow.
            </p>
          </TimelineContent>
        </div>

        {/* Screenshot gallery — 3 items */}
        <div className="mt-16 lg:mt-20 grid gap-8 lg:grid-cols-3 items-end">
          {/* Dispatch Board */}
          <TimelineContent as="div" animationNum={3} timelineRef={sectionRef} customVariants={revealVariants}>
            <div className="lg:col-span-1">
              <BrowserFrame>
                <Image
                  src="/images/dispatch-board.png"
                  alt="VroomX Dispatch Board — Kanban trip management"
                  width={1661}
                  height={907}
                  className="w-full h-auto"
                />
              </BrowserFrame>
              <p className="mt-3 text-center text-sm font-medium text-muted-foreground">Dispatch Board</p>
            </div>
          </TimelineContent>

          {/* Orders — code-drawn mockup in BrowserFrame */}
          <TimelineContent as="div" animationNum={4} timelineRef={sectionRef} customVariants={revealVariants}>
            <div className="lg:col-span-1">
              <BrowserFrame>
                <OrdersMockup />
              </BrowserFrame>
              <p className="mt-3 text-center text-sm font-medium text-muted-foreground">Order Management</p>
            </div>
          </TimelineContent>

          {/* Driver App — in phone frame */}
          <TimelineContent as="div" animationNum={5} timelineRef={sectionRef} customVariants={revealVariants}>
            <div className="lg:col-span-1 flex flex-col items-center">
              <div className="max-w-[200px]">
                <DeviceFrame>
                  <Image
                    src="/images/driver-app-inspection.png"
                    alt="VroomX Driver App — Vehicle Inspection"
                    width={160}
                    height={340}
                    className="w-full h-auto"
                  />
                </DeviceFrame>
              </div>
              <p className="mt-3 text-center text-sm font-medium text-muted-foreground">Driver App</p>
            </div>
          </TimelineContent>
        </div>
      </div>
    </section>
  )
}
