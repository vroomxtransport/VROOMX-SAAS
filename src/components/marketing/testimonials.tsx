'use client'

import { useRef } from 'react'
import { TimelineContent } from '@/components/ui/timeline-animation'
import { VerticalCutReveal } from '@/components/ui/vertical-cut-reveal'
import { TestimonialsColumns } from '@/components/ui/testimonials-columns-1'

const revealVariants = {
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    filter: 'blur(0px)',
    transition: { delay: i * 0.15, duration: 0.5 },
  }),
  hidden: { filter: 'blur(10px)', y: 20, opacity: 0 },
}

export function Testimonials() {
  const sectionRef = useRef<HTMLDivElement>(null)

  return (
    <section ref={sectionRef} className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <TimelineContent
            as="div"
            animationNum={0}
            timelineRef={sectionRef}
            customVariants={revealVariants}
          >
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              <VerticalCutReveal
                splitBy="words"
                staggerDuration={0.15}
                staggerFrom="first"
                reverse={true}
                containerClassName="justify-center"
                transition={{ type: 'spring', stiffness: 250, damping: 40 }}
              >
                Trusted by Carriers Nationwide
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
              See why hundreds of auto transport operators rely on VroomX to run
              their fleets.
            </p>
          </TimelineContent>
        </div>

        <div className="mt-16">
          <TimelineContent
            as="div"
            animationNum={2}
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
