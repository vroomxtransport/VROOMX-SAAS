'use client'

import { useState } from 'react'
import { createLocalRun, updateLocalRun } from '@/app/actions/local-runs'
import { useTerminals } from '@/hooks/use-terminals'
import { useQuery } from '@tanstack/react-query'
import { fetchDriverOptions } from '@/lib/queries/drivers'
import { fetchTruckOptions } from '@/lib/queries/trucks'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LOCAL_DRIVE_TYPE_LABELS } from '@/types'
import type { LocalDriveType } from '@/types'
import type { LocalRun } from '@/types/database'

interface LocalRunFormProps {
  localRun?: LocalRun
  onSuccess: () => void
}

export function LocalRunForm({ localRun, onSuccess }: LocalRunFormProps) {
  const supabase = createClient()
  const { data: terminals } = useTerminals({ activeOnly: true })
  const { data: drivers } = useQuery({
    queryKey: ['driver-options'],
    queryFn: () => fetchDriverOptions(supabase),
    staleTime: 60_000,
  })
  const { data: trucks } = useQuery({
    queryKey: ['truck-options'],
    queryFn: () => fetchTruckOptions(supabase),
    staleTime: 60_000,
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [terminalId, setTerminalId] = useState(localRun?.terminal_id ?? '')
  const [type, setType] = useState<LocalDriveType>(localRun?.type as LocalDriveType ?? 'delivery_from_terminal')
  const [driverId, setDriverId] = useState(localRun?.driver_id ?? '')
  const [truckId, setTruckId] = useState(localRun?.truck_id ?? '')
  const [scheduledDate, setScheduledDate] = useState(localRun?.scheduled_date ?? '')
  const [notes, setNotes] = useState(localRun?.notes ?? '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const formData = {
        terminalId,
        type,
        driverId,
        truckId,
        scheduledDate,
        notes,
      }

      const result = localRun
        ? await updateLocalRun(localRun.id, formData)
        : await createLocalRun(formData)

      if ('error' in result && result.error) {
        setError(typeof result.error === 'string' ? result.error : 'Validation error')
        return
      }

      onSuccess()
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <div className="space-y-2">
        <Label>Terminal</Label>
        <Select value={terminalId} onValueChange={setTerminalId}>
          <SelectTrigger>
            <SelectValue placeholder="Select terminal..." />
          </SelectTrigger>
          <SelectContent>
            {(terminals ?? []).map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Type *</Label>
        <Select value={type} onValueChange={(v) => setType(v as LocalDriveType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(LOCAL_DRIVE_TYPE_LABELS) as [LocalDriveType, string][]).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Driver</Label>
          <Select value={driverId} onValueChange={setDriverId}>
            <SelectTrigger>
              <SelectValue placeholder="Select driver..." />
            </SelectTrigger>
            <SelectContent>
              {(drivers ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.first_name} {d.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Truck</Label>
          <Select value={truckId} onValueChange={setTruckId}>
            <SelectTrigger>
              <SelectValue placeholder="Select truck..." />
            </SelectTrigger>
            <SelectContent>
              {(trucks ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>#{t.unit_number}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="scheduledDate">Scheduled Date</Label>
        <Input id="scheduledDate" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? 'Saving...' : localRun ? 'Update Local Run' : 'Create Local Run'}
      </Button>
    </form>
  )
}
