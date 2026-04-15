'use client'

import { useState } from 'react'
import { EntityCard } from '@/components/shared/entity-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2, CheckCircle2, AlertTriangle, ShieldAlert, ClipboardCheck, MapPin, User, Truck, DollarSign, Hash, Car, AlertOctagon } from 'lucide-react'
import {
  SAFETY_EVENT_TYPE_LABELS,
  SAFETY_EVENT_SEVERITY_LABELS,
  SAFETY_EVENT_SEVERITY_COLORS,
  SAFETY_EVENT_STATUS_LABELS,
  SAFETY_EVENT_STATUS_COLORS,
  DOT_INSPECTION_LEVEL_LABELS,
} from '@/types'
import type { SafetyEventType, SafetyEventSeverity, SafetyEventStatus, DotInspectionLevel } from '@/types'
import type { SafetyEvent } from '@/types/database'
import { cn } from '@/lib/utils'

const SEVERITY_LEFT_BORDER: Record<SafetyEventSeverity, string> = {
  minor: 'border-l-blue-400',
  moderate: 'border-l-amber-400',
  severe: 'border-l-orange-500',
  critical: 'border-l-red-600',
}

const EVENT_TYPE_ICON: Record<SafetyEventType, React.ElementType> = {
  incident: AlertTriangle,
  claim: ShieldAlert,
  dot_inspection: ClipboardCheck,
}

const EVENT_TYPE_ICON_COLOR: Record<SafetyEventType, string> = {
  incident: 'text-red-500',
  claim: 'text-amber-500',
  dot_inspection: 'text-blue-500',
}

function formatCurrency(value: string | null): string | null {
  if (!value) return null
  const n = parseFloat(value)
  if (isNaN(n)) return null
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface EventCardProps {
  event: SafetyEvent
  onEdit: () => void
  onDelete: () => void
  onResolve?: () => void
}

export function EventCard({ event, onEdit, onDelete, onResolve }: EventCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const TypeIcon = EVENT_TYPE_ICON[event.event_type]
  const severity = event.severity as SafetyEventSeverity
  const status = event.status as SafetyEventStatus
  const isResolvable = status === 'open' || status === 'under_review'
  const financialDisplay = formatCurrency(event.financial_amount)
  const deductionDisplay = formatCurrency(event.deduction_amount)

  const handleDeleteClick = () => {
    if (confirmDelete) {
      onDelete()
    } else {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  return (
    <EntityCard
      className={cn('border-l-4', SEVERITY_LEFT_BORDER[severity])}
    >
      {/* Row 1: type icon + title + badges */}
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0">
          <TypeIcon className={cn('h-4 w-4', EVENT_TYPE_ICON_COLOR[event.event_type])} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground leading-snug">
            {event.title}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {SAFETY_EVENT_TYPE_LABELS[event.event_type]}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge
            variant="outline"
            className={cn('text-xs', SAFETY_EVENT_SEVERITY_COLORS[severity])}
          >
            {SAFETY_EVENT_SEVERITY_LABELS[severity]}
          </Badge>
          <Badge
            variant="outline"
            className={cn('text-xs', SAFETY_EVENT_STATUS_COLORS[status])}
          >
            {SAFETY_EVENT_STATUS_LABELS[status]}
          </Badge>
        </div>
      </div>

      {/* Row 2: meta info */}
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {/* Date */}
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{formatDate(event.event_date)}</span>
        </span>

        {/* Location */}
        {(event.location || event.location_state) && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            {[event.location, event.location_state].filter(Boolean).join(', ')}
          </span>
        )}

        {/* Driver */}
        {event.driver && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3 shrink-0" />
            {event.driver.first_name} {event.driver.last_name}
          </span>
        )}

        {/* Truck */}
        {event.truck && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Truck className="h-3 w-3 shrink-0" />
            #{event.truck.unit_number}
          </span>
        )}
      </div>

      {/* Row 3: type-specific details */}
      {event.event_type === 'claim' && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          {event.vehicle_vin && (
            <span className="flex items-center gap-1 text-xs">
              <Car className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="font-mono text-foreground">{event.vehicle_vin}</span>
            </span>
          )}
          {financialDisplay && (
            <span className="flex items-center gap-1 text-xs">
              <DollarSign className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="font-semibold text-foreground">{financialDisplay}</span>
            </span>
          )}
          {deductionDisplay && (
            <span className="text-xs text-muted-foreground">
              Driver deduction: <span className="font-medium text-foreground">{deductionDisplay}</span>
            </span>
          )}
          {event.insurance_claim_number && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Hash className="h-3 w-3 shrink-0" />
              {event.insurance_claim_number}
            </span>
          )}
        </div>
      )}

      {event.event_type === 'incident' && financialDisplay && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          <DollarSign className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="font-semibold text-foreground">{financialDisplay}</span>
          <span className="text-muted-foreground">financial impact</span>
        </div>
      )}

      {event.event_type === 'dot_inspection' && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          {event.inspection_level && (
            <Badge variant="outline" className="text-xs text-blue-700">
              {DOT_INSPECTION_LEVEL_LABELS[event.inspection_level as DotInspectionLevel]}
            </Badge>
          )}
          {event.violations_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-600">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {event.violations_count} violation{event.violations_count !== 1 ? 's' : ''}
            </span>
          )}
          {event.out_of_service && (
            <span className="flex items-center gap-1 text-xs font-semibold text-destructive">
              <AlertOctagon className="h-3 w-3 shrink-0" />
              Out of Service
            </span>
          )}
        </div>
      )}

      {/* Photos count */}
      {event.photos && event.photos.length > 0 && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {event.photos.length} photo{event.photos.length !== 1 ? 's' : ''} attached
        </p>
      )}

      {/* Action row */}
      <div className="mt-3 flex items-center justify-end gap-1 border-t border-border-subtle pt-2.5">
        {isResolvable && onResolve && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-green-700 hover:text-green-700"
            onClick={onResolve}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Resolve
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onEdit}
          title="Edit event"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 w-7 p-0 transition-colors',
            confirmDelete
              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              : 'text-destructive hover:text-destructive hover:bg-destructive/10'
          )}
          onClick={handleDeleteClick}
          title={confirmDelete ? 'Click again to confirm deletion' : 'Delete event'}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </EntityCard>
  )
}
