'use client'

import { useRef } from 'react'

import { TimelineContent } from '@/components/ui/timeline-animation'
import { VerticalCutReveal } from '@/components/ui/vertical-cut-reveal'
import { TestimonialsColumns, testimonials } from '@/components/ui/testimonials-columns-1'

const revealVariants = {
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    filter: 'blur(0px)',
    transition: { delay: i * 0.15, duration: 0.5 },
  }),
  hidden: { filter: 'blur(10px)', y: 20, opacity: 0 },
}

const featuredTestimonial = testimonials.find(t => t.name === "Tom O'Brien")

export function Testimonials() {
  const sectionRef = useRef<HTMLDivElement>(null)

  return (
    <section ref={sectionRef} className="bg-background py-20 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <TimelineContent
            as="div"
            animationNum={0}
            timelineRef={sectionRef}
            customVariants={revealVariants}
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              <VerticalCutReveal
                splitBy="words"
                staggerDuration={0.15}
                staggerFrom="first"
                reverse={true}
                containerClassName="justify-center"
                transition={{ type: 'spring', stiffness: 250, damping: 40 }}
              >
                They switched. Here&apos;s what happened.
              </VerticalCutReveal>
            </h2>
          </TimelineContent>
          <TimelineContent
            as="div"
            animationNum={1}
            timelineRef={sectionRef}
            customVariants={revealVariants}
          >
            <p className="mt-4 text-lg text-muted-foreground">
              From spreadsheets and legacy dispatch tools to real financial visibility. Solo operators to 120-truck fleets.
            </p>
          </TimelineContent>
        </div>

        {featuredTestimonial && (
          <TimelineContent
            as="div"
            animationNum={2}
            timelineRef={sectionRef}
            customVariants={revealVariants}
          >
            <div className="mx-auto max-w-3xl mt-12">
              <div className="widget-card-primary rounded-2xl p-8 sm:p-10 text-center">
                <blockquote className="text-lg sm:text-xl leading-relaxed text-foreground font-medium">
                  &ldquo;{featuredTestimonial.quote}&rdquo;
                </blockquote>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand">
                    TO
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">Tom O&apos;Brien</p>
                    <p className="text-xs text-muted-foreground">Owner, Tri-State Auto Movers · 30 trucks</p>
                  </div>
                </div>
              </div>
            </div>
          </TimelineContent>
        )}

        <div className="mt-16">
          <TimelineContent
            as="div"
            animationNum={3}
            timelineRef={sectionRef}
            customVariants={revealVariants}
          >
            <TestimonialsColumns />
          </TimelineContent>
        </div>
      </div>
    </section>
  )
}
