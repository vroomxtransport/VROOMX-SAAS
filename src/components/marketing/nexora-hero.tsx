'use client'

import { motion } from 'motion/react'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardPreview } from '@/components/marketing/dashboard-preview'

export function NexoraHero() {
  return (
    <section className="relative h-screen flex flex-col bg-background overflow-hidden">
      {/* Background Video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover z-0"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4"
      />

      {/* Semi-transparent overlay for text readability */}
      <div className="absolute inset-0 z-[1] bg-black/40" />

      {/* All content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full px-6">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-1.5 text-sm text-white/90 font-[family-name:var(--font-body)]">
            For auto haulers by auto haulers
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-center font-[family-name:var(--font-display)] text-5xl md:text-6xl lg:text-[5rem] leading-[0.95] tracking-tight text-white max-w-xl"
        >
          They built it for brokers.
          <br />
          <span className="bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
            We built it for you.
          </span>
        </motion.h1>

        {/* Positioning line */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-3 text-sm font-medium text-white/70 font-[family-name:var(--font-body)]"
        >
          Owner-operators to 50-truck fleets. No percentage fees. No per-seat pricing. From $9.99/mo.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-5 flex items-center gap-3"
        >
          <Button className="rounded-full px-6 py-5 text-sm font-medium font-[family-name:var(--font-body)]">
            Book a demo
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:bg-white/80"
          >
            <Play className="h-4 w-4 fill-foreground text-foreground" />
          </Button>
        </motion.div>

        {/* Dashboard Preview */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-8 w-full flex justify-center"
        >
          <DashboardPreview />
        </motion.div>
      </div>
    </section>
  )
}
