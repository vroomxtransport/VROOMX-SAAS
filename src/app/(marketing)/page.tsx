import type { Metadata } from 'next'
import { HeroSection } from '@/components/marketing/hero-section'
import { LogoStrip } from '@/components/marketing/logo-strip'
import { ProblemSolution } from '@/components/marketing/problem-solution'
import { Feature197 } from '@/components/ui/accordion-feature-section'
import { ProductShowcase } from '@/components/marketing/product-showcase'
import { StatsBanner } from '@/components/marketing/stats-banner'
import { Testimonials } from '@/components/marketing/testimonials'
import PricingSection from '@/components/ui/pricing'
import { FAQSection } from '@/components/marketing/faq-section'
import { FinalCTA } from '@/components/marketing/final-cta'

export const metadata: Metadata = {
  title: 'VroomX - Dispatch Smarter. Deliver Faster.',
  description:
    'VroomX is a modern SaaS transportation management system built for auto-transport carriers. Manage orders, dispatch trips, track drivers, and automate billing -- all in one platform.',
  openGraph: {
    title: 'VroomX - Dispatch Smarter. Deliver Faster.',
    description:
      'Modern SaaS TMS for auto-transport carriers. Manage orders, dispatch trips, track drivers, and automate billing.',
    type: 'website',
    siteName: 'VroomX',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VroomX - Dispatch Smarter. Deliver Faster.',
    description:
      'Modern SaaS TMS for auto-transport carriers. Manage orders, dispatch trips, track drivers, and automate billing.',
  },
}

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <LogoStrip />
      <ProblemSolution />
      <Feature197 />
      <ProductShowcase />
      <StatsBanner />
      <Testimonials />
      <section className="border-t border-border bg-background">
        <PricingSection />
      </section>
      <FAQSection />
      <FinalCTA />
    </>
  )
}
