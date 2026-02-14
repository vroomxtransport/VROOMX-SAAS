import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const plans = [
  {
    name: 'Starter',
    price: '$49',
    period: '/mo',
    highlighted: false,
    accent: 'blue' as const,
    features: [
      'Up to 50 orders/month',
      '5 trucks',
      'Basic dispatch board',
      'Email support',
    ],
    cta: 'Get Started',
  },
  {
    name: 'Pro',
    price: '$149',
    period: '/mo',
    highlighted: true,
    accent: 'brand' as const,
    features: [
      'Unlimited orders',
      '25 trucks',
      'Kanban + analytics',
      'Priority support',
    ],
    cta: 'Start Free Trial',
  },
  {
    name: 'Enterprise',
    price: '$299',
    period: '/mo',
    highlighted: false,
    accent: 'violet' as const,
    features: [
      'Unlimited everything',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    cta: 'Contact Sales',
  },
]

const checkColors = {
  blue: 'text-blue-500',
  brand: 'text-brand',
  violet: 'text-violet-500',
}

export function PricingTeaser() {
  return (
    <section className="border-t border-border-subtle bg-muted/30 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Simple pricing that scales with your fleet
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Start free for 14 days. No credit card required. Upgrade when you
            are ready.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            if (plan.highlighted) {
              return (
                <div
                  key={plan.name}
                  className="relative rounded-2xl bg-gradient-to-br from-[#fb7232] to-[#f59e0b] p-px"
                >
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-brand-foreground border-0 px-3 py-0.5 text-xs font-semibold shadow-sm">
                    Most Popular
                  </Badge>
                  <div className="rounded-[calc(1rem_-_1px)] bg-surface p-8 text-center relative shadow-md">
                    <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      {plan.name}
                    </p>
                    <p className="mt-2">
                      <span className="text-4xl font-extrabold text-foreground">{plan.price}</span>
                      <span className="text-base font-normal text-muted-foreground">
                        {plan.period}
                      </span>
                    </p>
                    <div className="mt-6 space-y-3 text-left">
                      {plan.features.map((feature) => (
                        <div key={feature} className="flex items-center gap-2">
                          <Check className={`h-4 w-4 ${checkColors[plan.accent]} shrink-0`} />
                          <span className="text-sm text-muted-foreground">
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-8">
                      <Button className="w-full bg-brand text-brand-foreground hover:bg-brand/90 shadow-sm">
                        {plan.cta}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={plan.name}
                className="rounded-2xl border border-border-subtle bg-surface p-8 shadow-sm text-center transition-all duration-200 hover:shadow-md card-hover"
              >
                <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {plan.name}
                </p>
                <p className="mt-2">
                  <span className="text-4xl font-extrabold text-foreground">{plan.price}</span>
                  <span className="text-base font-normal text-muted-foreground">
                    {plan.period}
                  </span>
                </p>
                <div className="mt-6 space-y-3 text-left">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                      <Check className={`h-4 w-4 ${checkColors[plan.accent]} shrink-0`} />
                      <span className="text-sm text-muted-foreground">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-8">
                  <Button variant="outline" className="w-full">
                    {plan.cta}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-8 text-center">
          <Button variant="outline" asChild>
            <Link href="/pricing">
              View Full Pricing
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
