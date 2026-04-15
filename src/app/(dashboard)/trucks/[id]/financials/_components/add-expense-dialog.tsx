'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { addTruckExpense } from '@/app/actions/truck-expenses'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface AddExpenseDialogProps {
  open: boolean
  onClose: () => void
  truckId: string
  /** Optional list of trip options for the trip-scoped categories (tolls/lodging/misc). */
  trips: Array<{ id: string; label: string }>
}

export function AddExpenseDialog(props: AddExpenseDialogProps) {
  // Mount the form body only while the dialog is open so all local state
  // resets naturally on close without needing a setState-in-effect dance.
  return (
    <Dialog open={props.open} onOpenChange={(v) => !v && props.onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        {props.open && <AddExpenseForm {...props} />}
      </DialogContent>
    </Dialog>
  )
}

type Category =
  | 'fuel'
  | 'maintenance'
  | 'repair'
  | 'tolls'
  | 'lodging'
  | 'misc'
  | 'insurance'
  | 'truck_lease'
  | 'registration'
  | 'office_supplies'
  | 'software'
  | 'other'

const CATEGORY_OPTIONS: Array<{ value: Category; label: string; group: string }> = [
  { value: 'fuel', label: 'Fuel', group: 'Variable' },
  { value: 'maintenance', label: 'Maintenance', group: 'Variable' },
  { value: 'repair', label: 'Repair', group: 'Variable' },
  { value: 'tolls', label: 'Tolls (trip)', group: 'Trip' },
  { value: 'lodging', label: 'Lodging (trip)', group: 'Trip' },
  { value: 'misc', label: 'Misc (trip)', group: 'Trip' },
  { value: 'insurance', label: 'Insurance', group: 'Fixed' },
  { value: 'truck_lease', label: 'Truck lease', group: 'Fixed' },
  { value: 'registration', label: 'Registration / permits', group: 'Fixed' },
  { value: 'office_supplies', label: 'Office supplies', group: 'Fixed' },
  { value: 'software', label: 'Software', group: 'Fixed' },
  { value: 'other', label: 'Other', group: 'Fixed' },
]

const TRIP_CATEGORIES: Category[] = ['tolls', 'lodging', 'misc']

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function AddExpenseForm({ onClose, truckId, trips }: AddExpenseDialogProps) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const [category, setCategory] = useState<Category>('fuel')
  const [amount, setAmount] = useState('')
  const [occurredAt, setOccurredAt] = useState<string>(today())
  const [description, setDescription] = useState('')

  // Fuel-specific
  const [gallons, setGallons] = useState('')
  const [costPerGallon, setCostPerGallon] = useState('')
  const [state, setState] = useState('')

  // Maintenance-specific
  const [vendor, setVendor] = useState('')
  const [maintenanceType, setMaintenanceType] = useState('other')

  // Trip-scoped — default to the first available trip option
  const [tripId, setTripId] = useState<string>(trips[0]?.id ?? '')

  // If the parent's `trips` list refreshes mid-session (realtime) and the
  // currently-selected tripId is no longer in the list, snap to a valid one.
  // Uses the "adjusting state during render" pattern to avoid the project's
  // set-state-in-effect lint rule.
  const [prevTrips, setPrevTrips] = useState(trips)
  if (prevTrips !== trips) {
    setPrevTrips(trips)
    const stillValid = trips.some((t) => t.id === tripId)
    if (!stillValid) setTripId(trips[0]?.id ?? '')
  }

  // Fuel auto-computes total cost from gallons × cost/gallon
  const computedFuelAmount =
    category === 'fuel' && gallons && costPerGallon
      ? (Number(gallons) * Number(costPerGallon)).toFixed(2)
      : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setServerError(null)
    setFieldErrors({})

    const payload: Record<string, unknown> = {
      truckId,
      category,
      amount: category === 'fuel' ? computedFuelAmount ?? amount : amount,
      occurredAt,
      description: description || undefined,
    }

    if (category === 'fuel') {
      payload.gallons = gallons
      payload.costPerGallon = costPerGallon
      if (state) payload.state = state
    }
    if (category === 'maintenance' || category === 'repair') {
      if (vendor) payload.vendor = vendor
      payload.maintenanceType = maintenanceType
    }
    if (TRIP_CATEGORIES.includes(category)) {
      payload.tripId = tripId
    }

    const result = await addTruckExpense(payload)
    setSaving(false)

    if ('error' in result && result.error) {
      if (typeof result.error === 'string') {
        setServerError(result.error)
        toast.error(result.error)
      } else {
        setFieldErrors(result.error as Record<string, string[]>)
        toast.error('Please fix the highlighted fields')
      }
      return
    }

    toast.success('Expense added')
    queryClient.invalidateQueries({ queryKey: ['truck-expenses', truckId] })
    queryClient.invalidateQueries({ queryKey: ['financials'] })
    queryClient.invalidateQueries({ queryKey: ['fleet-utilization'] })
    onClose()
  }

  const fieldError = (name: string): string | undefined => {
    if (!Object.prototype.hasOwnProperty.call(fieldErrors, name)) return undefined
    const messages = fieldErrors[name as keyof typeof fieldErrors]
    return Array.isArray(messages) ? messages[0] : undefined
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add expense</DialogTitle>
        <DialogDescription>
          Capture a cost against this truck. The expense will be routed to the right
          source table automatically.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger id="category" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError('category') && (
                <p className="mt-1 text-xs text-rose-600">{fieldError('category')}</p>
              )}
            </div>

            <div>
              <Label htmlFor="occurredAt">Date</Label>
              <Input
                id="occurredAt"
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="mt-1"
                required
              />
              {fieldError('occurredAt') && (
                <p className="mt-1 text-xs text-rose-600">{fieldError('occurredAt')}</p>
              )}
            </div>

            <div>
              <Label htmlFor="amount">
                Amount
                {category === 'fuel' && computedFuelAmount && (
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                    auto: ${computedFuelAmount}
                  </span>
                )}
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={category === 'fuel' && computedFuelAmount ? computedFuelAmount : amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={category === 'fuel' && !!computedFuelAmount}
                className="mt-1"
                required={category !== 'fuel'}
              />
              {fieldError('amount') && (
                <p className="mt-1 text-xs text-rose-600">{fieldError('amount')}</p>
              )}
            </div>
          </div>

          {/* Fuel-specific fields */}
          {category === 'fuel' && (
            <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <div>
                <Label htmlFor="gallons">Gallons</Label>
                <Input
                  id="gallons"
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={gallons}
                  onChange={(e) => setGallons(e.target.value)}
                  className="mt-1"
                  required
                />
                {fieldError('gallons') && (
                  <p className="mt-1 text-xs text-rose-600">{fieldError('gallons')}</p>
                )}
              </div>
              <div>
                <Label htmlFor="costPerGallon">$/gal</Label>
                <Input
                  id="costPerGallon"
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={costPerGallon}
                  onChange={(e) => setCostPerGallon(e.target.value)}
                  className="mt-1"
                  required
                />
                {fieldError('costPerGallon') && (
                  <p className="mt-1 text-xs text-rose-600">{fieldError('costPerGallon')}</p>
                )}
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  maxLength={2}
                  placeholder="OH"
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* Maintenance-specific fields */}
          {(category === 'maintenance' || category === 'repair') && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <div>
                <Label htmlFor="maintenanceType">Type</Label>
                <Select value={maintenanceType} onValueChange={setMaintenanceType}>
                  <SelectTrigger id="maintenanceType" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventive">Preventive</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                    <SelectItem value="tire">Tire service</SelectItem>
                    <SelectItem value="oil_change">Oil change</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="vendor">Vendor</Label>
                <Input
                  id="vendor"
                  placeholder="e.g. Love's Service"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* Trip-scoped fields */}
          {TRIP_CATEGORIES.includes(category) && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <Label htmlFor="tripId">Trip</Label>
              {trips.length === 0 ? (
                <p className="mt-1 text-xs text-rose-600">
                  No trips in the current period — this truck needs an assigned trip before you can add trip-scoped expenses.
                </p>
              ) : (
                <>
                  <Select value={tripId} onValueChange={setTripId}>
                    <SelectTrigger id="tripId" className="mt-1">
                      <SelectValue placeholder="Select a trip" />
                    </SelectTrigger>
                    <SelectContent>
                      {trips.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldError('tripId') && (
                    <p className="mt-1 text-xs text-rose-600">{fieldError('tripId')}</p>
                  )}
                </>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="description">Description / notes</Label>
            <Textarea
              id="description"
              rows={2}
              placeholder="Optional — shows up on the ledger row"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
            />
          </div>

          {serverError && (
            <p className="rounded-md border border-rose-200 px-3 py-2 text-xs text-rose-700">
              {serverError}
            </p>
          )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              saving ||
              (TRIP_CATEGORIES.includes(category) && trips.length === 0) ||
              (category === 'fuel' && !computedFuelAmount)
            }
            className="bg-brand text-white hover:bg-brand/90"
          >
            {saving ? 'Saving…' : 'Add expense'}
          </Button>
        </div>
      </form>
    </>
  )
}
