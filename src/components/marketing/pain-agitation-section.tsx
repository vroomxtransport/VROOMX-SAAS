'use client'

import { useRef } from 'react'
import { TimelineContent } from '@/components/ui/timeline-animation'

const painPoints = [
  'You delivered 52 loads last month. Your profit? You have no idea because your system can\'t calculate Clean Gross.',
  'Your driver says 70%. Your notes say 65%. There\'s no single source of truth, so you\'re writing a check and eating the difference.',
  'A broker owes you $8,000 from 45 days ago. You have no aging report, no payment history, no leverage.',
  'Your dispatcher quit Friday. Monday morning, you discovered the entire operation lived in her head and a Google Sheet.',
  'DOT pulled your driver over. His medical card expired three weeks ago. Your software didn\'t warn you because it doesn\'t track compliance.',
  'It\'s Friday night. You\'ve been hand-calculating settlements since 6 PM because your tool has no settlement engine.',
  'You\'re paying 30% per seat for a platform that can\'t tell you which truck is profitable. That\'s not a TMS. That\'s a subscription to confusion.',
  'Your dispatch tool calls itself a TMS, but it\'s a load board with an invoice button. No analytics. No driver pay models. No financial reporting.',
  'You added two drivers this quarter. Your software bill jumped $200/month. Meanwhile, you still can\'t see profit per mile.',
]

const revealVariants = {
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    filter: 'blur(0px)',
    transition: { delay: i * 0.15, duration: 0.5 },
  }),
  hidden: { filter: 'blur(10px)', y: 20, opacity: 0 },
}

export function PainAgitationSection() {
  const sectionRef = useRef<HTMLDivElement>(null)

  return (
    <section
      ref={sectionRef}
      className="bg-background py-20 sm:py-28 lg:py-32"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <TimelineContent
            as="div"
            animationNum={0}
            timelineRef={sectionRef}
            customVariants={revealVariants}
          >
            <p className="section-kicker mb-3">Every carrier knows this</p>
          </TimelineContent>
          <TimelineContent
            as="div"
            animationNum={1}
            timelineRef={sectionRef}
            customVariants={revealVariants}
          >
            <h2 className="text-3xl font-bold tracking-[-0.015em] sm:text-4xl lg:text-[2.75rem]">
              This is costing you money right now
            </h2>
          </TimelineContent>
        </div>

        {/* Pain point grid */}
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
          {painPoints.map((point, idx) => (
            <TimelineContent
              key={idx}
              as="div"
              animationNum={idx + 2}
              timelineRef={sectionRef}
              customVariants={revealVariants}
            >
              <div className="group rounded-xl border border-border-subtle bg-surface/50 p-5 sm:p-6 transition-colors duration-200 hover:bg-surface border-l-2 border-l-brand/30">
                <p className="text-[15px] leading-relaxed text-muted-foreground italic">
                  &ldquo;{point}&rdquo;
                </p>
              </div>
            </TimelineContent>
          ))}
        </div>

        {/* Closing line */}
        <TimelineContent
          as="div"
          animationNum={painPoints.length + 2}
          timelineRef={sectionRef}
          customVariants={revealVariants}
        >
          <p className="mx-auto mt-14 max-w-2xl text-center text-lg font-medium text-foreground">
            VroomX TMS exists because we ran trucks, lived these problems, and got tired of paying for tools that didn&rsquo;t solve them.{' '}
            <span className="text-brand">
              Here&rsquo;s what a real TMS looks like.
            </span>
          </p>
        </TimelineContent>
      </div>
    </section>
  )
}
