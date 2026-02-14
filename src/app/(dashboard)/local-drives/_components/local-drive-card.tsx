'use client'

import { EntityCard } from '@/components/shared/entity-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil, MapPin, Calendar, DollarSign, User, Truck } from 'lucide-react'
import { LOCAL_DRIVE_STATUS_LABELS, LOCAL_DRIVE_STATUS_COLORS } from '@/types'
import type { LocalDrive } from '@/types/database'
import type { LocalDriveStatus } from '@/types'
import { cn } from '@/lib/utils'

interface LocalDriveCardProps {
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

export function LocalDriveCard({ localDrive, onClick, onEdit }: LocalDriveCardProps) {
  const status = localDrive.status as LocalDriveStatus
  const colorClasses = LOCAL_DRIVE_STATUS_COLORS[status] ?? 'bg-gray-50 text-gray-700 border-gray-200'
  const statusLabel = LOCAL_DRIVE_STATUS_LABELS[status] ?? localDrive.status

  const driverName = localDrive.driver
    ? `${localDrive.driver.first_name} ${localDrive.driver.last_name}`
    : null
  const truckUnit = localDrive.truck?.unit_number ?? null

  return (
    <EntityCard onClick={onClick}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{formatRoute(localDrive)}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant="outline" className={cn('gap-1.5', colorClasses)}>
              {statusLabel}
            </Badge>
          </div>
        </div>
        <div className="ml-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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

      <div className="mt-3 space-y-1">
        {driverName && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <User className="h-3 w-3" />
            <span>{driverName}</span>
          </div>
        )}
        {truckUnit && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Truck className="h-3 w-3" />
            <span>Unit #{truckUnit}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Calendar className="h-3 w-3" />
          <span>{formatDate(localDrive.scheduled_date)}</span>
        </div>
      </div>

      <div className="mt-3 border-t border-gray-100 pt-2">
        <div className="flex items-center gap-1 text-xs font-medium text-gray-600">
          <DollarSign className="h-3 w-3" />
          <span>{formatRevenue(localDrive.revenue)}</span>
        </div>
      </div>
    </EntityCard>
  )
}
