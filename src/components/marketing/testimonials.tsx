'use client'

import { useRef } from 'react'
import { Star } from 'lucide-react'
import { TimelineContent } from '@/components/ui/timeline-animation'
import { VerticalCutReveal } from '@/components/ui/vertical-cut-reveal'

const testimonials = [
  {
    quote:
      'We went from dispatching 40 vehicles a week on spreadsheets to 120 a week on VroomX. The Kanban board alone saved us 2 hours a day in coordination calls.',
    name: 'Marcus Rivera',
    role: 'Operations Manager',
    company: 'Apex Auto Transport',
    initials: 'MR',
    accent: 'blue' as const,
  },
  {
    quote:
      'Invoicing used to take our office manager a full day every Friday. Now it takes 15 minutes. The automated PDF generation with BOL attachments is a game-changer.',
    name: 'Sarah Chen',
    role: 'Owner',
    company: 'Pacific Fleet Carriers',
    initials: 'SC',
    accent: 'violet' as const,
  },
  {
    quote:
      'Our drivers actually like using the app. Photo inspections, digital BOLs, real-time status updates — everything they need without calling the office.',
    name: 'James Okafor',
    role: 'Fleet Director',
    company: 'Eagle Transport LLC',
    initials: 'JO',
    accent: 'emerald' as const,
  },
]

const accentBorders = {
  blue: 'bg-blue-500',
  violet: 'bg-violet-500',
  emerald: 'bg-emerald-500',
}

const revealVariants = {
  visible: (i: number) => ({
    y: 0, opacity: 1, filter: "blur(0px)",
    transition: { delay: i * 0.15, duration: 0.5 },
  }),
  hidden: { filter: "blur(10px)", y: 20, opacity: 0 },
}

export function Testimonials() {
  const sectionRef = useRef<HTMLDivElement>(null)

  return (
    <section ref={sectionRef} className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <TimelineContent as="div" animationNum={0} timelineRef={sectionRef} customVariants={revealVariants}>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              <VerticalCutReveal splitBy="words" staggerDuration={0.15} staggerFrom="first" reverse={true} containerClassName="justify-center"
                transition={{ type: "spring", stiffness: 250, damping: 40 }}>
                What carriers are saying
              </VerticalCutReveal>
            </h2>
          </TimelineContent>
          <TimelineContent as="div" animationNum={1} timelineRef={sectionRef} customVariants={revealVariants}>
            <p className="mt-4 text-lg text-muted-foreground">
              Real feedback from auto transport operators running their fleets on
              VroomX.
            </p>
          </TimelineContent>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-6 md:grid-cols-3">
          {testimonials.map((t, idx) => (
            <TimelineContent key={t.name} as="div" animationNum={2 + idx} timelineRef={sectionRef} customVariants={revealVariants}>
              <div className="relative rounded-xl border border-border-subtle bg-surface p-6 shadow-sm transition-all duration-200 hover:border-border hover:shadow-md card-hover">
                <div className={`absolute left-0 top-4 bottom-4 w-[2px] rounded-full ${accentBorders[t.accent]}`} />

                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>

                <blockquote className="mt-4 text-sm leading-relaxed text-foreground/80">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>

                <div className="mt-6 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.role}, {t.company}
                    </p>
                  </div>
                </div>
              </div>
            </TimelineContent>
          ))}
        </div>
      </div>
    </section>
  )
}
