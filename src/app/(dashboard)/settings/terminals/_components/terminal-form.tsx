'use client'

import { useState } from 'react'
import { createTerminal, updateTerminal } from '@/app/actions/terminals'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { Terminal } from '@/types/database'

interface TerminalFormProps {
  terminal?: Terminal
  onSuccess: () => void
}

export function TerminalForm({ terminal, onSuccess }: TerminalFormProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(terminal?.name ?? '')
  const [address, setAddress] = useState(terminal?.address ?? '')
  const [city, setCity] = useState(terminal?.city ?? '')
  const [state, setState] = useState(terminal?.state ?? '')
  const [zip, setZip] = useState(terminal?.zip ?? '')
  const [serviceRadiusMiles, setServiceRadiusMiles] = useState(terminal?.service_radius_miles ?? 200)
  const [isActive, setIsActive] = useState(terminal?.is_active ?? true)
  const [autoCreate, setAutoCreate] = useState(terminal?.auto_create_local_drives ?? true)
  const [autoStates, setAutoStates] = useState<string[]>(terminal?.auto_create_states ?? [])
  const [notes, setNotes] = useState(terminal?.notes ?? '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const formData = {
        name,
        address,
        city,
        state,
        zip,
        serviceRadiusMiles,
        isActive,
        autoCreateLocalDrives: autoCreate,
        autoCreateStates: autoStates.length > 0 ? autoStates : undefined,
        notes,
      }

      const result = terminal
        ? await updateTerminal(terminal.id, formData)
        : await createTerminal(formData)

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

  const toggleState = (st: string) => {
    setAutoStates((prev) =>
      prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Terminal Name *</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input id="state" value={state} onChange={(e) => setState(e.target.value)} maxLength={2} placeholder="e.g. PA" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zip">ZIP</Label>
          <Input id="zip" value={zip} onChange={(e) => setZip(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="radius">Radius (mi)</Label>
          <Input id="radius" type="number" value={serviceRadiusMiles} onChange={(e) => setServiceRadiusMiles(parseInt(e.target.value) || 200)} />
        </div>
      </div>

      <div className="flex items-center justify-between py-2">
        <div>
          <Label>Active</Label>
          <p className="text-xs text-muted-foreground">Terminal is available for operations</p>
        </div>
        <Switch checked={isActive} onCheckedChange={setIsActive} />
      </div>

      <div className="flex items-center justify-between py-2">
        <div>
          <Label>Auto-Create Local Drives</Label>
          <p className="text-xs text-muted-foreground">Automatically create local drives when trips arrive at terminal</p>
        </div>
        <Switch checked={autoCreate} onCheckedChange={setAutoCreate} />
      </div>

      {autoCreate && (
        <div className="space-y-2">
          <Label>Limit to States</Label>
          <p className="text-xs text-muted-foreground mb-1">
            Only auto-create local drives for orders delivering to these states. Leave none selected to include all.
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto border rounded-md p-2">
            {['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
              'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
              'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => toggleState(st)}
                className={`px-2 py-0.5 text-xs rounded-md border transition-colors ${
                  autoStates.includes(st)
                    ? 'bg-brand text-white border-brand'
                    : 'bg-background text-muted-foreground border-border hover:border-brand/50'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
          {autoStates.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Selected: {autoStates.join(', ')}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? 'Saving...' : terminal ? 'Update Terminal' : 'Create Terminal'}
      </Button>
    </form>
  )
}
