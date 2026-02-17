'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil, Calendar, DollarSign } from 'lucide-react'
import {
  MAINTENANCE_TYPE_LABELS,
  MAINTENANCE_STATUS_LABELS,
  MAINTENANCE_STATUS_COLORS,
} from '@/types'
import type { MaintenanceRecord } from '@/types/database'
import type { MaintenanceType, MaintenanceStatus } from '@/types'
import { cn } from '@/lib/utils'

interface MaintenanceRowProps {
  record: MaintenanceRecord
  onClick: () => void
  onEdit: (e: React.MouseEvent) => void
}

export function MaintenanceRow({ record, onClick, onEdit }: MaintenanceRowProps) {
  const truckUnit = record.truck?.unit_number ?? 'Unassigned'
  const cost = typeof record.cost === 'string' ? parseFloat(record.cost) : record.cost
  const statusColors = MAINTENANCE_STATUS_COLORS[record.status as MaintenanceStatus] ?? ''
  const statusLabel = MAINTENANCE_STATUS_LABELS[record.status as MaintenanceStatus] ?? record.status
  const typeLabel = MAINTENANCE_TYPE_LABELS[record.maintenance_type as MaintenanceType] ?? record.maintenance_type

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
      className="flex w-full items-center gap-3 rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-left shadow-sm transition-colors card-hover hover:border-brand/30 focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1">
        <span className="text-sm font-semibold text-foreground">{truckUnit}</span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
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

      <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground shrink-0 w-[200px]">
        {record.scheduled_date && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(record.scheduled_date).toLocaleDateString()}
          </span>
        )}
        {record.vendor && (
          <span className="truncate">{record.vendor}</span>
        )}
      </div>

      <div className="hidden lg:flex items-center gap-1 text-xs font-medium text-muted-foreground shrink-0 w-[100px]">
        {cost > 0 && (
          <>
            <DollarSign className="h-3 w-3" />
            {cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </>
        )}
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
