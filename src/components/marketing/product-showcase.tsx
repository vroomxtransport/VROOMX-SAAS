'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { BrowserFrame } from './browser-frame'
import { TimelineContent } from '@/components/ui/timeline-animation'
import { VerticalCutReveal } from '@/components/ui/vertical-cut-reveal'

function DispatchMockup() {
  return (
    <Image
      src="/images/dispatch-board.png"
      alt="VroomX Dispatch Board - Kanban trip management"
      width={1661}
      height={907}
      className="w-full h-auto"
    />
  )
}

function OrdersMockup() {
  return (
    <div className="h-[300px] bg-[#f9f8f6] p-3">
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
            className="h-5 rounded-md bg-muted px-3 text-[8px] leading-5 text-muted-foreground/40"
          >
            {f}
          </div>
        ))}
      </div>
      {/* Table */}
      <div className="mt-2 rounded-md border border-border-subtle bg-surface">
        {/* Header row */}
        <div className="flex gap-3 border-b border-border-subtle px-3 py-2">
          <div className="h-1.5 w-14 rounded bg-muted-foreground/20" />
          <div className="h-1.5 w-20 rounded bg-muted-foreground/20" />
          <div className="h-1.5 w-16 rounded bg-muted-foreground/20" />
          <div className="h-1.5 w-12 rounded bg-muted-foreground/20" />
          <div className="ml-auto h-1.5 w-10 rounded bg-muted-foreground/20" />
        </div>
        {/* Data rows */}
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

function DriverAppMockup() {
  return (
    <div className="flex h-[300px] items-center justify-center rounded-2xl border border-border-subtle bg-muted p-6">
      <Image
        src="/images/driver-app-inspection.png"
        alt="VroomX Driver App - Vehicle Inspection"
        width={160}
        height={280}
        className="h-full w-auto object-contain"
      />
    </div>
  )
}

const revealVariants = {
  visible: (i: number) => ({
    y: 0, opacity: 1, filter: "blur(0px)",
    transition: { delay: i * 0.15, duration: 0.5 },
  }),
  hidden: { filter: "blur(10px)", y: 20, opacity: 0 },
}

export function ProductShowcase() {
  const sectionRef = useRef<HTMLDivElement>(null)

  return (
    <section ref={sectionRef} id="product" className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <TimelineContent as="div" animationNum={0} timelineRef={sectionRef} customVariants={revealVariants}>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              <VerticalCutReveal splitBy="words" staggerDuration={0.15} staggerFrom="first" reverse={true} containerClassName="justify-center"
                transition={{ type: "spring", stiffness: 250, damping: 40 }}>
                See VroomX in action
              </VerticalCutReveal>
            </h2>
          </TimelineContent>
          <TimelineContent as="div" animationNum={1} timelineRef={sectionRef} customVariants={revealVariants}>
            <p className="mt-4 text-lg text-muted-foreground">
              Purpose-built screens for every part of your auto transport workflow.
            </p>
          </TimelineContent>
        </div>

        <TimelineContent as="div" animationNum={2} timelineRef={sectionRef} customVariants={revealVariants}>
          <div className="mx-auto mt-12 max-w-4xl">
            <Tabs defaultValue="dispatch">
              <div className="flex justify-center">
                <TabsList>
                  <TabsTrigger value="dispatch">Dispatch Board</TabsTrigger>
                  <TabsTrigger value="orders">Order Management</TabsTrigger>
                  <TabsTrigger value="driver">Driver App</TabsTrigger>
                </TabsList>
              </div>

              <div className="mt-8">
                <TabsContent value="dispatch">
                  <BrowserFrame>
                    <DispatchMockup />
                  </BrowserFrame>
                </TabsContent>
                <TabsContent value="orders">
                  <BrowserFrame>
                    <OrdersMockup />
                  </BrowserFrame>
                </TabsContent>
                <TabsContent value="driver">
                  <DriverAppMockup />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </TimelineContent>
      </div>
    </section>
  )
}
