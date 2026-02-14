"use client"

import { useRef } from "react"
import { TimelineContent } from "@/components/ui/timeline-animation"
import { VerticalCutReveal } from "@/components/ui/vertical-cut-reveal"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqs = [
  {
    question: "How long is the free trial?",
    answer:
      "Every plan includes a full 14-day free trial with access to all features. No credit card required to start — just sign up and begin dispatching.",
  },
  {
    question: "Can I switch plans later?",
    answer:
      "Absolutely. You can upgrade or downgrade your plan at any time from the billing settings. When upgrading, the new features are available immediately. When downgrading, changes take effect at the start of your next billing cycle.",
  },
  {
    question: "How does multi-tenant security work?",
    answer:
      "Every carrier gets a completely isolated tenant. PostgreSQL Row-Level Security policies ensure that your data — orders, drivers, trucks, financials — is invisible to other tenants. There is no shared data layer between carriers.",
  },
  {
    question: "Do my drivers need special hardware?",
    answer:
      "No. The VroomX Driver app runs on any modern iPhone. Drivers can do inspections, capture photos, sign BOLs, and update order status from the same phone they already carry.",
  },
  {
    question: "What driver pay models do you support?",
    answer:
      "VroomX supports three pay models out of the box: percentage of carrier pay (for company drivers), dispatch fee percentage (for owner-operators), and flat per-car rates. Pay is auto-calculated when you build trips.",
  },
  {
    question: "Can I import existing orders and contacts?",
    answer:
      "Yes. VroomX supports CSV import for orders, brokers, drivers, and trucks. Our intake wizard also supports individual order creation with VIN decoding and multi-vehicle loads.",
  },
  {
    question: "Is there an API for integrations?",
    answer:
      "Enterprise plans include API access for custom integrations with load boards, accounting software, and third-party logistics platforms. Contact our team to discuss your integration requirements.",
  },
  {
    question: "What happens when my trial ends?",
    answer:
      "At the end of your 14-day trial, you'll be prompted to choose a plan. Your data is preserved for 30 days after trial expiry, so you won't lose any work if you need a few extra days to decide.",
  },
]

const revealVariants = {
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: { delay: i * 0.15, duration: 0.5 },
  }),
  hidden: { filter: "blur(10px)", y: 20, opacity: 0 },
}

export function FAQSection() {
  const sectionRef = useRef<HTMLDivElement>(null)

  return (
    <section
      ref={sectionRef}
      className="border-t border-border-subtle bg-muted/30 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <TimelineContent
            as="div"
            animationNum={0}
            timelineRef={sectionRef}
            customVariants={revealVariants}
          >
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand">
              FAQ
            </p>
          </TimelineContent>
          <TimelineContent
            as="div"
            animationNum={1}
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
                transition={{
                  type: "spring",
                  stiffness: 250,
                  damping: 40,
                }}
              >
                Frequently asked questions
              </VerticalCutReveal>
            </h2>
          </TimelineContent>
          <TimelineContent
            as="div"
            animationNum={2}
            timelineRef={sectionRef}
            customVariants={revealVariants}
          >
            <p className="mt-4 text-lg text-muted-foreground">
              Everything you need to know about VroomX before getting started.
            </p>
          </TimelineContent>
        </div>

        {/* Accordion */}
        <TimelineContent
          as="div"
          animationNum={3}
          timelineRef={sectionRef}
          customVariants={revealVariants}
        >
          <div className="rounded-2xl border border-border-subtle bg-surface p-2 shadow-sm">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, idx) => (
                <AccordionItem
                  key={idx}
                  value={`faq-${idx}`}
                  className="border-border-subtle px-4 last:border-b-0"
                >
                  <AccordionTrigger className="cursor-pointer py-5 text-left text-[15px] font-semibold !no-underline transition hover:!no-underline hover:text-brand">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </TimelineContent>
      </div>
    </section>
  )
}
