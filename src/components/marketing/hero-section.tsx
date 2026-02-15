import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BrowserFrame } from './browser-frame'

function DashboardMockup() {
  return (
    <div className="flex h-[340px] gap-2 bg-[#0d0d0c] p-3">
      {/* Mini sidebar */}
      <div className="flex w-14 flex-col items-center gap-3 rounded-lg bg-[#1a1a19] py-3 border border-white/5">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-brand to-amber-500" style={{ boxShadow: 'var(--brand-glow)' }} />
        <div className="mt-3 h-1 w-7 rounded-full bg-white/25" />
        <div className="h-1 w-7 rounded-full bg-white/12" />
        <div className="h-1 w-7 rounded-full bg-white/12" />
        <div className="h-1 w-7 rounded-full bg-white/8" />
        <div className="mt-auto h-1 w-7 rounded-full bg-white/5" />
      </div>
      {/* Main content */}
      <div className="flex-1 space-y-2.5">
        {/* Header */}
        <div className="flex items-center justify-between rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2">
          <div className="h-2.5 w-24 rounded-full bg-white/15" />
          <div className="h-5 w-20 rounded-md bg-gradient-to-r from-brand to-amber-500 opacity-60" />
        </div>
        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { accent: 'from-blue-500/25 to-blue-600/5', border: 'border-blue-500/20' },
            { accent: 'from-amber-500/25 to-amber-600/5', border: 'border-amber-500/20' },
            { accent: 'from-emerald-500/25 to-emerald-600/5', border: 'border-emerald-500/20' },
            { accent: 'from-violet-500/25 to-violet-600/5', border: 'border-violet-500/20' },
          ].map((card, i) => (
            <div key={i} className={`h-16 rounded-lg bg-gradient-to-br ${card.accent} border ${card.border} p-2.5`}>
              <div className="h-1.5 w-10 rounded-full bg-white/20" />
              <div className="mt-2 h-4 w-14 rounded bg-white/25" />
            </div>
          ))}
        </div>
        {/* Chart */}
        <div className="relative h-28 overflow-hidden rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
          <div className="h-2 w-20 rounded-full bg-white/12" />
          <svg className="mt-2 h-16 w-full" viewBox="0 0 200 50" preserveAspectRatio="none">
            <defs>
              <linearGradient id="heroChartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb7232" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#fb7232" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,40 C20,38 30,28 50,26 C70,24 80,33 100,22 C120,12 130,18 150,10 C170,5 180,12 200,8 L200,50 L0,50 Z" fill="url(#heroChartGrad)" />
            <path d="M0,40 C20,38 30,28 50,26 C70,24 80,33 100,22 C120,12 130,18 150,10 C170,5 180,12 200,8" fill="none" stroke="#fb7232" strokeWidth="2" />
          </svg>
        </div>
        {/* Table rows */}
        <div className="space-y-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
          {[0.15, 0.12, 0.09].map((opacity, i) => (
            <div key={i} className="flex gap-2.5">
              <div className="h-2 w-3/12 rounded-full" style={{ background: `rgba(255,255,255,${opacity})` }} />
              <div className="h-2 w-4/12 rounded-full" style={{ background: `rgba(255,255,255,${opacity * 0.6})` }} />
              <div className={`h-2 w-2/12 rounded-full ${i === 0 ? 'bg-emerald-500/20' : i === 1 ? 'bg-brand/20' : 'bg-amber-500/20'}`} />
              <div className="h-2 w-3/12 rounded-full" style={{ background: `rgba(255,255,255,${opacity * 0.5})` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-black">
      {/* Animated grid background */}
      <div className="absolute inset-0 hero-grid-bg opacity-40" />
      {/* Radial glows */}
      <div className="absolute inset-0 hero-radial-glow" />
      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.015] sidebar-noise" />
      {/* Accent orbs */}
      <div className="absolute top-20 left-[15%] w-[500px] h-[500px] rounded-full bg-brand/[0.08] blur-[120px]" />
      <div className="absolute bottom-10 right-[10%] w-[400px] h-[400px] rounded-full bg-[#f59e0b]/[0.06] blur-[100px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-blue-500/[0.04] blur-[80px]" />

      <div className="relative mx-auto max-w-7xl px-4 py-28 sm:px-6 sm:py-36 lg:px-8 lg:py-44">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          {/* Left column */}
          <div className="animate-fade-up">
            <h1 className="mt-0 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
              Stop dispatching{' '}
              <span className="relative">
                from spreadsheets
                <svg className="absolute -bottom-1 left-0 w-full h-3 text-red-500/30" viewBox="0 0 200 8" preserveAspectRatio="none">
                  <path d="M0,7 Q50,0 100,5 T200,3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </span>
              .
              <br />
              <span className="bg-gradient-to-r from-brand via-amber-500 to-amber-400 bg-clip-text text-transparent">
                Run your fleet like a pro.
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-8 text-white/60">
              The all-in-one TMS built for car haulers. Manage loads, dispatch trips,
              track your drivers in real-time, and get paid faster — from a single,
              powerful dashboard.
            </p>

            {/* CTA row */}
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-7 text-sm font-semibold text-foreground shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105"
              >
                Start Free Trial
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="#product"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-7 text-sm font-medium text-white/90 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:border-white/20"
              >
                Watch Demo
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="mt-8 flex items-center gap-5">
              <div className="flex items-center gap-2.5">
                <div className="flex -space-x-1.5">
                  {['bg-emerald-500', 'bg-blue-500', 'bg-amber-500'].map((color, i) => (
                    <div key={i} className={`h-7 w-7 rounded-full ${color} border-2 border-black flex items-center justify-center text-[9px] font-bold text-white`}>
                      {['M', 'J', 'S'][i]}
                    </div>
                  ))}
                </div>
                <span className="text-sm font-medium text-white/70">200+ carriers</span>
              </div>
              <div className="h-4 w-px bg-white/20" />
              <span className="text-sm text-white/50">14 days free · No credit card</span>
            </div>
          </div>

          {/* Right column — floating browser mockup */}
          <div
            className="hidden lg:block animate-fade-up"
            style={{ animation: 'float 6s ease-in-out infinite, fade-up 0.8s ease-out 0.3s both' }}
          >
            <div className="relative">
              {/* Glow behind mockup */}
              <div className="absolute -inset-8 rounded-3xl bg-brand/[0.08] blur-3xl" />
              <BrowserFrame className="relative" style={{ boxShadow: 'var(--brand-glow-lg), 0 20px 60px rgba(0,0,0,0.4)' }}>
                <DashboardMockup />
              </BrowserFrame>
            </div>
          </div>
        </div>
      </div>

    </section>
  )
}
