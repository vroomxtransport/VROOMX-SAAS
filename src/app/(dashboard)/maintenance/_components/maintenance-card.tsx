'use client'

import { EntityCard } from '@/components/shared/entity-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil, Truck, Calendar, DollarSign, Building2 } from 'lucide-react'
import {
  MAINTENANCE_TYPE_LABELS,
  MAINTENANCE_STATUS_LABELS,
  MAINTENANCE_STATUS_COLORS,
} from '@/types'
import type { MaintenanceRecord } from '@/types/database'
import type { MaintenanceType, MaintenanceStatus } from '@/types'
import { cn } from '@/lib/utils'

interface MaintenanceCardProps {
  record: MaintenanceRecord
  onClick: () => void
  onEdit: (e: React.MouseEvent) => void
}

export function MaintenanceCard({ record, onClick, onEdit }: MaintenanceCardProps) {
  const truckUnit = record.truck?.unit_number ?? 'Unassigned'
  const cost = typeof record.cost === 'string' ? parseFloat(record.cost) : record.cost
  const statusColors = MAINTENANCE_STATUS_COLORS[record.status as MaintenanceStatus] ?? ''
  const statusLabel = MAINTENANCE_STATUS_LABELS[record.status as MaintenanceStatus] ?? record.status
  const typeLabel = MAINTENANCE_TYPE_LABELS[record.maintenance_type as MaintenanceType] ?? record.maintenance_type

  return (
    <EntityCard onClick={onClick}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
            <h3 className="truncate text-sm font-semibold text-foreground">{truckUnit}</h3>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant="outline" className={cn('gap-1.5', statusColors)}>
              <span className="relative flex h-1.5 w-1.5">
                <span className={cn(
                  'relative inline-flex h-1.5 w-1.5 rounded-full',
                  record.status === 'scheduled' ? 'bg-blue-400' :
                  record.status === 'in_progress' ? 'bg-amber-400' : 'bg-green-400'
                )} />
              </span>
              {statusLabel}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {typeLabel}
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

      <div className="mt-2 space-y-1.5">
        {record.scheduled_date && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{new Date(record.scheduled_date).toLocaleDateString()}</span>
          </div>
        )}
        {record.vendor && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span className="truncate">{record.vendor}</span>
          </div>
        )}
        {cost > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            <span>${cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        )}
      </div>

      {record.description && (
        <div className="mt-2 border-t border-border pt-1.5">
          <p className="text-xs text-muted-foreground line-clamp-2">{record.description}</p>
        </div>
      )}
    </EntityCard>
  )
}
