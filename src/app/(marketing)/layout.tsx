import type { Metadata } from 'next'
import { MarketingHeader } from '@/components/marketing/marketing-header'
import { Footerdemo } from '@/components/ui/footer-section'

export const metadata: Metadata = {
  title: {
    default: 'VroomX - Dispatch Smarter. Deliver Faster.',
    template: '%s | VroomX',
  },
  description:
    'VroomX is a modern SaaS transportation management system for auto-transport carriers. Manage orders, dispatch trips, track drivers, and automate billing.',
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

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />

      {/* Main content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <Footerdemo />
    </div>
  )
}
