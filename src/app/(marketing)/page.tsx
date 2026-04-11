import type { Metadata } from 'next'
import { NexoraHero } from '@/components/marketing/nexora-hero'
import { MetricsBanner } from '@/components/marketing/metrics-banner'
import { PainAgitationSection } from '@/components/marketing/pain-agitation-section'
import { FinancialIntelligence } from '@/components/marketing/financial-intelligence'
import { Feature197 } from '@/components/ui/accordion-feature-section'
import { DriverAppSection } from '@/components/marketing/driver-app-section'
import { IntegrationsSection } from '@/components/marketing/integrations-section'
import { Testimonials } from '@/components/marketing/testimonials'
import PricingSection from '@/components/ui/pricing'
import { FAQSection } from '@/components/marketing/faq-section'
import { FinalCTA } from '@/components/marketing/final-cta'
import { SoftwareApplicationJsonLd, FAQPageJsonLd } from '@/components/shared/json-ld'

const pageFaqs = [
  {
    question: 'How is VroomX TMS different from other auto-transport platforms?',
    answer:
      'Most platforms are load boards with an invoice button. VroomX TMS is a full carrier operating system: dispatch, trip planning, 4 driver pay models with per-order overrides, automated invoicing, factoring integration, compliance tracking, break-even analysis, and per-truck profitability. VroomX shows you Clean Gross and calculates your real driver cost per load — starting at $29/month.',
  },
  {
    question: 'Is VroomX TMS overkill for a small carrier?',
    answer:
      'No. Our Owner-Operator plan is $29/month for a solo driver, and Starter X is $49/month for up to 5 trucks. You get the same Clean Gross visibility as a 50-truck fleet at a price that makes sense for your size. Most of our customers started with one truck.',
  },
  {
    question: 'How long is the free trial?',
    answer:
      '14 days, full access, no credit card. Just sign up and start dispatching. If it\'s not for you, walk away.',
  },
  {
    question: 'How does Clean Gross work?',
    answer:
      'Clean Gross is calculated per order as revenue minus broker fees minus local fees. This gives you the true carrier earnings before driver pay and overhead. VroomX TMS calculates this automatically for every order and aggregates it at the trip level.',
  },
  {
    question: 'What driver pay models do you support?',
    answer:
      'VroomX TMS supports four settlement models: percentage of carrier pay (company drivers), dispatch fee percentage (owner-operators), flat per-car rates, and per-mile rates. Settlements are auto-calculated when you build trips, and you can override rates on any individual load.',
  },
  {
    question: 'Can I migrate from another TMS or spreadsheets?',
    answer:
      'Yes. VroomX TMS supports CSV import for orders, brokers, drivers, and trucks. Most carriers complete their full migration in under an hour.',
  },
]

export const metadata: Metadata = {
  title: { absolute: 'Auto Transport TMS for Carriers | VroomX' },
  description:
    'The first TMS built for auto-transport carriers, not brokers. See Clean Gross on every load, automate driver settlements, and track per-truck profitability. Plans from $29/mo. 14-day free trial.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Auto Transport TMS for Carriers | VroomX',
    description:
      'The first TMS built for auto-transport carriers, not brokers. See Clean Gross on every load, automate driver settlements, and track per-truck profitability. Plans from $29/mo. 14-day free trial.',
    type: 'website',
    siteName: 'VroomX',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auto Transport TMS for Carriers | VroomX',
    description:
      'The first TMS built for auto-transport carriers, not brokers. See Clean Gross on every load, automate driver settlements, and track per-truck profitability. Plans from $29/mo.',
  },
}

export default function LandingPage() {
  return (
    <>
      <SoftwareApplicationJsonLd />
      <FAQPageJsonLd faqs={pageFaqs} />
      <NexoraHero />
      <MetricsBanner />
      <Feature197 />
      <FinancialIntelligence />
      <DriverAppSection />
      <IntegrationsSection />
      <PainAgitationSection />
      <Testimonials />
      <section className="border-t border-border">
        <PricingSection />
      </section>
      <FAQSection />
      <FinalCTA />
    </>
  )
}
