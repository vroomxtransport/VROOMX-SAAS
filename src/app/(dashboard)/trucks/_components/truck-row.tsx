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
import { Pencil, Truck as TruckIcon } from 'lucide-react'
import type { Truck } from '@/types/database'
import { TRUCK_TYPE_LABELS } from '@/types'
import type { TruckType, TruckStatus } from '@/types'
import { updateTruckStatus } from '@/app/actions/trucks'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

interface TruckRowProps {
  truck: Truck
  onClick: () => void
  onEdit: () => void
}

export function TruckRow({ truck, onClick, onEdit }: TruckRowProps) {
  const queryClient = useQueryClient()
  const [isUpdating, setIsUpdating] = useState(false)

  const handleStatusChange = async (value: string) => {
    setIsUpdating(true)
    try {
      await updateTruckStatus(truck.id, value as TruckStatus)
      queryClient.invalidateQueries({ queryKey: ['trucks'] })
    } finally {
      setIsUpdating(false)
    }
  }

  const vehicleLine = [truck.year, truck.make, truck.model]
    .filter(Boolean)
    .join(' ')

  const truncatedVin = truck.vin
    ? `${truck.vin.slice(0, 8)}...${truck.vin.slice(-4)}`
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
      <div className="flex items-center gap-2 min-w-0 shrink-0 w-[100px]">
        <TruckIcon className="h-4 w-4 shrink-0 text-gray-400" />
        <span className="text-sm font-semibold text-gray-900 truncate">
          {truck.unit_number}
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <StatusBadge status={truck.truck_status} type="truck" />
        <Badge variant="outline" className="text-xs">
          {TRUCK_TYPE_LABELS[truck.truck_type as TruckType]}
        </Badge>
        {truck.ownership === 'owner_operator' && (
          <Badge
            variant="outline"
            className="bg-purple-50 text-xs text-purple-700 border-purple-200"
          >
            Owner-Op
          </Badge>
        )}
      </div>

      <div className="hidden md:block text-xs text-gray-500 min-w-0 flex-1 truncate">
        {vehicleLine}
      </div>

      {truncatedVin && (
        <div className="hidden lg:block font-mono text-xs text-gray-400 shrink-0 w-[140px]">
          VIN: {truncatedVin}
        </div>
      )}

      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        <Select
          value={truck.truck_status}
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
