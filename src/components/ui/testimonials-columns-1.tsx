'use client'

import { motion } from 'motion/react'
import { Star } from 'lucide-react'

export interface Testimonial {
  name: string
  role: string
  company: string
  quote: string
  avatar: string
  rating: number
}

export const testimonials: Testimonial[] = [
  {
    name: 'Mike Rodriguez',
    role: 'Operations Manager',
    company: 'Elite Auto Transport',
    quote:
      'VroomX transformed our dispatching workflow completely. We cut coordination time in half with the Kanban board and now move 3x more vehicles per week without adding office staff.',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    rating: 5,
  },
  {
    name: 'Sarah Chen',
    role: 'Fleet Director',
    company: 'Pacific Coast Carriers',
    quote:
      'The fleet tracking and maintenance alert system saved us from two potential breakdowns last month alone. Having real-time visibility into every truck across our routes is invaluable.',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    rating: 5,
  },
  {
    name: 'James Walker',
    role: 'Owner',
    company: 'Walker Vehicle Logistics',
    quote:
      'We grew from 2 trucks to 15 in eighteen months using VroomX. The platform scaled with us seamlessly — billing, driver management, trip planning — everything just worked as we expanded.',
    avatar: 'https://randomuser.me/api/portraits/men/52.jpg',
    rating: 5,
  },
  {
    name: 'Lisa Thompson',
    role: 'Dispatcher',
    company: 'Nationwide Auto Shipping',
    quote:
      'Our drivers actually love the mobile app. Digital BOLs, photo inspections at pickup and delivery, real-time status updates — it eliminated 90% of our back-and-forth phone calls.',
    avatar: 'https://randomuser.me/api/portraits/women/28.jpg',
    rating: 5,
  },
  {
    name: 'Carlos Mendez',
    role: 'Owner-Operator',
    company: 'Mendez Transport',
    quote:
      'Finally, transparent pay breakdowns I can actually trust. VroomX shows me exactly how my settlement is calculated — dispatch fees, deductions, everything. No more surprises on payday.',
    avatar: 'https://randomuser.me/api/portraits/men/67.jpg',
    rating: 5,
  },
  {
    name: 'Amanda Foster',
    role: 'Billing Manager',
    company: 'Summit Auto Carriers',
    quote:
      'Invoicing used to take me an entire Friday. Now VroomX auto-generates professional invoices with BOL attachments in minutes. Our cash flow improved because we bill same-day now.',
    avatar: 'https://randomuser.me/api/portraits/women/55.jpg',
    rating: 5,
  },
  {
    name: 'David Kim',
    role: 'Regional Manager',
    company: 'CrossCountry Vehicle Transport',
    quote:
      'Managing drivers and trucks across three states was a nightmare before VroomX. Now I have one dashboard showing every active trip, every available driver, and every vehicle in our fleet.',
    avatar: 'https://randomuser.me/api/portraits/men/75.jpg',
    rating: 5,
  },
  {
    name: 'Rachel Martinez',
    role: 'Compliance Officer',
    company: 'Premier Auto Logistics',
    quote:
      'DOT compliance tracking alone justified switching to VroomX. Expiration alerts for insurance, registrations, and driver certifications mean we never miss a renewal deadline.',
    avatar: 'https://randomuser.me/api/portraits/women/63.jpg',
    rating: 5,
  },
  {
    name: "Tom O'Brien",
    role: 'CEO',
    company: 'Tri-State Auto Movers',
    quote:
      'We reduced our operational overhead by 40% in the first quarter on VroomX. Between automated invoicing, digital BOLs, and streamlined dispatching, the ROI was immediate and obvious.',
    avatar: 'https://randomuser.me/api/portraits/men/22.jpg',
    rating: 5,
  },
]

const columns: [Testimonial[], Testimonial[], Testimonial[]] = [
  [testimonials[0], testimonials[3], testimonials[6]],
  [testimonials[1], testimonials[4], testimonials[7]],
  [testimonials[2], testimonials[5], testimonials[8]],
]

const columnDurations = [25, 30, 20]

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-sm">
      <div className="flex gap-0.5">
        {Array.from({ length: testimonial.rating }).map((_, i) => (
          <Star
            key={i}
            className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
          />
        ))}
      </div>
      <blockquote className="mt-3 text-sm leading-relaxed text-foreground/80">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>
      <div className="mt-4 flex items-center gap-3">
        <img
          src={testimonial.avatar}
          alt={testimonial.name}
          className="h-9 w-9 rounded-full object-cover"
          loading="lazy"
        />
        <div>
          <p className="text-sm font-semibold text-foreground">
            {testimonial.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {testimonial.role}, {testimonial.company}
          </p>
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
