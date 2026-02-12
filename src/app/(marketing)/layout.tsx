import type { Metadata } from 'next'
import Link from 'next/link'
import { Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <Truck className="h-6 w-6" />
              <span className="text-xl font-bold">VroomX</span>
            </Link>
            <nav className="hidden items-center gap-6 md:flex">
              <Link
                href="/pricing"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Pricing
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Sign up</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                <span className="text-lg font-bold">VroomX</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Modern transportation management for auto-transport carriers.
                Dispatch smarter, deliver faster.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Product</h3>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link
                    href="/pricing"
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="/login"
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Log in
                  </Link>
                </li>
                <li>
                  <Link
                    href="/signup"
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Sign up
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Legal</h3>
              <ul className="mt-3 space-y-2">
                <li>
                  <span className="text-sm text-muted-foreground">
                    Privacy Policy
                  </span>
                </li>
                <li>
                  <span className="text-sm text-muted-foreground">
                    Terms of Service
                  </span>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t pt-8">
            <p className="text-center text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} VroomX. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
