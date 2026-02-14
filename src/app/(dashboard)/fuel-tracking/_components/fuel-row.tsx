'use client'

import { Button } from '@/components/ui/button'
import { Pencil, MapPin, Gauge } from 'lucide-react'
import type { FuelEntry } from '@/types/database'

interface FuelRowProps {
  entry: FuelEntry
  onEdit: (e: React.MouseEvent) => void
}

export function FuelRow({ entry, onEdit }: FuelRowProps) {
  const gallons = parseFloat(entry.gallons) || 0
  const costPerGallon = parseFloat(entry.cost_per_gallon) || 0
  const totalCost = parseFloat(entry.total_cost) || 0
  const truckUnit = (entry.truck as { unit_number?: string } | null)?.unit_number ?? 'Unassigned'
  const driver = entry.driver as { first_name?: string; last_name?: string } | null
  const driverName = driver ? `${driver.first_name} ${driver.last_name}` : null

  return (
    <div className="flex w-full items-center gap-4 rounded-lg border border-border-subtle bg-surface px-4 py-3 text-left shadow-sm transition-colors card-hover hover:border-brand/30">
      <div className="min-w-0 flex-1">
        <span className="text-sm font-semibold text-foreground">
          {new Date(entry.date).toLocaleDateString()}
        </span>
        <span className="ml-2 text-xs text-muted-foreground">
          Truck: {truckUnit}
          {driverName && ` | ${driverName}`}
        </span>
      </div>

      <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
        {entry.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {entry.location}{entry.state ? `, ${entry.state}` : ''}
          </span>
        )}
        {entry.odometer && (
          <span className="flex items-center gap-1">
            <Gauge className="h-3 w-3" />
            {entry.odometer.toLocaleString()} mi
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 shrink-0 text-sm">
        <span className="text-muted-foreground">{gallons.toFixed(2)} gal</span>
        <span className="text-muted-foreground">${costPerGallon.toFixed(3)}/gal</span>
        <span className="font-semibold text-foreground">${totalCost.toFixed(2)}</span>
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
