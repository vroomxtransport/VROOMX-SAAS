'use client'

import { motion } from 'motion/react'
export interface Testimonial {
  name: string
  role: string
  company: string
  quote: string
  fleetSize?: string
}

export const testimonials: Testimonial[] = [
  {
    name: 'Mike Rodriguez',
    role: 'Operations Manager',
    company: 'Elite Auto Transport',
    quote: 'We went from dispatching 12 loads a week to 38 loads a week without adding a single office hire. The Kanban board alone saved us 15 hours a week in coordination.',
    fleetSize: '15 trucks',
  },
  {
    name: 'James Walker',
    role: 'Owner',
    company: 'Walker Vehicle Logistics',
    quote: 'We grew from 2 trucks to 15 in eighteen months using VroomX. The platform scaled with us seamlessly. Billing, driver management, trip planning, everything just worked as we expanded.',
    fleetSize: '15 trucks',
  },
  {
    name: 'Lisa Thompson',
    role: 'Dispatcher',
    company: 'Nationwide Auto Shipping',
    quote: 'Our drivers actually love the mobile app. Digital BOLs, photo inspections at pickup and delivery, real-time status updates. It eliminated 90% of our back-and-forth phone calls.',
    fleetSize: '45 trucks',
  },
  {
    name: 'Amanda Foster',
    role: 'Billing Manager',
    company: 'Summit Auto Carriers',
    quote: 'Invoicing used to eat my entire Friday, 6 hours minimum. Now VroomX generates and emails invoices in under 4 minutes. We went from billing weekly to billing same-day.',
    fleetSize: '25 trucks',
  },
  {
    name: "Tom O'Brien",
    role: 'Owner',
    company: 'Tri-State Auto Movers',
    quote: 'First quarter on VroomX, I realized I was actually profitable on runs I thought I was losing money on. Between automated invoicing and real settlement calculations, it paid for itself in week one.',
    fleetSize: '30 trucks',
  },
  {
    name: 'Carlos Mendez',
    role: 'Owner-Operator',
    company: 'Mendez Transport',
    quote: 'Last year I found out my spreadsheet had been miscalculating my dispatch fees by $340 a month. VroomX caught it on day one. Every settlement is calculated to the penny now.',
    fleetSize: '3 trucks',
  },
  {
    name: 'David Chen',
    role: 'Owner',
    company: 'Pacific Auto Carriers',
    quote: 'I was terrified to switch. We had 2 years of orders in spreadsheets. The CSV import pulled everything in within 20 minutes. My dispatcher was faster on VroomX by day 2 than she ever was on our old system.',
    fleetSize: '8 trucks',
  },
  {
    name: 'Rachel Martinez',
    role: 'Safety Manager',
    company: 'Heartland Vehicle Transport',
    quote: 'FMCSA showed up for a random audit. I pulled every driver\'s medical card, CDL, and inspection cert in 30 seconds from my phone. The officer said it was the fastest audit he\'d ever done.',
    fleetSize: '22 trucks',
  },
]

const columns: [Testimonial[], Testimonial[], Testimonial[]] = [
  [testimonials[0], testimonials[1], testimonials[6]],
  [testimonials[2], testimonials[3], testimonials[7]],
  [testimonials[4], testimonials[5]],
]

const columnDurations = [25, 30, 20]

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface shadow-sm p-5">
      <blockquote className="text-sm leading-relaxed text-foreground/70">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>
      <div className="mt-4 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
          {testimonial.name.split(' ').map(n => n[0]).join('')}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {testimonial.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {testimonial.role}, {testimonial.company}
          </p>
          {testimonial.fleetSize && (
            <p className="text-[10px] text-brand/60">{testimonial.fleetSize}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function ScrollColumn({
  items,
  duration,
  className,
}: {
  items: Testimonial[]
  duration: number
  className?: string
}) {
  const doubled = [...items, ...items]

  return (
    <div className={`overflow-hidden ${className ?? ''}`}>
      <motion.div
        animate={{ y: ['0%', '-50%'] }}
        transition={{
          y: {
            duration,
            ease: 'linear',
            repeat: Infinity,
          },
        }}
        className="flex flex-col gap-4"
      >
        {doubled.map((testimonial, idx) => (
          <TestimonialCard key={`${testimonial.name}-${idx}`} testimonial={testimonial} />
        ))}
      </motion.div>
    </div>
  )
}

export function TestimonialsColumns() {
  return (
    <div
      className="relative mx-auto max-h-[600px] max-w-5xl overflow-hidden"
      style={{
        maskImage:
          'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
      }}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {columns.map((col, i) => (
          <ScrollColumn
            key={i}
            items={col}
            duration={columnDurations[i]}
            className={i === 1 ? 'hidden md:block' : i === 2 ? 'hidden lg:block' : ''}
          />
        ))}
      </div>
    </div>
  )
}
