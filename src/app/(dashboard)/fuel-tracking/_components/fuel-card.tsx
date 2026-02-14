'use client'

import { EntityCard } from '@/components/shared/entity-card'
import { Button } from '@/components/ui/button'
import { Pencil, Fuel, MapPin, Gauge } from 'lucide-react'
import type { FuelEntry } from '@/types/database'

interface FuelCardProps {
  entry: FuelEntry
  onEdit: (e: React.MouseEvent) => void
}

export function FuelCard({ entry, onEdit }: FuelCardProps) {
  const gallons = parseFloat(entry.gallons) || 0
  const costPerGallon = parseFloat(entry.cost_per_gallon) || 0
  const totalCost = parseFloat(entry.total_cost) || 0
  const truckUnit = (entry.truck as { unit_number?: string } | null)?.unit_number ?? 'Unassigned'
  const driver = entry.driver as { first_name?: string; last_name?: string } | null
  const driverName = driver ? `${driver.first_name} ${driver.last_name}` : null

  return (
    <EntityCard>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Fuel className="h-4 w-4 text-muted-foreground shrink-0" />
            <h3 className="truncate text-sm font-semibold text-foreground">
              {new Date(entry.date).toLocaleDateString()}
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Truck: {truckUnit}
            {driverName && ` | Driver: ${driverName}`}
          </p>
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

      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Gallons</p>
          <p className="text-sm font-semibold text-foreground">{gallons.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">$/Gallon</p>
          <p className="text-sm font-semibold text-foreground">${costPerGallon.toFixed(3)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-sm font-semibold text-foreground">${totalCost.toFixed(2)}</p>
        </div>
      </div>

      {(entry.odometer || entry.location) && (
        <div className="mt-3 flex items-center gap-3 border-t border-border-subtle pt-2 text-xs text-muted-foreground">
          {entry.odometer && (
            <span className="flex items-center gap-1">
              <Gauge className="h-3 w-3" />
              {entry.odometer.toLocaleString()} mi
            </span>
          )}
          {entry.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              {entry.location}{entry.state ? `, ${entry.state}` : ''}
            </span>
          )}
        </div>
      )}
    </EntityCard>
  )
}
