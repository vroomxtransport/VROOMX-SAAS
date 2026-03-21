'use server'

import { authorize, safeError } from '@/lib/authz'
import { safetyEventSchema, resolveSafetyEventSchema } from '@/lib/validations/safety-events'
import { deleteFile } from '@/lib/storage'
import { revalidatePath } from 'next/cache'
import type { SafetyEvent } from '@/types/database'

export async function createSafetyEvent(data: unknown) {
  const parsed = safetyEventSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('safety_events.create', {
    rateLimit: { key: 'createSafetyEvent', limit: 20, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { financialAmount, deductionAmount, violationsCount } = parsed.data

  const { data: event, error } = await supabase
    .from('safety_events')
    .insert({
      tenant_id: tenantId,
      event_type: parsed.data.eventType,
      severity: parsed.data.severity,
      status: parsed.data.status ?? 'open',
      event_date: parsed.data.eventDate,
      driver_id: parsed.data.driverId || null,
      truck_id: parsed.data.truckId || null,
      order_id: parsed.data.orderId || null,
      vehicle_vin: parsed.data.vehicleVin || null,
      title: parsed.data.title,
      description: parsed.data.description || null,
      location: parsed.data.location || null,
      location_state: parsed.data.locationState || null,
      financial_amount: financialAmount != null ? String(financialAmount) : null,
      insurance_claim_number: parsed.data.insuranceClaimNumber || null,
      deduction_amount: deductionAmount != null ? String(deductionAmount) : null,
      inspection_level: parsed.data.inspectionLevel || null,
      violations_count: violationsCount ?? 0,
      out_of_service: parsed.data.outOfService ?? false,
      resolution_notes: parsed.data.resolutionNotes || null,
    })
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'createSafetyEvent') }
  }

  revalidatePath('/compliance/events')
  return { success: true, data: event as SafetyEvent }
}

export async function updateSafetyEvent(id: string, data: unknown) {
  const parsed = safetyEventSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('safety_events.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { financialAmount, deductionAmount, violationsCount } = parsed.data

  const { data: event, error } = await supabase
    .from('safety_events')
    .update({
      event_type: parsed.data.eventType,
      severity: parsed.data.severity,
      status: parsed.data.status ?? 'open',
      event_date: parsed.data.eventDate,
      driver_id: parsed.data.driverId || null,
      truck_id: parsed.data.truckId || null,
      order_id: parsed.data.orderId || null,
      vehicle_vin: parsed.data.vehicleVin || null,
      title: parsed.data.title,
      description: parsed.data.description || null,
      location: parsed.data.location || null,
      location_state: parsed.data.locationState || null,
      financial_amount: financialAmount != null ? String(financialAmount) : null,
      insurance_claim_number: parsed.data.insuranceClaimNumber || null,
      deduction_amount: deductionAmount != null ? String(deductionAmount) : null,
      inspection_level: parsed.data.inspectionLevel || null,
      violations_count: violationsCount ?? 0,
      out_of_service: parsed.data.outOfService ?? false,
      resolution_notes: parsed.data.resolutionNotes || null,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'updateSafetyEvent') }
  }

  revalidatePath('/compliance/events')
  return { success: true, data: event as SafetyEvent }
}

export async function deleteSafetyEvent(id: string) {
  const auth = await authorize('safety_events.delete')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Fetch the event to get photos before deleting
  const { data: event, error: fetchError } = await supabase
    .from('safety_events')
    .select('photos')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchError || !event) {
    return { error: safeError(fetchError ?? new Error('Event not found'), 'deleteSafetyEvent') }
  }

  // Clean up photos from storage
  const photos = event.photos as Array<{ storagePath: string }> | null
  if (photos && photos.length > 0) {
    for (const photo of photos) {
      if (photo.storagePath) {
        const { error: storageError } = await deleteFile(supabase, 'safety-photos', photo.storagePath)
        if (storageError) {
          console.error('Failed to delete safety event photo from storage:', storageError)
        }
      }
    }
  }

  const { error } = await supabase
    .from('safety_events')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: safeError(error, 'deleteSafetyEvent') }
  }

  revalidatePath('/compliance/events')
  return { success: true }
}

export async function resolveSafetyEvent(id: string, resolutionNotes: unknown) {
  const parsed = resolveSafetyEventSchema.safeParse({ resolutionNotes })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('safety_events.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { data: event, error } = await supabase
    .from('safety_events')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolution_notes: parsed.data.resolutionNotes || null,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'resolveSafetyEvent') }
  }

  revalidatePath('/compliance/events')
  return { success: true, data: event as SafetyEvent }
}
