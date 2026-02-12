import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ClipboardList,
  Route,
  Smartphone,
  Receipt,
  Truck,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

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

const features = [
  {
    icon: ClipboardList,
    title: 'Order Management',
    description:
      'Create, track, and manage vehicle transport orders with VIN decoding, multi-step wizards, and real-time status updates.',
  },
  {
    icon: Route,
    title: 'Trip Dispatch',
    description:
      'Build trips, assign orders and drivers, track expenses, and calculate driver pay automatically across three pay models.',
  },
  {
    icon: Smartphone,
    title: 'Driver App',
    description:
      'Native iOS app for drivers with offline-capable inspections, photo/video capture, BOL generation, and real-time order updates.',
  },
  {
    icon: Receipt,
    title: 'Billing & Invoicing',
    description:
      'Generate PDF invoices, send via email, record payments, and track receivables with aging analysis and collection metrics.',
  },
  {
    icon: Truck,
    title: 'Fleet Management',
    description:
      'Manage trucks, trailers, and drivers. Track documents with expiry alerts, upload CDLs and medical cards, and monitor fleet status.',
  },
  {
    icon: ShieldCheck,
    title: 'Multi-Tenant Security',
    description:
      'Row-level security isolates every tenant. Role-based access, team invitations, and Stripe-powered subscriptions with tier enforcement.',
  },
]

export default function LandingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_40%_at_50%_60%,hsl(var(--primary)/0.08),transparent)]" />
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8 lg:py-40">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Dispatch Smarter.{' '}
              <span className="text-primary">Deliver Faster.</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl">
              VroomX is the modern transportation management system built for
              auto-transport carriers. Manage orders, dispatch trips, track
              drivers, and automate billing -- all in one platform.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/signup">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/pricing">View Pricing</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              14-day free trial. No credit card required to start.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t bg-muted/30 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to run your fleet
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              From order intake to final delivery, VroomX handles your entire
              transport workflow.
            </p>
          </div>
          <div className="mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA Section */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-8 text-center shadow-sm sm:p-12">
            <h2 className="text-3xl font-bold tracking-tight">
              Ready to streamline your operations?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Join carriers who are dispatching smarter and delivering faster
              with VroomX.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/signup">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/pricing">Compare Plans</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
