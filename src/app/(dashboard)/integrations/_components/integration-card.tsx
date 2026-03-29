'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { IntegrationDefinition, IntegrationTag } from '@/lib/integrations/registry'

// ---------------------------------------------------------------------------
// Tag badge styling
// ---------------------------------------------------------------------------

const TAG_STYLES: Record<IntegrationTag, string> = {
  official: 'bg-brand/10 text-brand border-brand/20',
  popular: 'bg-amber-50 text-amber-700 border-amber-200',
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  beta: 'bg-violet-50 text-violet-700 border-violet-200',
}

const TAG_LABELS: Record<IntegrationTag, string> = {
  official: 'Official',
  popular: 'Popular',
  new: 'New',
  beta: 'Beta',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface IntegrationCardProps {
  integration: IntegrationDefinition
  isConnected: boolean
  lastSync?: string | null
  index: number
}

export function IntegrationCard({
  integration,
  isConnected,
  lastSync,
  index,
}: IntegrationCardProps) {
  const [imgError, setImgError] = useState(false)
  const isComingSoon = integration.status === 'coming_soon'

  const syncLabel = lastSync
    ? formatDistanceToNow(new Date(lastSync), { addSuffix: true })
    : null

  const cardContent = (
    <div
      className={cn(
        'group relative flex flex-col rounded-2xl p-5 transition-all duration-200 animate-fade-up',
        // Connected state
        isConnected && [
          'widget-card',
          'border-emerald-300/50',
          'shadow-[0_0_24px_rgba(16,185,129,0.08)]',
        ],
        // Available (not connected)
        !isConnected && !isComingSoon && 'widget-card card-hover',
        // Coming soon
        isComingSoon && [
          'border border-dashed border-border/50 bg-surface opacity-80',
          'hover:opacity-100 hover:border-border',
        ]
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Top row: logo + status */}
      <div className="flex items-start justify-between gap-3">
        {!imgError ? (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-white p-1.5">
            <Image
              src={integration.logo}
              alt={integration.name}
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
              onError={() => setImgError(true)}
            />
          </div>
        ) : (
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white font-bold text-lg select-none"
            style={{ backgroundColor: integration.brandColor }}
          >
            {integration.name.charAt(0)}
          </div>
        )}

        {isConnected && (
          <div className="flex flex-col items-end gap-1">
            <Badge className="gap-1.5 bg-emerald-100 text-emerald-700 border-emerald-200">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Connected
            </Badge>
            {syncLabel && (
              <span className="text-[11px] text-muted-foreground">
                Synced {syncLabel}
              </span>
            )}
          </div>
        )}

        {isComingSoon && (
          <Badge
            variant="secondary"
            className="text-muted-foreground border-border"
          >
            Coming Soon
          </Badge>
        )}
      </div>

      {/* Name + description */}
      <div className="mt-4 flex-1">
        <h3 className="text-sm font-semibold text-foreground group-hover:text-brand transition-colors">
          {integration.name}
        </h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground line-clamp-2">
          {integration.description}
        </p>
      </div>

      {/* Tags + CTA */}
      <div className="mt-4 flex items-end justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {integration.tags.map((tag) => (
            <span
              key={tag}
              className={cn(
                'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium',
                TAG_STYLES[tag]
              )}
            >
              {TAG_LABELS[tag]}
            </span>
          ))}
        </div>

        {!isComingSoon && (
          <Button
            variant={isConnected ? 'outline' : 'default'}
            size="sm"
            className="shrink-0 gap-1.5"
            asChild
          >
            <span>
              {isConnected ? 'Manage' : 'Connect'}
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Button>
        )}
      </div>
    </div>
  )

  // Wrap in Link for navigation
  return (
    <Link
      href={`/integrations/${integration.slug}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-2xl"
    >
      {cardContent}
    </Link>
  )
}
