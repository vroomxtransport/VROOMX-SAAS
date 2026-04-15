'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { RefreshCw, AlertCircle, Unlink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getQuickBooksStatus } from '@/app/actions/quickbooks'
import type { QBSyncStatus } from '@/lib/quickbooks/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BadgeVariant = 'synced' | 'error' | 'disconnected' | 'loading'

interface QBOSyncBadgeProps {
  /** Pre-fetched status — skips the client-side fetch if provided */
  lastSync?: string | null
  syncStatus?: QBSyncStatus
  /** Whether to fetch status on mount (default: false when props are provided) */
  fetchOnMount?: boolean
  /** Additional CSS classes */
  className?: string
  /** Whether to show as a link to the QB dashboard */
  linkable?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getVariant(
  syncStatus: QBSyncStatus | undefined,
  connected: boolean
): BadgeVariant {
  if (!connected || syncStatus === 'disconnected') return 'disconnected'
  if (syncStatus === 'error') return 'error'
  return 'synced'
}

function formatLastSync(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------------------
// Badge config
// ---------------------------------------------------------------------------

const BADGE_CONFIG: Record<
  BadgeVariant,
  {
    dotClass: string
    pulse: boolean
    labelClass: string
    label: (lastSync: string) => string
    icon: React.ReactNode
  }
> = {
  synced: {
    dotClass: 'bg-emerald-500',
    pulse: true,
    labelClass: 'text-emerald-700',
    label: (lastSync) => (lastSync ? `QBO Synced ${lastSync}` : 'QBO Synced'),
    icon: <RefreshCw className="h-3 w-3" />,
  },
  error: {
    dotClass: 'bg-red-500',
    pulse: false,
    labelClass: 'text-red-700',
    label: () => 'QBO Error',
    icon: <AlertCircle className="h-3 w-3" />,
  },
  disconnected: {
    dotClass: 'bg-gray-300',
    pulse: false,
    labelClass: 'text-muted-foreground bg-muted border-border',
    label: () => 'QBO Disconnected',
    icon: <Unlink className="h-3 w-3" />,
  },
  loading: {
    dotClass: 'bg-gray-300 animate-pulse',
    pulse: false,
    labelClass: 'text-muted-foreground bg-muted border-border',
    label: () => 'QBO...',
    icon: <RefreshCw className="h-3 w-3 animate-spin" />,
  },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QBOSyncBadge({
  lastSync: initialLastSync,
  syncStatus: initialSyncStatus,
  fetchOnMount = false,
  className,
  linkable = true,
}: QBOSyncBadgeProps) {
  const [lastSync, setLastSync] = useState<string | null | undefined>(initialLastSync)
  const [syncStatus, setSyncStatus] = useState<QBSyncStatus | undefined>(initialSyncStatus)
  const [connected, setConnected] = useState<boolean>(
    initialSyncStatus ? initialSyncStatus !== 'disconnected' : false
  )
  const [isFetching, setIsFetching] = useState(fetchOnMount && !initialSyncStatus)

  // If fetchOnMount is requested (no pre-fetched props), load status client-side
  useEffect(() => {
    if (!fetchOnMount || initialSyncStatus) return

    let cancelled = false

    const run = async () => {
      try {
        const result = await getQuickBooksStatus()
        if (cancelled) return
        if ('success' in result && result.success) {
          setLastSync(result.data.lastSync)
          setSyncStatus(result.data.syncStatus)
          setConnected(result.data.connected)
        }
      } catch {
        // Silently ignore — badge degrades gracefully
      } finally {
        if (!cancelled) setIsFetching(false)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [fetchOnMount, initialSyncStatus])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const variant: BadgeVariant = isFetching
    ? 'loading'
    : getVariant(syncStatus, connected)

  const config = BADGE_CONFIG[variant]
  const lastSyncText = formatLastSync(lastSync)
  const label = config.label(lastSyncText)

  const badge = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        config.labelClass,
        linkable && variant !== 'loading' && 'cursor-pointer hover:opacity-80',
        className
      )}
      title={label}
    >
      {/* Status dot */}
      <span className="relative inline-flex h-2 w-2 shrink-0">
        {config.pulse && (
          <span
            className={cn(
              'absolute inset-0 h-2 w-2 animate-ping rounded-full opacity-75',
              config.dotClass
            )}
          />
        )}
        <span className={cn('h-2 w-2 rounded-full', config.dotClass)} />
      </span>

      {/* Icon + text */}
      <span className="flex items-center gap-1">
        {config.icon}
        <span>{label}</span>
      </span>
    </span>
  )

  if (linkable && variant !== 'loading') {
    return (
      <Link
        href="/integrations/quickbooks"
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-full"
        tabIndex={0}
        aria-label={label}
      >
        {badge}
      </Link>
    )
  }

  return badge
}

// ---------------------------------------------------------------------------
// Server-friendly wrapper — accepts pre-fetched props, no client fetch
// ---------------------------------------------------------------------------

interface QBOSyncBadgeStaticProps {
  lastSync: string | null
  syncStatus: QBSyncStatus
  className?: string
  linkable?: boolean
}

/**
 * Use this in server components or when you already have the status data.
 * Zero client-side fetch overhead.
 */
export function QBOSyncBadgeStatic({
  lastSync,
  syncStatus,
  className,
  linkable,
}: QBOSyncBadgeStaticProps) {
  return (
    <QBOSyncBadge
      lastSync={lastSync}
      syncStatus={syncStatus}
      fetchOnMount={false}
      className={className}
      linkable={linkable}
    />
  )
}
