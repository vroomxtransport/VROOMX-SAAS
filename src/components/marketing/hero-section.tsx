'use client'

import { useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { motion, useScroll, useTransform } from 'motion/react'

export function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  })
  const imgY = useTransform(scrollYProgress, [0, 1], [0, 80])
  const imgScale = useTransform(scrollYProgress, [0, 1], [1, 1.08])

  return (
    <section className="bg-background">
      <div className="mx-auto px-6 pt-24 pb-4 sm:px-10 lg:px-16 lg:pt-28">
        {/* Single cohesive hero card — image + text as one element */}
        <motion.div
          ref={containerRef}
          className="relative min-h-[520px] overflow-hidden rounded-3xl sm:min-h-[580px] lg:min-h-[680px]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0 }}
        >
          {/* Background image with parallax */}
          <motion.div
            className="absolute inset-0"
            style={{ y: imgY, scale: imgScale }}
          >
            <Image
              src="/images/hero-bg.jpg"
              alt="Car carrier truck hauling vehicles on a highway at dusk"
              fill
              className="object-cover"
              sizes="(max-width: 1280px) 100vw, 1280px"
              priority
            />
          </motion.div>

          {/* Gradient overlay for text readability */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.5) 100%)',
            }}
          />

          {/* Vignette for cinematic edges */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 80% 70% at 50% 45%, transparent 40%, rgba(0,0,0,0.3) 100%)',
            }}
          />

          {/* Content overlaid on image */}
          <div className="relative z-10 flex min-h-[520px] flex-col items-center px-6 pt-16 pb-8 sm:min-h-[580px] sm:px-12 sm:pt-20 lg:min-h-[680px] lg:px-20 lg:pt-24">
            <div className="mx-auto max-w-3xl text-center">
              {/* Pill badge — glass effect */}
              <motion.div
                initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-white/80 backdrop-blur-sm">
                  For auto haulers by auto haulers
                </span>
              </motion.div>

              {/* Headline */}
              <motion.h1
                className="mt-7 font-serif text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl xl:text-[4.5rem]"
                initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <span className="whitespace-nowrap">They built it for brokers.</span>
                <br />
                <span className="bg-gradient-to-r from-brand via-[#2a3a4f] to-[#334a60] bg-clip-text text-transparent">
                  We built it for you.
                </span>
              </motion.h1>

              {/* Positioning line */}
              <motion.p
                className="mt-3 text-sm font-medium text-brand"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.55 }}
              >
                Owner-operators to 50-truck fleets. No percentage fees. No
                per-seat pricing. From $9.99/mo.
              </motion.p>

              {/* CTAs */}
              <motion.div
                className="mt-8 flex justify-center"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.65 }}
              >
                <Link
                  href="/signup"
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand px-8 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition-all duration-200 hover:bg-brand/90 hover:shadow-xl hover:shadow-brand/40"
                >
                  See Your Real Numbers, Free
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
