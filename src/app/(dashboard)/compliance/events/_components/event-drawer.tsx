'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createSafetyEvent, updateSafetyEvent } from '@/app/actions/safety-events'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'
import { PhotoUpload } from './photo-upload'
import type { PhotoRecord } from './photo-upload'
import {
  SAFETY_EVENT_TYPE_LABELS,
  SAFETY_EVENT_SEVERITY_LABELS,
  DOT_INSPECTION_LEVEL_LABELS,
  SAFETY_EVENT_TYPES,
  SAFETY_EVENT_SEVERITIES,
  DOT_INSPECTION_LEVELS,
} from '@/types'
import type { SafetyEventType, SafetyEventSeverity, DotInspectionLevel } from '@/types'
import type { SafetyEvent } from '@/types/database'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]

interface EventDrawerProps {
  open: boolean
  onClose: () => void
  event?: SafetyEvent
  defaultEventType?: SafetyEventType
}

export function EventDrawer({ open, onClose, event, defaultEventType }: EventDrawerProps) {
  const isEdit = !!event
  const queryClient = useQueryClient()

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Common fields
  const [eventType, setEventType] = useState<SafetyEventType>(event?.event_type ?? defaultEventType ?? 'incident')
  const [title, setTitle] = useState(event?.title ?? '')
  const [eventDate, setEventDate] = useState(event?.event_date?.split('T')[0] ?? '')
  const [severity, setSeverity] = useState<SafetyEventSeverity>(event?.severity ?? 'minor')
  const [driverId, setDriverId] = useState(event?.driver_id ?? '')
  const [truckId, setTruckId] = useState(event?.truck_id ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [locationState, setLocationState] = useState(event?.location_state ?? '')

  // Claim fields
  const [orderId, setOrderId] = useState(event?.order_id ?? '')
  const [vehicleVin, setVehicleVin] = useState(event?.vehicle_vin ?? '')
  const [financialAmount, setFinancialAmount] = useState(
    event?.financial_amount ? String(parseFloat(event.financial_amount).toFixed(2)) : ''
  )
  const [insuranceClaimNumber, setInsuranceClaimNumber] = useState(event?.insurance_claim_number ?? '')
  const [deductionAmount, setDeductionAmount] = useState(
    event?.deduction_amount ? String(parseFloat(event.deduction_amount).toFixed(2)) : ''
  )

  // DOT Inspection fields
  const [inspectionLevel, setInspectionLevel] = useState<DotInspectionLevel | ''>(
    (event?.inspection_level as DotInspectionLevel | null) ?? ''
  )
  const [violationsCount, setViolationsCount] = useState(String(event?.violations_count ?? 0))
  const [outOfService, setOutOfService] = useState(event?.out_of_service ?? false)

  // Resolution (edit only)
  const [resolutionNotes, setResolutionNotes] = useState(event?.resolution_notes ?? '')

  // Photos
  const [photos, setPhotos] = useState<PhotoRecord[]>(
    (event?.photos as PhotoRecord[] | null) ?? []
  )

  // Tenant ID for photo upload
  const [tenantId, setTenantId] = useState<string>('')

  const { data: driversData } = useDrivers()
  const { data: trucksData } = useTrucks()

  // Fetch tenant ID once for photo uploads
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      const tid = user?.app_metadata?.tenant_id as string | undefined
      if (tid) setTenantId(tid)
    })
  }, [])

  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      setEventType(event?.event_type ?? defaultEventType ?? 'incident')
      setTitle(event?.title ?? '')
      setEventDate(event?.event_date?.split('T')[0] ?? '')
      setSeverity(event?.severity ?? 'minor')
      setDriverId(event?.driver_id ?? '')
      setTruckId(event?.truck_id ?? '')
      setDescription(event?.description ?? '')
      setLocation(event?.location ?? '')
      setLocationState(event?.location_state ?? '')
      setOrderId(event?.order_id ?? '')
      setVehicleVin(event?.vehicle_vin ?? '')
      setFinancialAmount(
        event?.financial_amount ? String(parseFloat(event.financial_amount).toFixed(2)) : ''
      )
      setInsuranceClaimNumber(event?.insurance_claim_number ?? '')
      setDeductionAmount(
        event?.deduction_amount ? String(parseFloat(event.deduction_amount).toFixed(2)) : ''
      )
      setInspectionLevel((event?.inspection_level as DotInspectionLevel | null) ?? '')
      setViolationsCount(String(event?.violations_count ?? 0))
      setOutOfService(event?.out_of_service ?? false)
      setResolutionNotes(event?.resolution_notes ?? '')
      setPhotos((event?.photos as PhotoRecord[] | null) ?? [])
      setSubmitError(null)
    }
  }, [open, event, defaultEventType])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)

    const formData = {
      eventType,
      title,
      eventDate,
      severity,
      driverId: driverId || '',
      truckId: truckId || '',
      description: description || '',
      location: location || '',
      locationState: locationState || '',
      // Claim fields
      ...(eventType === 'claim' || eventType === 'incident' ? {
        orderId: orderId || '',
        vehicleVin: vehicleVin || '',
        financialAmount: financialAmount ? parseFloat(financialAmount) : undefined,
        insuranceClaimNumber: insuranceClaimNumber || '',
        deductionAmount: deductionAmount ? parseFloat(deductionAmount) : undefined,
      } : {}),
      // DOT fields
      ...(eventType === 'dot_inspection' ? {
        inspectionLevel: inspectionLevel || '',
        violationsCount: parseInt(violationsCount, 10) || 0,
        outOfService,
      } : {}),
      // Resolution notes (edit mode)
      ...(isEdit ? { resolutionNotes: resolutionNotes || '' } : {}),
    }

    const result = isEdit
      ? await updateSafetyEvent(event.id, formData)
      : await createSafetyEvent(formData)

    if ('error' in result && result.error) {
      setSubmitError(
        typeof result.error === 'string'
          ? result.error
          : 'Please fix the form errors and try again.'
      )
      setSubmitting(false)
      return
    }

    // If we have photos and it's a new event, we need to update the event with photos
    if (!isEdit && photos.length > 0 && 'data' in result && result.data) {
      const supabase = createClient()
      await supabase
        .from('safety_events')
        .update({ photos })
        .eq('id', result.data.id)
    }

    // If editing and photos changed, update them
    if (isEdit && photos !== ((event?.photos as PhotoRecord[] | null) ?? [])) {
      const supabase = createClient()
      await supabase
        .from('safety_events')
        .update({ photos })
        .eq('id', event.id)
    }

    setSubmitting(false)
    queryClient.invalidateQueries({ queryKey: ['safety-events'] })
    onClose()
  }

  const isClaimOrIncident = eventType === 'claim' || eventType === 'incident'

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit Safety Event' : 'New Safety Event'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update the details of this safety event.'
              : 'Record a new incident, cargo damage claim, or DOT inspection.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-5 px-4 pb-6">
          {/* Event Type */}
          <div className="space-y-2">
            <Label htmlFor="eventType">Event Type <span className="text-destructive">*</span></Label>
            <Select
              value={eventType}
              onValueChange={(v) => setEventType(v as SafetyEventType)}
              disabled={isEdit}
            >
              <SelectTrigger id="eventType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SAFETY_EVENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {SAFETY_EVENT_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                eventType === 'claim' ? 'e.g. Cargo damage — 2023 Tesla Model 3' :
                eventType === 'dot_inspection' ? 'e.g. Level I inspection — I-95 Weigh Station' :
                'e.g. Minor fender bender at delivery'
              }
              required
              maxLength={200}
            />
          </div>

          {/* Date + Severity row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="eventDate">Event Date <span className="text-destructive">*</span></Label>
              <Input
                id="eventDate"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="severity">Severity <span className="text-destructive">*</span></Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as SafetyEventSeverity)}>
                <SelectTrigger id="severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SAFETY_EVENT_SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SAFETY_EVENT_SEVERITY_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Driver + Truck row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="driverId">Driver</Label>
              <Select value={driverId || '_none'} onValueChange={(v) => setDriverId(v === '_none' ? '' : v)}>
                <SelectTrigger id="driverId">
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {(driversData?.drivers ?? []).map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.first_name} {driver.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="truckId">Truck</Label>
              <Select value={truckId || '_none'} onValueChange={(v) => setTruckId(v === '_none' ? '' : v)}>
                <SelectTrigger id="truckId">
                  <SelectValue placeholder="Select truck" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {(trucksData?.trucks ?? []).map((truck) => (
                    <SelectItem key={truck.id} value={truck.id}>
                      #{truck.unit_number}{truck.make ? ` — ${truck.make}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Location row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. I-95 mile marker 42"
                maxLength={500}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationState">State</Label>
              <Select value={locationState || '_none'} onValueChange={(v) => setLocationState(v === '_none' ? '' : v)}>
                <SelectTrigger id="locationState">
                  <SelectValue placeholder="ST" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {US_STATES.map((st) => (
                    <SelectItem key={st} value={st}>{st}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── CLAIM-SPECIFIC FIELDS ── */}
          {eventType === 'claim' && (
            <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                Cargo Damage Claim Details
              </p>

              {/* VIN — prominently displayed */}
              <div className="space-y-2">
                <Label htmlFor="vehicleVin" className="text-base font-semibold">
                  Damaged Vehicle VIN
                </Label>
                <Input
                  id="vehicleVin"
                  value={vehicleVin}
                  onChange={(e) => setVehicleVin(e.target.value.toUpperCase())}
                  placeholder="e.g. 1HGCM82633A004352"
                  maxLength={17}
                  className="font-mono text-sm tracking-widest"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the VIN of the specific vehicle that was damaged. {vehicleVin.length}/17 characters.
                </p>
              </div>

              {/* Financial amount + deduction */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="financialAmount">Claim Amount ($)</Label>
                  <Input
                    id="financialAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={financialAmount}
                    onChange={(e) => setFinancialAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deductionAmount">Driver Deduction ($)</Label>
                  <Input
                    id="deductionAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={deductionAmount}
                    onChange={(e) => setDeductionAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Insurance claim # */}
              <div className="space-y-2">
                <Label htmlFor="insuranceClaimNumber">Insurance Claim Number</Label>
                <Input
                  id="insuranceClaimNumber"
                  value={insuranceClaimNumber}
                  onChange={(e) => setInsuranceClaimNumber(e.target.value)}
                  placeholder="e.g. CLM-2026-001234"
                  maxLength={100}
                />
              </div>
            </div>
          )}

          {/* ── INCIDENT-SPECIFIC FIELDS ── */}
          {eventType === 'incident' && (
            <div className="space-y-4 rounded-lg border border-red-200 bg-red-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-700">
                Incident Details
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="incidentFinancialAmount">Financial Impact ($)</Label>
                  <Input
                    id="incidentFinancialAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={financialAmount}
                    onChange={(e) => setFinancialAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="incidentVehicleVin">Related Vehicle VIN</Label>
                  <Input
                    id="incidentVehicleVin"
                    value={vehicleVin}
                    onChange={(e) => setVehicleVin(e.target.value.toUpperCase())}
                    placeholder="Optional"
                    maxLength={17}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── DOT INSPECTION FIELDS ── */}
          {eventType === 'dot_inspection' && (
            <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                DOT Inspection Details
              </p>

              <div className="space-y-2">
                <Label htmlFor="inspectionLevel">Inspection Level</Label>
                <Select
                  value={inspectionLevel || '_none'}
                  onValueChange={(v) => setInspectionLevel(v === '_none' ? '' : v as DotInspectionLevel)}
                >
                  <SelectTrigger id="inspectionLevel">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Not specified</SelectItem>
                    {DOT_INSPECTION_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {DOT_INSPECTION_LEVEL_LABELS[level]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="violationsCount">Violations Found</Label>
                  <Input
                    id="violationsCount"
                    type="number"
                    min="0"
                    step="1"
                    value={violationsCount}
                    onChange={(e) => setViolationsCount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center gap-3 pt-7">
                  <Checkbox
                    id="outOfService"
                    checked={outOfService}
                    onCheckedChange={(checked) => setOutOfService(checked === true)}
                  />
                  <Label htmlFor="outOfService" className="font-semibold text-destructive">
                    Out of Service
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what happened in detail..."
              rows={4}
              maxLength={5000}
            />
          </div>

          {/* Photos (for claims and incidents) */}
          {isClaimOrIncident && tenantId && (
            <PhotoUpload
              tenantId={tenantId}
              eventId={isEdit ? event.id : undefined}
              value={photos}
              onChange={setPhotos}
              disabled={submitting}
            />
          )}

          {/* Resolution notes (edit mode) */}
          {isEdit && (
            <div className="space-y-2 rounded-lg border border-green-200 bg-green-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-green-700">
                Resolution
              </p>
              <Label htmlFor="resolutionNotes">Resolution Notes</Label>
              <Textarea
                id="resolutionNotes"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="How was this event resolved? Add any notes, corrective actions, or outcomes..."
                rows={3}
                maxLength={5000}
              />
            </div>
          )}

          {submitError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {submitError}
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting
                ? isEdit ? 'Saving...' : 'Creating...'
                : isEdit ? 'Save Changes' : 'Create Event'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
