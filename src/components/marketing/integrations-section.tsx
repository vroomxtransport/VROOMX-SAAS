'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAllIntegrations } from '@/lib/integrations/registry'
import type { IntegrationDefinition } from '@/lib/integrations/registry'

// ============================================================================
// Highlighted title with hand-drawn underline
// ============================================================================

function HighlightedTitle({ text }: { text: string }) {
  const parts = text.split(/~/)
  return (
    <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl leading-tight">
      {parts.map((part, index) =>
        index === 1 ? (
          <span key={index} className="relative whitespace-nowrap">
            <span className="relative z-10">{part}</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 418 42"
              className="absolute left-0 top-[calc(100%-0.15em)] h-[0.5em] w-full text-foreground"
              preserveAspectRatio="none"
            >
              <path
                d="M203.371.916c-26.013-2.078-76.686 1.98-114.243 8.919-37.556 6.939-78.622 17.103-122.256 28.703-43.633 11.6-4.984 14.306 43.123 7.021 48.107-7.285 93.638-16.096 146.446-17.742 52.808-1.646 105.706 5.429 158.649 14.13 52.943 8.701 105.886 19.342 158.826 29.483 52.94 10.141 52.94 10.141-11.41-19.043C371.18 14.363 322.753 5.488 281.339 2.143 239.925-1.201 203.371.916 203.371.916z"
                fill="currentColor"
              />
            </svg>
          </span>
        ) : (
          part
        ),
      )}
    </h2>
  )
}

// ============================================================================
// Integration logo with letter-avatar fallback
// ============================================================================

function IntegrationLogo({ integration }: { integration: IntegrationDefinition }) {
  const [imgError, setImgError] = useState(false)

  if (imgError || !integration.logo) {
    return (
      <div
        className="flex h-[47px] w-[47px] shrink-0 items-center justify-center rounded-md text-base font-semibold text-white"
        style={{ backgroundColor: integration.brandColor }}
      >
        {integration.name.charAt(0)}
      </div>
    )
  }

  return (
    <div className="relative h-[47px] w-[47px] shrink-0">
      <Image
        src={integration.logo}
        alt={`${integration.name} logo`}
        fill
        className="object-contain"
        onError={() => setImgError(true)}
        unoptimized
      />
    </div>
  )
}

// ============================================================================
// Single integration row (icon + text, no card)
// ============================================================================

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 20 },
  },
}

function IntegrationRow({
  integration,
  comingSoon = false,
}: {
  integration: IntegrationDefinition
  comingSoon?: boolean
}) {
  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        'flex items-start gap-4 transition-opacity',
        comingSoon && 'opacity-60 hover:opacity-100',
      )}
    >
      <IntegrationLogo integration={integration} />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-foreground">
          {integration.name}
          {comingSoon && (
            <span className="ml-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Soon
            </span>
          )}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          {integration.description}
        </p>
      </div>
    </motion.div>
  )
}

// ============================================================================
// "And many more" final tile
// ============================================================================

function MoreTile() {
  return (
    <motion.div variants={itemVariants} className="flex items-start gap-4">
      <div className="flex h-[47px] w-[47px] shrink-0 items-center justify-center">
        <Plus className="h-10 w-10 text-foreground" strokeWidth={2.5} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-foreground">And many more</h3>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          New connectors ship every month. Need one we don&apos;t have yet?{' '}
          <a
            href="mailto:hello@vroomx.com?subject=Integration%20request"
            className="font-medium text-foreground underline underline-offset-2 hover:text-foreground/70"
          >
            Request it
          </a>
          .
        </p>
      </div>
    </motion.div>
  )
}

// ============================================================================
// Main section
// ============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

export function IntegrationsSection() {
  const all = getAllIntegrations()
  const active = all.filter((i) => i.status === 'available')
  const comingSoon = all.filter((i) => i.status === 'coming_soon')

  // Show 4 active + first 7 coming soon = 11 items + "And many more" tile = 12 total
  const displayedComingSoon = comingSoon.slice(0, 7)

  return (
    <section className="border-t border-border-subtle bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="max-w-2xl">
          <HighlightedTitle text="Connect your ~favorite~ tools" />
          <p className="mt-6 text-base text-muted-foreground sm:text-lg leading-relaxed max-w-xl">
            Save time using popular integrations to sync your fleet data with the tools you already use.
          </p>
        </div>

        {/* ── Integration grid ──────────────────────────────────────────── */}
        <motion.div
          className="mt-16 grid grid-cols-1 gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          {/* Active integrations first */}
          {active.map((integration) => (
            <IntegrationRow key={integration.slug} integration={integration} />
          ))}

          {/* Coming soon next, slightly faded */}
          {displayedComingSoon.map((integration) => (
            <IntegrationRow key={integration.slug} integration={integration} comingSoon />
          ))}

          {/* Final "And many more" tile */}
          <MoreTile />
        </motion.div>
      </div>
    </section>
  )
}
