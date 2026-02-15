'use client'

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
import type { TrailerType } from '@/types'
import { updateTrailer } from '@/app/actions/trailers'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

interface TrailerRowProps {
  trailer: Trailer & { assigned_truck?: { id: string; unit_number: string } | null }
  onEdit: () => void
}

export function TrailerRow({ trailer, onEdit }: TrailerRowProps) {
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
    <div
      className="flex w-full items-center gap-3 rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-left shadow-sm transition-colors card-hover hover:border-brand/30"
    >
      <div className="flex items-center gap-2 min-w-0 shrink-0 w-[100px]">
        <Container className="h-4 w-4 shrink-0 text-gray-400" />
        <span className="text-sm font-semibold text-gray-900 truncate">
          {trailer.trailer_number}
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <StatusBadge status={trailer.status} type="trailer" />
        <Badge variant="outline" className="text-xs">
          {TRAILER_TYPE_LABELS[trailer.trailer_type as TrailerType]}
        </Badge>
      </div>

      <div className="hidden md:block text-xs text-gray-500 min-w-0 flex-1 truncate">
        {vehicleLine}
      </div>

      {trailer.assigned_truck && (
        <div className="hidden md:flex items-center gap-1 text-xs text-blue-600 shrink-0">
          <TruckIcon className="h-3 w-3" />
          <span>{trailer.assigned_truck.unit_number}</span>
        </div>
      )}

      {truncatedVin && (
        <div className="hidden lg:block font-mono text-xs text-gray-400 shrink-0 w-[140px]">
          VIN: {truncatedVin}
        </div>
      )}

      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
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
  )
}
