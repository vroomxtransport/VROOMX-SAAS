'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle, AlertCircle, User } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { mapSamsaraDriver } from '@/app/actions/samsara'
import type { SamsaraDriver, VroomxDriverOption } from '@/app/actions/samsara'

interface SamsaraDriverMappingProps {
  drivers: SamsaraDriver[]
  vroomxDrivers: VroomxDriverOption[]
}

export function SamsaraDriverMapping({ drivers, vroomxDrivers }: SamsaraDriverMappingProps) {
  const [mappings, setMappings] = useState<Record<string, string | null>>(
    Object.fromEntries(drivers.map((d) => [d.samsaraId, d.vroomxDriverId]))
  )
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  if (drivers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center">
        <User className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No Samsara drivers found. Run a sync to import drivers.
        </p>
      </div>
    )
  }

  async function handleMap(samsaraDriverId: string, vroomxDriverId: string | null) {
    setSaving((prev) => ({ ...prev, [samsaraDriverId]: true }))
    setMappings((prev) => ({ ...prev, [samsaraDriverId]: vroomxDriverId }))

    try {
      const result = await mapSamsaraDriver({ samsaraDriverId, vroomxDriverId })
      if ('error' in result && result.error) {
        toast.error(typeof result.error === 'string' ? result.error : 'Failed to save mapping')
        setMappings((prev) => ({
          ...prev,
          [samsaraDriverId]:
            drivers.find((d) => d.samsaraId === samsaraDriverId)?.vroomxDriverId ?? null,
        }))
      } else {
        toast.success('Driver mapping saved')
      }
    } catch {
      toast.error('Failed to save mapping')
      setMappings((prev) => ({
        ...prev,
        [samsaraDriverId]:
          drivers.find((d) => d.samsaraId === samsaraDriverId)?.vroomxDriverId ?? null,
      }))
    } finally {
      setSaving((prev) => ({ ...prev, [samsaraDriverId]: false }))
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Samsara Driver</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Mapped To</TableHead>
          <TableHead className="w-48">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {drivers.map((driver) => {
          const currentDriverId = mappings[driver.samsaraId]
          const isMapped = currentDriverId !== null
          const currentDriver = vroomxDrivers.find((d) => d.id === currentDriverId)
          const isSaving = saving[driver.samsaraId] ?? false

          return (
            <TableRow key={driver.samsaraId}>
              <TableCell className="font-medium">{driver.name}</TableCell>
              <TableCell>
                <Badge
                  variant={driver.status === 'active' ? 'default' : 'secondary'}
                  className={
                    driver.status === 'active'
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      : undefined
                  }
                >
                  {driver.status}
                </Badge>
              </TableCell>
              <TableCell>
                {isMapped ? (
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    {currentDriver?.name ?? driver.vroomxDriverName ?? 'Unknown'}
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
                  value={currentDriverId ?? '__unmap__'}
                  onValueChange={(value) =>
                    handleMap(driver.samsaraId, value === '__unmap__' ? null : value)
                  }
                  disabled={isSaving}
                >
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue placeholder="Select driver…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unmap__" className="text-muted-foreground">
                      — Unmapped —
                    </SelectItem>
                    {vroomxDrivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
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
