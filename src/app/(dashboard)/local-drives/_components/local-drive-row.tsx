'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil, MapPin, Calendar, DollarSign } from 'lucide-react'
import { LOCAL_DRIVE_STATUS_LABELS, LOCAL_DRIVE_STATUS_COLORS } from '@/types'
import type { LocalDrive } from '@/types/database'
import type { LocalDriveStatus } from '@/types'
import { cn } from '@/lib/utils'

interface LocalDriveRowProps {
  localDrive: LocalDrive
  onClick: () => void
  onEdit: (e: React.MouseEvent) => void
}

function formatRoute(localDrive: LocalDrive): string {
  const pickup = [localDrive.pickup_city, localDrive.pickup_state].filter(Boolean).join(', ')
  const delivery = [localDrive.delivery_city, localDrive.delivery_state].filter(Boolean).join(', ')
  if (pickup && delivery) return `${pickup} → ${delivery}`
  if (pickup) return `From: ${pickup}`
  if (delivery) return `To: ${delivery}`
  return 'No route set'
}

function formatDate(date: string | null): string {
  if (!date) return 'Not scheduled'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatRevenue(revenue: string): string {
  const num = parseFloat(revenue)
  if (isNaN(num) || num === 0) return '$0.00'
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function LocalDriveRow({ localDrive, onClick, onEdit }: LocalDriveRowProps) {
  const status = localDrive.status as LocalDriveStatus
  const colorClasses = LOCAL_DRIVE_STATUS_COLORS[status] ?? 'bg-gray-50 text-gray-700 border-gray-200'
  const statusLabel = LOCAL_DRIVE_STATUS_LABELS[status] ?? localDrive.status

  const driverName = localDrive.driver
    ? `${localDrive.driver.first_name} ${localDrive.driver.last_name}`
    : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className="flex w-full items-center gap-4 rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-left shadow-sm transition-colors card-hover hover:border-brand/30 focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-semibold text-gray-900">
            {formatRoute(localDrive)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Badge variant="outline" className={cn('gap-1.5', colorClasses)}>
          {statusLabel}
        </Badge>
      </div>

      {driverName && (
        <div className="hidden md:block text-xs text-gray-500 shrink-0 w-[140px] truncate">
          {driverName}
        </div>
      )}

      <div className="hidden lg:flex items-center gap-1 text-xs text-gray-500 shrink-0 w-[120px]">
        <Calendar className="h-3 w-3" />
        {formatDate(localDrive.scheduled_date)}
      </div>

      <div className="hidden lg:flex items-center gap-1 text-xs font-medium text-gray-600 shrink-0 w-[80px]">
        <DollarSign className="h-3 w-3" />
        {formatRevenue(localDrive.revenue)}
      </div>

      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
