import type { Metadata } from 'next'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Simple, transparent pricing for auto-transport carriers. Choose from Starter, Pro, or Enterprise plans. 14-day free trial on all plans.',
  openGraph: {
    title: 'Pricing | VroomX',
    description:
      'Simple, transparent pricing for auto-transport carriers. Start free, upgrade anytime.',
    type: 'website',
    siteName: 'VroomX',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing | VroomX',
    description:
      'Simple, transparent pricing for auto-transport carriers.',
  },
}

type PlanTier = {
  name: string
  slug: string
  price: number
  description: string
  highlighted: boolean
  features: string[]
}

const plans: PlanTier[] = [
  {
    name: 'Starter',
    slug: 'starter',
    price: 49,
    description: 'For small carriers getting started with digital dispatch.',
    highlighted: false,
    features: [
      'Up to 5 trucks',
      'Up to 3 team members',
      'Order management',
      'Trip dispatch',
      'Driver app access',
      'PDF invoicing',
      'Email support',
    ],
  },
  {
    name: 'Pro',
    slug: 'pro',
    price: 149,
    description: 'For growing fleets that need advanced tools and more capacity.',
    highlighted: true,
    features: [
      'Up to 20 trucks',
      'Up to 10 team members',
      'Everything in Starter',
      'Aging analysis & receivables',
      'CSV order import',
      'Document management',
      'Trailer tracking',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    price: 299,
    description: 'For large operations that need unlimited capacity and dedicated support.',
    highlighted: false,
    features: [
      'Unlimited trucks',
      'Unlimited team members',
      'Everything in Pro',
      'Dedicated account manager',
      'Custom onboarding',
      'API access',
      'SLA guarantee',
      'Phone support',
    ],
  },
]

const faqs = [
  {
    question: 'Is there a free trial?',
    answer:
      'Yes! All plans include a 14-day free trial. You can explore every feature without entering a credit card. Your trial starts the moment you sign up.',
  },
  {
    question: 'Can I change plans later?',
    answer:
      'Absolutely. You can upgrade or downgrade your plan at any time from your account settings. Changes take effect on your next billing cycle, and any unused time is prorated.',
  },
  {
    question: 'How secure is my data?',
    answer:
      'VroomX uses row-level security to isolate every tenant, meaning your data is completely separate from other companies. All data is encrypted in transit and at rest. We run on Supabase infrastructure with SOC 2 compliance.',
  },
  {
    question: 'Do you offer annual pricing?',
    answer:
      'We are working on annual billing with a discount. Contact us at sales@vroomx.com for annual pricing options and volume discounts for large fleets.',
  },
]

export default function PricingPage() {
  return (
    <>
      {/* Hero */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Simple, transparent pricing
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Choose the plan that fits your fleet. All plans include a 14-day
              free trial.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-24 sm:pb-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.slug}
                className={`relative flex flex-col rounded-2xl border p-8 shadow-sm ${
                  plan.highlighted
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border'
                }`}
              >
                {plan.highlighted && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}
                <div className="mb-6">
                  <h2 className="text-xl font-bold">{plan.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="ml-1 text-muted-foreground">/month</span>
                  </div>
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.highlighted ? 'default' : 'outline'}
                  size="lg"
                  className="w-full"
                  asChild
                >
                  <Link href={`/signup?plan=${plan.slug}`}>
                    Start Free Trial
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="border-t bg-muted/30 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Frequently asked questions
            </h2>
            <p className="mt-4 text-muted-foreground">
              Have another question?{' '}
              <a
                href="mailto:support@vroomx.com"
                className="font-medium text-primary hover:underline"
              >
                Contact us
              </a>
              .
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-3xl divide-y">
            {faqs.map((faq) => (
              <div key={faq.question} className="py-6">
                <h3 className="text-base font-semibold">{faq.question}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
