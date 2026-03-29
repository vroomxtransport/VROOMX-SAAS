'use client'

import { cn } from '@/lib/utils'

interface IntegrationStatusProps {
  connected: boolean
  syncing?: boolean
  error?: string
  lastSync?: string
}

export function IntegrationStatus({
  connected,
  syncing,
  error,
  lastSync,
}: IntegrationStatusProps) {
  if (error) {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
        <span className="text-sm font-medium text-red-600">
          Error
        </span>
        {lastSync && (
          <span className="text-xs text-muted-foreground">
            {lastSync}
          </span>
        )}
      </div>
    )
  }

  if (syncing) {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inset-0 h-2.5 w-2.5 animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
        </span>
        <span className="text-sm font-medium text-amber-600">
          Syncing...
        </span>
      </div>
    )
  }

  if (connected) {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inset-0 h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <span className="text-sm font-medium text-emerald-600">
          Connected
        </span>
        {lastSync && (
          <span className="text-xs text-muted-foreground">
            Synced {lastSync}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
      </span>
      <span className="text-sm font-medium text-muted-foreground">
        Not connected
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Compact dot-only variant for inline use
// ---------------------------------------------------------------------------

interface StatusDotProps {
  connected: boolean
  syncing?: boolean
  error?: boolean
  className?: string
}

export function StatusDot({ connected, syncing, error, className }: StatusDotProps) {
  return (
    <span className={cn('relative inline-flex h-2 w-2', className)}>
      {(connected || syncing) && !error && (
        <span
          className={cn(
            'absolute inset-0 rounded-full opacity-75 animate-ping',
            syncing ? 'bg-amber-400' : 'bg-emerald-400'
          )}
        />
      )}
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          error
            ? 'bg-red-500'
            : syncing
              ? 'bg-amber-500'
              : connected
                ? 'bg-emerald-500'
                : 'bg-gray-300'
        )}
      />
    </span>
  )
}
