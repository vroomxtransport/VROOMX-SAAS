'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle, AlertCircle, Truck } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { mapSamsaraVehicle } from '@/app/actions/samsara'
import type { SamsaraVehicle, VroomxTruckOption } from '@/app/actions/samsara'

interface SamsaraVehicleMappingProps {
  vehicles: SamsaraVehicle[]
  trucks: VroomxTruckOption[]
}

export function SamsaraVehicleMapping({ vehicles, trucks }: SamsaraVehicleMappingProps) {
  const [mappings, setMappings] = useState<Record<string, string | null>>(
    Object.fromEntries(vehicles.map((v) => [v.samsaraId, v.vroomxTruckId]))
  )
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  if (vehicles.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center">
        <Truck className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No Samsara vehicles found. Run a sync to import vehicles.
        </p>
      </div>
    )
  }

  async function handleMap(samsaraVehicleId: string, vroomxTruckId: string | null) {
    setSaving((prev) => ({ ...prev, [samsaraVehicleId]: true }))
    setMappings((prev) => ({ ...prev, [samsaraVehicleId]: vroomxTruckId }))

    try {
      const result = await mapSamsaraVehicle({ samsaraVehicleId, vroomxTruckId })
      if ('error' in result && result.error) {
        toast.error(typeof result.error === 'string' ? result.error : 'Failed to save mapping')
        setMappings((prev) => ({
          ...prev,
          [samsaraVehicleId]:
            vehicles.find((v) => v.samsaraId === samsaraVehicleId)?.vroomxTruckId ?? null,
        }))
      } else {
        toast.success('Vehicle mapping saved')
      }
    } catch {
      toast.error('Failed to save mapping')
      setMappings((prev) => ({
        ...prev,
        [samsaraVehicleId]:
          vehicles.find((v) => v.samsaraId === samsaraVehicleId)?.vroomxTruckId ?? null,
      }))
    } finally {
      setSaving((prev) => ({ ...prev, [samsaraVehicleId]: false }))
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Samsara Vehicle</TableHead>
          <TableHead>VIN</TableHead>
          <TableHead>Mapped To</TableHead>
          <TableHead className="w-48">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {vehicles.map((vehicle) => {
          const currentTruckId = mappings[vehicle.samsaraId]
          const isMapped = currentTruckId !== null
          const currentTruck = trucks.find((t) => t.id === currentTruckId)
          const isSaving = saving[vehicle.samsaraId] ?? false

          return (
            <TableRow key={vehicle.samsaraId}>
              <TableCell className="font-medium">{vehicle.name}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {vehicle.vin ?? '—'}
              </TableCell>
              <TableCell>
                {isMapped ? (
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    {currentTruck?.unitNumber ?? vehicle.vroomxUnitNumber ?? 'Unit #?'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-amber-600">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Unmapped
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Select
                  value={currentTruckId ?? '__unmap__'}
                  onValueChange={(value) =>
                    handleMap(vehicle.samsaraId, value === '__unmap__' ? null : value)
                  }
                  disabled={isSaving}
                >
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue placeholder="Select truck…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unmap__" className="text-muted-foreground">
                      — Unmapped —
                    </SelectItem>
                    {trucks.map((truck) => (
                      <SelectItem key={truck.id} value={truck.id}>
                        Unit #{truck.unitNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
