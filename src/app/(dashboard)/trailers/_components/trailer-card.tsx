'use client'

import { EntityCard } from '@/components/shared/entity-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pencil, Container, Truck as TruckIcon } from 'lucide-react'
import type { Trailer } from '@/types/database'
import { TRAILER_TYPE_LABELS } from '@/types'
import type { TrailerType, TrailerStatus } from '@/types'
import { updateTrailer } from '@/app/actions/trailers'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

interface TrailerCardProps {
  trailer: Trailer & { assigned_truck?: { id: string; unit_number: string } | null }
  onEdit: () => void
}

export function TrailerCard({ trailer, onEdit }: TrailerCardProps) {
  const queryClient = useQueryClient()
  const [isUpdating, setIsUpdating] = useState(false)

  const handleStatusChange = async (value: string) => {
    setIsUpdating(true)
    try {
      await updateTrailer(trailer.id, {
        trailerNumber: trailer.trailer_number,
        trailerType: trailer.trailer_type,
        status: value,
      })
      queryClient.invalidateQueries({ queryKey: ['trailers'] })
    } finally {
      setIsUpdating(false)
    }
  }

  const vehicleLine = [trailer.year, trailer.make, trailer.model]
    .filter(Boolean)
    .join(' ')

  const truncatedVin = trailer.vin
    ? `${trailer.vin.slice(0, 8)}...${trailer.vin.slice(-4)}`
    : null

  return (
    <EntityCard>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Container className="h-4 w-4 shrink-0 text-muted-foreground/60" />
            <h3 className="truncate text-sm font-semibold text-foreground">
              {trailer.trailer_number}
            </h3>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={trailer.status} type="trailer" />
            <Badge variant="outline" className="text-xs">
              {TRAILER_TYPE_LABELS[trailer.trailer_type as TrailerType]}
            </Badge>
          </div>
        </div>

        <div className="ml-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Select
            value={trailer.status}
            onValueChange={handleStatusChange}
            disabled={isUpdating}
          >
            <SelectTrigger className="h-7 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-2 space-y-1">
        {vehicleLine && (
          <p className="text-xs text-muted-foreground">{vehicleLine}</p>
        )}
        {truncatedVin && (
          <p className="font-mono text-xs text-muted-foreground/60">
            VIN: {truncatedVin}
          </p>
        )}
        {trailer.assigned_truck && (
          <div className="flex items-center gap-1 text-xs text-blue-600">
            <TruckIcon className="h-3 w-3" />
            <span>{trailer.assigned_truck.unit_number}</span>
          </div>
        )}
      </div>
    </EntityCard>
  )
}
