"use client"

import Link from "next/link"
import Image from "next/image"

const platformLinks = [
  { label: "Features", href: "#product" },
  { label: "Pricing", href: "/pricing" },
  { label: "Log in", href: "/login" },
  { label: "Careers", href: "mailto:careers@vroomx.com" },
]

const communityLinks = [
  { label: "X / Twitter", href: "https://twitter.com/vroomxhq" },
  { label: "LinkedIn", href: "https://linkedin.com/company/vroomx" },
  { label: "Support", href: "mailto:support@vroomx.com" },
]

function Footerdemo() {
  return (
    <footer className="bg-black text-white">
      {/* ── CTA Banner ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        {/* Halftone / dot-grid texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
            backgroundSize: '8px 8px',
          }}
        />
        {/* Subtle gradient backdrop */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent" />

        <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-6 py-20 sm:flex-row sm:items-end sm:justify-between sm:py-28 lg:px-8">
          <h2 className="max-w-lg text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
            Ready to Dispatch&nbsp;Smarter?
          </h2>
          <div className="flex items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-brand/90"
            >
              Start Free Trial
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-white/20 px-6 text-sm font-medium text-white transition-colors hover:bg-white/[0.06]"
            >
              See Pricing
            </Link>
          </div>
        </div>
      </div>

      {/* ── Separator lines (matching reference) ───────────────────── */}
      <div className="border-t border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-6 py-4 lg:px-8" />
      </div>
      <div className="border-t border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-6 py-4 lg:px-8" />
      </div>

      {/* ── Footer columns ─────────────────────────────────────────── */}
      <div className="border-t border-white/[0.06]">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
          {/* Brand column */}
          <div className="space-y-5">
            <Link href="/">
              <Image
                src="/images/logo-white.png"
                alt="VroomX TMS"
                width={168}
                height={58}
                className="h-14 w-auto"
              />
            </Link>
            <p className="text-sm text-white/50">
              Dispatch smarter. Deliver faster.
            </p>
            <p className="text-sm text-white/30">
              &copy; VroomX, Inc. {new Date().getFullYear()}.
            </p>
            <div className="flex gap-3 text-sm">
              <a href="#" className="text-white/40 transition-colors hover:text-white/70">
                Terms of Service
              </a>
              <span className="text-white/20">&middot;</span>
              <a href="#" className="text-white/40 transition-colors hover:text-white/70">
                Privacy Policy
              </a>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-sm text-emerald-400">All Systems Operational</span>
            </div>
          </div>

          {/* Platform column */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">Platform</h3>
            <nav className="space-y-3">
              {platformLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="block text-sm text-white/50 transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Community column */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">Join the Community</h3>
            <nav className="space-y-3">
              {communityLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-white/50 transition-colors hover:text-white"
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
