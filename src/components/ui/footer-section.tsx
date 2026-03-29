"use client"

import Link from "next/link"
import Image from "next/image"

const productLinks = [
  { label: "Features", href: "/features" },
  { label: "Profit Tracking", href: "/features/profit-tracking" },
  { label: "Dispatch Board", href: "/features/dispatch-board" },
  { label: "Invoicing", href: "/features/invoicing" },
  { label: "Driver App", href: "/features/driver-app" },
  { label: "Fleet & Compliance", href: "/features/fleet-management" },
  { label: "Pricing", href: "/pricing" },
]

const compareLinks = [
  { label: "vs Super Dispatch", href: "/compare/vroomx-vs-super-dispatch" },
  { label: "vs Central Dispatch", href: "/compare/vroomx-vs-central-dispatch" },
  { label: "vs Spreadsheets", href: "/compare/vroomx-vs-spreadsheets" },
]

const resourceLinks = [
  { label: "For Owner-Operators", href: "/for/owner-operators" },
  { label: "For Small Fleets", href: "/for/small-fleets" },
  { label: "For Mid-Size Fleets", href: "/for/mid-size-fleets" },
  { label: "For Dispatchers", href: "/for/dispatchers" },
  { label: "Glossary", href: "/glossary/auto-transport-terms" },
]

const communityLinks = [
  { label: "X / Twitter", href: "https://twitter.com/vroomxhq" },
  { label: "LinkedIn", href: "https://linkedin.com/company/vroomx" },
  { label: "Support", href: "mailto:support@vroomx.com" },
  { label: "Log in", href: "/login" },
  { label: "Careers", href: "mailto:careers@vroomx.com" },
]

function Footerdemo() {
  return (
    <footer className="border-t border-border-subtle bg-surface-raised">
      {/* ── Footer columns ─────────────────────────────────────────── */}
      <div className="border-t border-border-subtle">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] lg:px-8">
          {/* Brand column */}
          <div className="space-y-5">
            <Link href="/">
              <Image
                src="/images/logo-white.png"
                alt="VroomX TMS"
                width={168}
                height={58}
                className="h-[132px] w-auto brightness-0"
              />
            </Link>
            <p className="text-sm text-muted-foreground">
              Dispatch smarter. Deliver faster.
            </p>
            <p className="text-sm text-muted-foreground/60">
              &copy; VroomX, Inc. {new Date().getFullYear()}.
            </p>
            <div className="flex gap-3 text-sm">
              <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                Terms of Service
              </a>
              <span className="text-border-subtle">&middot;</span>
              <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                Privacy Policy
              </a>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-sm text-emerald-600">All Systems Operational</span>
            </div>
          </div>

          {/* Product column */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">Product</h3>
            <nav className="space-y-3">
              {productLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Compare column */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">Compare</h3>
            <nav className="space-y-3">
              {compareLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Resources column */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">Resources</h3>
            <nav className="space-y-3">
              {resourceLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Community column */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-foreground">Community</h3>
            <nav className="space-y-3">
              {communityLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </footer>
  )
}

export { Footerdemo }
