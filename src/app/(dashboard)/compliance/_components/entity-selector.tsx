'use client'

import { useEffect, useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EntitySelectorProps {
  entityType: 'driver' | 'truck'
  value: string
  onChange: (id: string) => void
  label?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EntitySelector({
  entityType,
  value,
  onChange,
  label,
}: EntitySelectorProps) {
  const { data: driversData, isLoading: driversLoading } = useDrivers()
  const { data: trucksData, isLoading: trucksLoading } = useTrucks()

  const isLoading = entityType === 'driver' ? driversLoading : trucksLoading
  const drivers = useMemo(() => driversData?.drivers ?? [], [driversData])
  const trucks = useMemo(() => trucksData?.trucks ?? [], [trucksData])

  // Auto-select the first entity when data loads and nothing is selected
  useEffect(() => {
    if (value) return
    if (entityType === 'driver' && drivers.length > 0) {
      onChange(drivers[0].id)
    } else if (entityType === 'truck' && trucks.length > 0) {
      onChange(trucks[0].id)
    }
  }, [entityType, value, drivers, trucks, onChange])

  const displayLabel = label ?? (entityType === 'driver' ? 'Select Driver' : 'Select Vehicle')

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium text-foreground">{displayLabel}</Label>

      {isLoading ? (
        <Skeleton className="h-10 w-full max-w-xs" />
      ) : (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue
              placeholder={
                entityType === 'driver' ? 'Select a driver...' : 'Select a vehicle...'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {entityType === 'driver' &&
              drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.first_name} {driver.last_name}
                </SelectItem>
              ))}

            {entityType === 'truck' &&
              trucks.map((truck) => (
                <SelectItem key={truck.id} value={truck.id}>
                  #{truck.unit_number}
                  {truck.make ? ` — ${truck.make}` : ''}
                  {truck.model ? ` ${truck.model}` : ''}
                </SelectItem>
              ))}

            {entityType === 'driver' && drivers.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No drivers found</div>
            )}

            {entityType === 'truck' && trucks.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No vehicles found</div>
            )}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
