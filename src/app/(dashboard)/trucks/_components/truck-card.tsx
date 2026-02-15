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
import { Pencil, Truck as TruckIcon } from 'lucide-react'
import type { Truck } from '@/types/database'
import { TRUCK_TYPE_LABELS } from '@/types'
import type { TruckType, TruckStatus } from '@/types'
import { updateTruckStatus } from '@/app/actions/trucks'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

interface TruckCardProps {
  truck: Truck
  onClick: () => void
  onEdit: () => void
}

export function TruckCard({ truck, onClick, onEdit }: TruckCardProps) {
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
    <EntityCard onClick={onClick}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <TruckIcon className="h-4 w-4 shrink-0 text-gray-400" />
            <h3 className="truncate text-sm font-semibold text-gray-900">
              {truck.unit_number}
            </h3>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={truck.truck_status} type="truck" />
            <Badge variant="outline" className="text-xs">
              {TRUCK_TYPE_LABELS[truck.truck_type as TruckType]}
            </Badge>
            {truck.ownership === 'owner_operator' && (
              <Badge
                variant="outline"
                className="bg-purple-50 text-xs text-purple-700 border-purple-200"
              >
                Owner-Operator
              </Badge>
            )}
          </div>
        </div>

        <div className="ml-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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

      <div className="mt-2 space-y-1">
        {vehicleLine && (
          <p className="text-xs text-gray-500">{vehicleLine}</p>
        )}
        {truncatedVin && (
          <p className="font-mono text-xs text-gray-400">
            VIN: {truncatedVin}
          </p>
        )}
      </div>
    </EntityCard>
  )
}
