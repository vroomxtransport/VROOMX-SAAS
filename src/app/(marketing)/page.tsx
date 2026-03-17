import type { Metadata } from 'next'
import { HeroSection } from '@/components/marketing/hero-section'
import { MetricsBanner } from '@/components/marketing/metrics-banner'
import { PainAgitationSection } from '@/components/marketing/pain-agitation-section'
import { FinancialIntelligence } from '@/components/marketing/financial-intelligence'
import { Feature197 } from '@/components/ui/accordion-feature-section'
import { DriverAppSection } from '@/components/marketing/driver-app-section'
import { Testimonials } from '@/components/marketing/testimonials'
import { ComparisonTable } from '@/components/marketing/comparison-table'
import PricingSection from '@/components/ui/pricing'
import { FAQSection } from '@/components/marketing/faq-section'
import { FinalCTA } from '@/components/marketing/final-cta'

export const metadata: Metadata = {
  title: 'VroomX TMS — They Built It for Brokers. We Built It for You.',
  description:
    'VroomX TMS is the first auto-transport platform built for carriers, not brokers. See Clean Gross, automated settlements, per-truck profitability, and compliance tracking. From $9.99/mo.',
  openGraph: {
    title: 'VroomX TMS — They Built It for Brokers. We Built It for You.',
    description:
      'The carrier-first TMS with real financials. Clean Gross, driver settlements, and net profit on every load. No per-seat fees. From $9.99/mo.',
    type: 'website',
    siteName: 'VroomX',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VroomX TMS — They Built It for Brokers. We Built It for You.',
    description:
      'The carrier-first TMS with real financials. Clean Gross, driver settlements, and net profit on every load. No per-seat fees. From $9.99/mo.',
  },
}

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <MetricsBanner />
      <Feature197 />
      <DriverAppSection />
      <PainAgitationSection />
      <FinancialIntelligence />
      <Testimonials />
      <ComparisonTable />
      <section className="border-t border-border">
        <PricingSection />
      </section>
      <FAQSection />
      <FinalCTA />
    </>
  )
}
