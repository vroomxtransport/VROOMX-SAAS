"use client"

import { useRef } from "react"
import { TimelineContent } from "@/components/ui/timeline-animation"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqs = [
  {
    question: "How is VroomX TMS different from other auto-transport platforms?",
    answer: "Most platforms are load boards with an invoice button. They help you find loads and send a bill. That's it. VroomX TMS is a full carrier operating system: dispatch, trip planning, 4 driver pay models with per-order overrides, automated invoicing, factoring integration, compliance tracking, break-even analysis, and per-truck profitability. Those platforms don't show you Clean Gross. They don't calculate your real driver cost per load. They don't tell you which trucks are losing money. VroomX does all of that starting at $9.99/month.",
  },
  {
    question: "Is VroomX TMS overkill for a small carrier?",
    answer: "No. Our Owner-Operator plan starts at $9.99/month for a single truck. You get the same Clean Gross visibility as a 50-truck fleet, just at a price that makes sense for your size. Most of our customers started with one truck.",
  },
  {
    question: "Why is VroomX so much cheaper?",
    answer: "Enterprise platforms were built for mega-fleets with 500+ trucks and charge accordingly, often 30% per seat. VroomX was built for owner-operators and small-to-mid carriers (1 to 50 trucks). We don't have a 40-person sales team or 6-month implementation cycles. You sign up, import your data, and start dispatching in minutes. Lower overhead means lower prices without cutting features.",
  },
  {
    question: "I'm already using another dispatch tool. Is switching worth it?",
    answer: "If your current tool can't tell you the net profit on the load you delivered yesterday, then yes. Most carriers complete their full migration in under an hour using CSV import. Your dispatcher will be faster on VroomX by day two. The financial visibility alone, seeing which loads, drivers, and trucks actually make money, typically pays for the switch in the first week.",
  },
  {
    question: "How long is the free trial?",
    answer: "14 days, full access, no credit card. Just sign up and start dispatching. If it's not for you, walk away. No awkward sales calls.",
  },
  {
    question: "What happens when my trial ends?",
    answer: "You pick a plan. Your data is preserved for 30 days after trial expiry, so you won't lose any work if you need extra time to decide. No surprise charges.",
  },
  {
    question: "Can I migrate from another TMS or spreadsheets?",
    answer: "Yes. VroomX TMS supports CSV import for orders, brokers, drivers, and trucks. Our intake wizard also supports individual order creation with VIN decoding and multi-vehicle loads. Most carriers complete their full migration in under an hour. Pro plan customers can request custom data imports from our team.",
  },
  {
    question: "How does Clean Gross work?",
    answer: "Clean Gross is calculated per order as revenue minus broker fees minus local fees. This gives you the true carrier earnings before driver pay and overhead. VroomX TMS calculates this automatically for every order and aggregates it at the trip level.",
  },
  {
    question: "What driver pay models do you support?",
    answer: "VroomX TMS supports four settlement models: percentage of carrier pay (company drivers), dispatch fee percentage (owner-operators), flat per-car rates, and per-mile rates. Settlements are auto-calculated when you build trips, and you can override rates on any individual load.",
  },
  {
    question: "Do you support factoring companies?",
    answer: "Yes. Mark any invoice for factoring with one click. VroomX TMS auto-calculates the factoring fee and shows the impact on your Clean Gross and net profit instantly, so you always know the real cost of getting paid early.",
  },
  {
    question: "Do my drivers need special hardware?",
    answer: "No. The VroomX TMS Driver app runs on any modern iPhone. Drivers can do inspections, capture photos, sign BOLs, and update order status from the phone they already carry.",
  },
  {
    question: "Can I switch plans later?",
    answer: "Yes. Upgrade or downgrade anytime from billing settings. Upgrades are instant. Downgrades take effect at your next billing cycle.",
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
      className="bg-background py-20 sm:py-28 lg:py-32"
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
            <p className="section-kicker mb-3">
              FAQ
            </p>
          </TimelineContent>
          <TimelineContent
            as="div"
            animationNum={1}
            timelineRef={sectionRef}
            customVariants={revealVariants}
          >
            <h2 className="text-3xl font-bold tracking-[-0.015em] sm:text-4xl lg:text-[2.75rem]">
              Frequently asked questions
            </h2>
          </TimelineContent>
          <TimelineContent
            as="div"
            animationNum={2}
            timelineRef={sectionRef}
            customVariants={revealVariants}
          >
            <p className="mt-4 text-lg text-muted-foreground">
              Common questions from carriers evaluating VroomX TMS.
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
