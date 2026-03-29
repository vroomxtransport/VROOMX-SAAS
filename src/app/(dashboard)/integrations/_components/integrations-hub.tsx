'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, Puzzle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/page-header'
import {
  getAllIntegrations,
  CATEGORY_LABELS,
  type IntegrationCategory,
  type IntegrationDefinition,
} from '@/lib/integrations/registry'
import { IntegrationCard } from './integration-card'
import { CategoryFilter } from './category-filter'
import { RequestIntegration } from './request-integration'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IntegrationsHubProps {
  connectedSlugs: string[]
  lastSyncMap: Record<string, string>
}

// ---------------------------------------------------------------------------
// Debounced value hook
// ---------------------------------------------------------------------------

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => setDebounced(value), delayMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [value, delayMs])

  return debounced
}

// ---------------------------------------------------------------------------
// Section component
// ---------------------------------------------------------------------------

interface SectionProps {
  title: string
  subtitle?: string
  children: React.ReactNode
}

function Section({ title, subtitle, children }: SectionProps) {
  return (
    <div>
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground/70">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function IntegrationsHub({ connectedSlugs, lastSyncMap }: IntegrationsHubProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<IntegrationCategory | null>(null)
  const [showConnectedOnly, setShowConnectedOnly] = useState(false)

  const debouncedQuery = useDebouncedValue(searchQuery, 300)
  const allIntegrations = useMemo(() => getAllIntegrations(), [])

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------

  const filtered = useMemo(() => {
    let items = allIntegrations

    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase()
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          CATEGORY_LABELS[i.category].toLowerCase().includes(q)
      )
    }

    if (categoryFilter) {
      items = items.filter((i) => i.category === categoryFilter)
    }

    if (showConnectedOnly) {
      items = items.filter((i) => connectedSlugs.includes(i.slug))
    }

    return items
  }, [allIntegrations, debouncedQuery, categoryFilter, showConnectedOnly, connectedSlugs])

  // Split into groups
  const connected = useMemo(
    () => filtered.filter((i) => connectedSlugs.includes(i.slug)),
    [filtered, connectedSlugs]
  )
  const available = useMemo(
    () => filtered.filter((i) => i.status === 'available' && !connectedSlugs.includes(i.slug)),
    [filtered, connectedSlugs]
  )
  const comingSoon = useMemo(
    () => filtered.filter((i) => i.status === 'coming_soon'),
    [filtered]
  )

  const hasResults = connected.length > 0 || available.length > 0 || comingSoon.length > 0

  // Compute stagger offsets per section
  const connectedOffset = 0
  const availableOffset = connected.length
  const comingSoonOffset = connected.length + available.length

  // ---------------------------------------------------------------------------
  // Render grid helper
  // ---------------------------------------------------------------------------

  function renderGrid(items: IntegrationDefinition[], startIndex: number) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((integration, idx) => (
          <IntegrationCard
            key={integration.slug}
            integration={integration}
            isConnected={connectedSlugs.includes(integration.slug)}
            lastSync={lastSyncMap[integration.slug] ?? null}
            index={startIndex + idx}
          />
        ))}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Integrations"
        subtitle="Connect your fleet tools to supercharge VroomX"
      />

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search integrations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-10 rounded-xl"
          aria-label="Search integrations"
        />
      </div>

      {/* Filters row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CategoryFilter selected={categoryFilter} onChange={setCategoryFilter} />

        {/* Status toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowConnectedOnly(false)}
            className={cn(
              'inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200',
              !showConnectedOnly
                ? 'bg-brand text-brand-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            All
          </button>
          <button
            onClick={() => setShowConnectedOnly(true)}
            className={cn(
              'inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200',
              showConnectedOnly
                ? 'bg-brand text-brand-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            Connected
            {connectedSlugs.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1 text-xs font-bold">
                {connectedSlugs.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="gradient-divider" />

      {/* Content */}
      {!hasResults ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border-subtle py-16 text-center animate-fade-up">
          <div className="mb-3 rounded-xl bg-accent p-3">
            <Puzzle className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mb-1 text-base font-semibold text-foreground">
            No integrations found
          </h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Try adjusting your search or filters to find what you&apos;re looking for.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {connected.length > 0 && (
            <Section
              title="Connected"
              subtitle={`${connected.length} integration${connected.length !== 1 ? 's' : ''} active`}
            >
              {renderGrid(connected, connectedOffset)}
            </Section>
          )}

          {available.length > 0 && (
            <Section title="Available">
              {renderGrid(available, availableOffset)}
            </Section>
          )}

          {comingSoon.length > 0 && (
            <Section title="Coming Soon">
              {renderGrid(comingSoon, comingSoonOffset)}
            </Section>
          )}
        </div>
      )}

      {/* Request CTA */}
      <RequestIntegration />
    </div>
  )
}
