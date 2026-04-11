'use server'

import { z } from 'zod'
import { authorize, safeError } from '@/lib/authz'
import { logAuditEvent } from '@/lib/audit-log'
import { sanitizeSearch } from '@/lib/sanitize-search'
import { issueNonce } from '@/lib/oauth-nonce'
import { revalidatePath } from 'next/cache'
import { getSamsaraAuthUrl, refreshAccessToken } from '@/lib/samsara/oauth'
import { SamsaraClient } from '@/lib/samsara/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// ============================================================================
// Shared types (re-exported for UI consumption)
// ============================================================================

export type SamsaraConnectionStatus = 'active' | 'paused' | 'error' | 'disconnected'

export interface SamsaraStatusData {
  connected: boolean
  lastSync: string | null
  syncStatus: SamsaraConnectionStatus
  syncError: string | null
  vehicleCount: number
  driverCount: number
  mappedVehicleCount: number
}

export interface SamsaraVehicleMapping {
  samsaraId: string
  name: string
  vin: string | null
  vroomxTruckId: string | null
  vroomxUnitNumber: string | null
}

export interface SamsaraDriverMapping {
  samsaraId: string
  name: string
  status: 'active' | 'inactive'
  vroomxDriverId: string | null
  vroomxDriverName: string | null
}

export interface VroomxTruckOption {
  id: string
  unitNumber: string
}

export interface VroomxDriverOption {
  id: string
  name: string
}

// Full status shape used by UI (includes mappings)
export interface SamsaraStatus {
  connected: boolean
  connectionStatus: SamsaraConnectionStatus
  lastSyncAt: string | null
  syncError: string | null
  vehicleCount: number
  driverCount: number
  mappedVehicleCount: number
  vehicles: SamsaraVehicleMapping[]
  drivers: SamsaraDriverMapping[]
}

// Backward-compatible type aliases used by UI components
export type SamsaraVehicle = SamsaraVehicleMapping
export type SamsaraDriver = SamsaraDriverMapping

// ============================================================================
// Helper: Get authenticated SamsaraClient for a tenant
// ============================================================================

async function getClientForTenant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ client: SamsaraClient; integrationId: string } | { error: string }> {
  const { data: integration, error } = await supabase
    .from('samsara_integrations')
    .select('id, access_token_encrypted, refresh_token_encrypted, token_expires_at, sync_status')
    .eq('tenant_id', tenantId)
    .single()

  if (error || !integration) {
    return { error: 'Samsara integration not found. Please connect your account first.' }
  }

  if (integration.sync_status === 'disconnected') {
    return { error: 'Samsara integration is disconnected. Please reconnect.' }
  }

  let accessToken = integration.access_token_encrypted as string

  // Check if token is expired or expiring within 5 minutes
  const expiresAt = new Date(integration.token_expires_at as string)
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)

  if (expiresAt <= fiveMinutesFromNow) {
    try {
      const tokenResponse = await refreshAccessToken(
        integration.refresh_token_encrypted as string
      )

      const newExpiresAt = new Date(
        Date.now() + tokenResponse.expires_in * 1000
      ).toISOString()

      await supabase
        .from('samsara_integrations')
        .update({
          access_token_encrypted: tokenResponse.access_token,
          refresh_token_encrypted: tokenResponse.refresh_token,
          token_expires_at: newExpiresAt,
        })
        .eq('id', integration.id)
        .eq('tenant_id', tenantId)

      accessToken = tokenResponse.access_token
    } catch {
      await supabase
        .from('samsara_integrations')
        .update({ sync_status: 'error', last_error: 'Token refresh failed' })
        .eq('id', integration.id)
        .eq('tenant_id', tenantId)

      return { error: 'Failed to refresh Samsara token. Please reconnect.' }
    }
  }

  // Build client with automatic token refresh callback for 401 retries
  const client = new SamsaraClient(accessToken, async () => {
    try {
      const tokenResponse = await refreshAccessToken(
        integration.refresh_token_encrypted as string
      )
      const newExpiresAt = new Date(
        Date.now() + tokenResponse.expires_in * 1000
      ).toISOString()

      await supabase
        .from('samsara_integrations')
        .update({
          access_token_encrypted: tokenResponse.access_token,
          refresh_token_encrypted: tokenResponse.refresh_token,
          token_expires_at: newExpiresAt,
        })
        .eq('id', integration.id)
        .eq('tenant_id', tenantId)

      return tokenResponse.access_token
    } catch {
      return null
    }
  })

  return { client, integrationId: integration.id as string }
}

// ============================================================================
// connectSamsara — Generate OAuth URL for tenant to authorize
// ============================================================================

export async function connectSamsara(data?: { apiKey?: string }) {
  const auth = await authorize('integrations.manage', {
    rateLimit: { key: 'connectSamsara', limit: 5, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    // If API key provided directly (legacy / simple connect flow)
    if (data?.apiKey) {
      const { error: upsertError } = await supabase
        .from('samsara_integrations')
        .upsert(
          {
            tenant_id: tenantId,
            access_token_encrypted: data.apiKey,
            refresh_token_encrypted: '',
            token_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            sync_status: 'active',
            last_sync_at: null,
            last_error: null,
          },
          { onConflict: 'tenant_id' }
        )

      if (upsertError) {
        return { error: safeError(upsertError, 'connectSamsara.apiKey') }
      }

      logAuditEvent(supabase, {
        tenantId,
        entityType: 'integration',
        entityId: 'samsara',
        action: 'api_key_connected',
        description: 'Samsara connected via API key',
        actorId: auth.ctx.user.id,
        actorEmail: auth.ctx.user.email,
      }).catch(() => {})

      revalidatePath('/settings')
      revalidatePath('/settings/integrations')
      return { success: true }
    }

    // OAuth flow: generate auth URL
    const nonce = crypto.randomBytes(16).toString('hex')

    // L3 fix: persist the nonce server-side BEFORE redirecting the user
    // to Samsara. The future Samsara callback route MUST call
    // consumeNonce(nonce, tenantId, 'samsara') to complete the handshake.
    // The infrastructure is in place now so the callback implementation
    // doesn't need to remember to add it later. Same fail-closed semantic
    // as the QuickBooks flow.
    await issueNonce(nonce, tenantId, 'samsara')

    const statePayload = Buffer.from(
      JSON.stringify({ tenantId, nonce })
    ).toString('base64url')

    const authUrl = getSamsaraAuthUrl(statePayload)

    logAuditEvent(supabase, {
      tenantId,
      entityType: 'integration',
      entityId: 'samsara',
      action: 'oauth_initiated',
      description: 'Samsara OAuth connection initiated',
      actorId: auth.ctx.user.id,
      actorEmail: auth.ctx.user.email,
    }).catch(() => {})

    return { success: true, data: { authUrl, state: statePayload } }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'connectSamsara'
      ),
    }
  }
}

// ============================================================================
// disconnectSamsara — Remove integration and cleanup mappings
// ============================================================================

export async function disconnectSamsara() {
  const auth = await authorize('integrations.manage', {
    rateLimit: { key: 'disconnectSamsara', limit: 5, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    const { data: integration, error: fetchError } = await supabase
      .from('samsara_integrations')
      .select('id')
      .eq('tenant_id', tenantId)
      .single()

    if (fetchError || !integration) {
      return { error: 'Samsara integration not found.' }
    }

    // Delete mapped vehicles and drivers first
    await supabase.from('samsara_vehicles').delete().eq('tenant_id', tenantId)
    await supabase.from('samsara_drivers').delete().eq('tenant_id', tenantId)

    // Delete the integration record
    const { error: deleteError } = await supabase
      .from('samsara_integrations')
      .delete()
      .eq('id', integration.id)
      .eq('tenant_id', tenantId)

    if (deleteError) {
      return { error: safeError(deleteError, 'disconnectSamsara.delete') }
    }

    logAuditEvent(supabase, {
      tenantId,
      entityType: 'integration',
      entityId: 'samsara',
      action: 'disconnected',
      description: 'Samsara integration disconnected and all mappings removed',
      actorId: auth.ctx.user.id,
      actorEmail: auth.ctx.user.email,
    }).catch(() => {})

    revalidatePath('/settings')
    revalidatePath('/settings/integrations')
    return { success: true }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'disconnectSamsara'
      ),
    }
  }
}

// ============================================================================
// getSamsaraStatus — Return connection status for settings page
// ============================================================================

export async function getSamsaraStatus(): Promise<
  { success: true; data: SamsaraStatus } | { error: string }
> {
  const auth = await authorize('integrations.view')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    const { data: integration } = await supabase
      .from('samsara_integrations')
      .select('sync_status, last_sync_at, last_error')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!integration) {
      return {
        success: true,
        data: {
          connected: false,
          connectionStatus: 'disconnected',
          lastSyncAt: null,
          syncError: null,
          vehicleCount: 0,
          driverCount: 0,
          mappedVehicleCount: 0,
          vehicles: [],
          drivers: [],
        },
      }
    }

    // Fetch vehicles and drivers with joins for display
    const [vehiclesResult, driversResult] = await Promise.all([
      supabase
        .from('samsara_vehicles')
        .select('samsara_vehicle_id, samsara_name, samsara_vin, truck_id, trucks(unit_number)')
        .eq('tenant_id', tenantId)
        .order('samsara_name'),
      supabase
        .from('samsara_drivers')
        .select('samsara_driver_id, samsara_name, samsara_status, driver_id, drivers(first_name, last_name)')
        .eq('tenant_id', tenantId)
        .order('samsara_name'),
    ])

    const vehicles: SamsaraVehicleMapping[] = (vehiclesResult.data ?? []).map(
      (v: Record<string, unknown>) => ({
        samsaraId: v.samsara_vehicle_id as string,
        name: (v.samsara_name as string) ?? '',
        vin: (v.samsara_vin as string) ?? null,
        vroomxTruckId: (v.truck_id as string) ?? null,
        vroomxUnitNumber:
          (v.trucks as Record<string, string> | null)?.unit_number ?? null,
      })
    )

    const drivers: SamsaraDriverMapping[] = (driversResult.data ?? []).map(
      (d: Record<string, unknown>) => {
        const driverJoin = d.drivers as Record<string, string> | null
        return {
          samsaraId: d.samsara_driver_id as string,
          name: (d.samsara_name as string) ?? '',
          status: (d.samsara_status === 'active' ? 'active' : 'inactive') as 'active' | 'inactive',
          vroomxDriverId: (d.driver_id as string) ?? null,
          vroomxDriverName: driverJoin
            ? `${driverJoin.first_name} ${driverJoin.last_name}`
            : null,
        }
      }
    )

    return {
      success: true,
      data: {
        connected: integration.sync_status !== 'disconnected',
        connectionStatus: integration.sync_status as SamsaraConnectionStatus,
        lastSyncAt: integration.last_sync_at as string | null,
        syncError: integration.last_error as string | null,
        vehicleCount: vehicles.length,
        driverCount: drivers.length,
        mappedVehicleCount: vehicles.filter((v) => v.vroomxTruckId !== null).length,
        vehicles,
        drivers,
      },
    }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'getSamsaraStatus'
      ),
    }
  }
}

// ============================================================================
// getSamsaraMappings — Return vehicle/driver mapping lists for settings UI
// ============================================================================

export async function getSamsaraMappings(): Promise<
  | { success: true; data: { vehicles: SamsaraVehicleMapping[]; drivers: SamsaraDriverMapping[] } }
  | { error: string }
> {
  const auth = await authorize('integrations.view')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    const [vehiclesResult, driversResult] = await Promise.all([
      supabase
        .from('samsara_vehicles')
        .select('samsara_vehicle_id, samsara_name, samsara_vin, truck_id, trucks(unit_number)')
        .eq('tenant_id', tenantId)
        .order('samsara_name'),
      supabase
        .from('samsara_drivers')
        .select('samsara_driver_id, samsara_name, samsara_status, driver_id, drivers(first_name, last_name)')
        .eq('tenant_id', tenantId)
        .order('samsara_name'),
    ])

    const vehicles: SamsaraVehicleMapping[] = (vehiclesResult.data ?? []).map(
      (v: Record<string, unknown>) => ({
        samsaraId: v.samsara_vehicle_id as string,
        name: (v.samsara_name as string) ?? '',
        vin: (v.samsara_vin as string) ?? null,
        vroomxTruckId: (v.truck_id as string) ?? null,
        vroomxUnitNumber:
          (v.trucks as Record<string, string> | null)?.unit_number ?? null,
      })
    )

    const drivers: SamsaraDriverMapping[] = (driversResult.data ?? []).map(
      (d: Record<string, unknown>) => {
        const driverJoin = d.drivers as Record<string, string> | null
        return {
          samsaraId: d.samsara_driver_id as string,
          name: (d.samsara_name as string) ?? '',
          status: (d.samsara_status === 'active' ? 'active' : 'inactive') as 'active' | 'inactive',
          vroomxDriverId: (d.driver_id as string) ?? null,
          vroomxDriverName: driverJoin
            ? `${driverJoin.first_name} ${driverJoin.last_name}`
            : null,
        }
      }
    )

    return { success: true, data: { vehicles, drivers } }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'getSamsaraMappings'
      ),
    }
  }
}

// ============================================================================
// getVroomxOptions — Truck + driver lists for mapping dropdowns
// ============================================================================

export async function getVroomxOptions(): Promise<
  | { success: true; trucks: VroomxTruckOption[]; drivers: VroomxDriverOption[]; data: { trucks: VroomxTruckOption[]; drivers: VroomxDriverOption[] } }
  | { error: string }
> {
  const auth = await authorize('integrations.view')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    const [trucksResult, driversResult] = await Promise.all([
      supabase
        .from('trucks')
        .select('id, unit_number')
        .eq('tenant_id', tenantId)
        .eq('truck_status', 'active')
        .order('unit_number'),
      supabase
        .from('drivers')
        .select('id, first_name, last_name')
        .eq('tenant_id', tenantId)
        .eq('driver_status', 'active')
        .order('first_name'),
    ])

    if (trucksResult.error) {
      return { error: safeError(trucksResult.error, 'getVroomxOptions.trucks') }
    }
    if (driversResult.error) {
      return { error: safeError(driversResult.error, 'getVroomxOptions.drivers') }
    }

    const trucks: VroomxTruckOption[] = (trucksResult.data ?? []).map(
      (t: { id: string; unit_number: string }) => ({
        id: t.id,
        unitNumber: t.unit_number,
      })
    )
    const driverOptions: VroomxDriverOption[] = (driversResult.data ?? []).map(
      (d: { id: string; first_name: string; last_name: string }) => ({
        id: d.id,
        name: `${d.first_name} ${d.last_name}`,
      })
    )

    return {
      success: true,
      trucks,
      drivers: driverOptions,
      data: { trucks, drivers: driverOptions },
    }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'getVroomxOptions'
      ),
    }
  }
}

// ============================================================================
// syncVehicles — Pull vehicles from Samsara, auto-map by VIN
// ============================================================================

export async function syncVehicles() {
  const auth = await authorize('integrations.manage', {
    rateLimit: { key: 'syncVehicles', limit: 10, windowMs: 300_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    const clientResult = await getClientForTenant(supabase, tenantId)
    if ('error' in clientResult) return { error: clientResult.error }
    const { client, integrationId } = clientResult

    const vehicles = await client.getVehicles()

    let synced = 0
    let mapped = 0

    for (const vehicle of vehicles) {
      // Upsert into samsara_vehicles (unique on tenant_id + samsara_vehicle_id)
      const { data: upserted, error: upsertError } = await supabase
        .from('samsara_vehicles')
        .upsert(
          {
            tenant_id: tenantId,
            samsara_vehicle_id: vehicle.id,
            samsara_name: vehicle.name,
            samsara_vin: vehicle.vin ?? null,
          },
          { onConflict: 'tenant_id,samsara_vehicle_id' }
        )
        .select('id, truck_id')
        .single()

      if (upsertError) {
        console.error('[syncVehicles] Upsert failed for vehicle:', vehicle.id, upsertError.message)
        continue
      }

      synced++

      // Auto-map by VIN if not already mapped
      if (!upserted.truck_id && vehicle.vin) {
        const { data: matchedTruck } = await supabase
          .from('trucks')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('vin', vehicle.vin)
          .single()

        if (matchedTruck) {
          await supabase
            .from('samsara_vehicles')
            .update({ truck_id: matchedTruck.id })
            .eq('id', upserted.id)
            .eq('tenant_id', tenantId)

          mapped++
        }
      } else if (upserted.truck_id) {
        mapped++
      }
    }

    // Update last sync time
    await supabase
      .from('samsara_integrations')
      .update({ last_sync_at: new Date().toISOString(), sync_status: 'active', last_error: null })
      .eq('id', integrationId)
      .eq('tenant_id', tenantId)

    logAuditEvent(supabase, {
      tenantId,
      entityType: 'integration',
      entityId: 'samsara',
      action: 'vehicles_synced',
      description: `Synced ${synced} vehicles from Samsara (${mapped} auto-mapped by VIN)`,
      actorId: auth.ctx.user.id,
      actorEmail: auth.ctx.user.email,
      metadata: { synced, mapped },
    }).catch(() => {})

    revalidatePath('/settings/integrations')
    revalidatePath('/trucks')
    return { success: true, data: { synced, mapped } }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'syncVehicles'
      ),
    }
  }
}

// ============================================================================
// syncDrivers — Pull drivers from Samsara, auto-map by name
// ============================================================================

export async function syncDrivers() {
  const auth = await authorize('integrations.manage', {
    rateLimit: { key: 'syncDrivers', limit: 10, windowMs: 300_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    const clientResult = await getClientForTenant(supabase, tenantId)
    if ('error' in clientResult) return { error: clientResult.error }
    const { client, integrationId } = clientResult

    const samsaraDrivers = await client.getDrivers()

    let synced = 0
    let mapped = 0

    for (const sDriver of samsaraDrivers) {
      const { data: upserted, error: upsertError } = await supabase
        .from('samsara_drivers')
        .upsert(
          {
            tenant_id: tenantId,
            samsara_driver_id: sDriver.id,
            samsara_name: sDriver.name,
            samsara_email: sDriver.email ?? null,
            samsara_phone: sDriver.phone ?? null,
            samsara_license_number: sDriver.licenseNumber ?? null,
            samsara_license_state: sDriver.licenseState ?? null,
            samsara_status: sDriver.driverActivationStatus,
          },
          { onConflict: 'tenant_id,samsara_driver_id' }
        )
        .select('id, driver_id')
        .single()

      if (upsertError) {
        console.error('[syncDrivers] Upsert failed for driver:', sDriver.id, upsertError.message)
        continue
      }

      synced++

      // Auto-map by name if not already mapped
      if (!upserted.driver_id && sDriver.name) {
        const nameParts = sDriver.name.trim().split(/\s+/)
        if (nameParts.length >= 2) {
          // C-1: sanitizeSearch strips PostgREST filter metacharacters and SQL LIKE
          // wildcards (%) before the value reaches .ilike(). The Samsara-side driver
          // name is attacker-controlled (a tenant's Samsara operator can set it to
          // arbitrary strings), so we must treat it as untrusted user input.
          const firstName = sanitizeSearch(nameParts[0])
          const lastName = sanitizeSearch(nameParts.slice(1).join(' '))

          // If sanitization strips the name to empty (e.g. the Samsara-side name
          // was entirely special characters), skip auto-mapping. Operator can
          // still map manually from the integrations UI.
          if (!firstName || !lastName) continue

          const { data: matchedDriver } = await supabase
            .from('drivers')
            .select('id')
            .eq('tenant_id', tenantId)
            .ilike('first_name', firstName)
            .ilike('last_name', lastName)
            .single()

          if (matchedDriver) {
            await supabase
              .from('samsara_drivers')
              .update({ driver_id: matchedDriver.id })
              .eq('id', upserted.id)
              .eq('tenant_id', tenantId)

            mapped++
          }
        }
      } else if (upserted.driver_id) {
        mapped++
      }
    }

    await supabase
      .from('samsara_integrations')
      .update({ last_sync_at: new Date().toISOString(), sync_status: 'active', last_error: null })
      .eq('id', integrationId)
      .eq('tenant_id', tenantId)

    logAuditEvent(supabase, {
      tenantId,
      entityType: 'integration',
      entityId: 'samsara',
      action: 'drivers_synced',
      description: `Synced ${synced} drivers from Samsara (${mapped} auto-mapped by name)`,
      actorId: auth.ctx.user.id,
      actorEmail: auth.ctx.user.email,
      metadata: { synced, mapped },
    }).catch(() => {})

    revalidatePath('/settings/integrations')
    revalidatePath('/drivers')
    return { success: true, data: { synced, mapped } }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'syncDrivers'
      ),
    }
  }
}

// ============================================================================
// syncLocations — Pull GPS data, update driver_locations + samsara_vehicles cache
// ============================================================================

export async function syncLocations() {
  const auth = await authorize('integrations.manage', {
    rateLimit: { key: 'syncLocations', limit: 30, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    const clientResult = await getClientForTenant(supabase, tenantId)
    if ('error' in clientResult) return { error: clientResult.error }
    const { client } = clientResult

    // Get ALL synced vehicles (for GPS caching on map)
    const { data: allVehicles } = await supabase
      .from('samsara_vehicles')
      .select('samsara_vehicle_id, truck_id')
      .eq('tenant_id', tenantId)

    if (!allVehicles || allVehicles.length === 0) {
      return { success: true, data: { updated: 0 } }
    }

    // Build lookup: samsara vehicle id -> truck_id (null if unmapped)
    const vehicleToTruck = new Map<string, string | null>()
    for (const v of allVehicles) {
      vehicleToTruck.set(v.samsara_vehicle_id, v.truck_id)
    }

    // Fetch locations from Samsara
    const locations = await client.getVehicleLocations()

    // Cache location on ALL samsara_vehicles records for map display
    for (const loc of locations) {
      if (vehicleToTruck.has(loc.id) && loc.gps) {
        await supabase
          .from('samsara_vehicles')
          .update({
            last_latitude: loc.gps.latitude,
            last_longitude: loc.gps.longitude,
            last_speed: loc.gps.speedMilesPerHour ?? null,
            last_heading: loc.gps.headingDegrees ?? null,
            last_location_time: loc.gps.time,
          })
          .eq('tenant_id', tenantId)
          .eq('samsara_vehicle_id', loc.id)
      }
    }

    // Find driver assigned to each mapped truck via active trips
    const mappedVehicles = allVehicles.filter((v) => v.truck_id != null)
    const truckIds = [...new Set(mappedVehicles.map((v) => v.truck_id as string))]
    const { data: activeTrips } = await supabase
      .from('trips')
      .select('truck_id, driver_id')
      .eq('tenant_id', tenantId)
      .in('truck_id', truckIds)
      .in('status', ['planned', 'in_progress'])

    const truckToDriver = new Map<string, string>()
    if (activeTrips) {
      for (const trip of activeTrips) {
        if (trip.truck_id && trip.driver_id) {
          truckToDriver.set(trip.truck_id, trip.driver_id)
        }
      }
    }

    let updated = 0

    for (const loc of locations) {
      const truckId = vehicleToTruck.get(loc.id)
      if (!truckId) continue

      const driverId = truckToDriver.get(truckId)
      if (!driverId) continue

      if (!loc.gps) continue

      const { error: locError } = await supabase
        .from('driver_locations')
        .upsert(
          {
            tenant_id: tenantId,
            driver_id: driverId,
            latitude: loc.gps.latitude,
            longitude: loc.gps.longitude,
            speed: loc.gps.speedMilesPerHour ?? null,
            heading: loc.gps.headingDegrees ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id,driver_id' }
        )

      if (locError) {
        console.error('[syncLocations] Upsert failed for driver:', driverId, locError.message)
        continue
      }

      updated++
    }

    revalidatePath('/map')
    revalidatePath('/dispatch')
    return { success: true, data: { updated } }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'syncLocations'
      ),
    }
  }
}

// ============================================================================
// syncHOS — Pull HOS clocks, update eld_logs table
// ============================================================================

export async function syncHOS() {
  const auth = await authorize('integrations.manage', {
    rateLimit: { key: 'syncHOS', limit: 10, windowMs: 300_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    const clientResult = await getClientForTenant(supabase, tenantId)
    if ('error' in clientResult) return { error: clientResult.error }
    const { client } = clientResult

    // Get mapped drivers
    const { data: mappedDrivers } = await supabase
      .from('samsara_drivers')
      .select('samsara_driver_id, driver_id')
      .eq('tenant_id', tenantId)
      .not('driver_id', 'is', null)

    if (!mappedDrivers || mappedDrivers.length === 0) {
      return { success: true, data: { updated: 0 } }
    }

    const samsaraToDriver = new Map<string, string>()
    for (const d of mappedDrivers) {
      samsaraToDriver.set(d.samsara_driver_id, d.driver_id)
    }

    const hosClocks = await client.getHOSClocks()

    let updated = 0

    for (const hos of hosClocks) {
      const driverId = samsaraToDriver.get(hos.driverId)
      if (!driverId) continue

      // Insert ELD log record (append-only table — no upsert)
      const { error: hosError } = await supabase
        .from('eld_logs')
        .insert({
          tenant_id: tenantId,
          driver_id: driverId,
          samsara_driver_id: hos.driverId,
          duty_status: hos.currentDutyStatus,
          started_at: new Date().toISOString(),
          time_until_break_ms: hos.timeUntilBreak ?? null,
          driving_time_remaining_ms: hos.drivingTimeRemaining ?? null,
          shift_time_remaining_ms: hos.shiftTimeRemaining ?? null,
          cycle_time_remaining_ms: hos.cycleTimeRemaining ?? null,
          vehicle_id: hos.vehicleId ?? null,
        })

      if (hosError) {
        console.error('[syncHOS] Insert failed for driver:', driverId, hosError.message)
        continue
      }

      updated++
    }

    revalidatePath('/drivers')
    revalidatePath('/compliance')
    return { success: true, data: { updated } }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'syncHOS'
      ),
    }
  }
}

// ============================================================================
// syncSafetyEvents — Pull safety events, deduplicate, insert into safety_events
// ============================================================================

export async function syncSafetyEvents() {
  const auth = await authorize('integrations.manage', {
    rateLimit: { key: 'syncSafetyEvents', limit: 10, windowMs: 300_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    const clientResult = await getClientForTenant(supabase, tenantId)
    if ('error' in clientResult) return { error: clientResult.error }
    const { client } = clientResult

    // Fetch safety events from last 24 hours
    const endTime = new Date().toISOString()
    const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const events = await client.getSafetyEvents(startTime, endTime)

    // Build lookup maps for vehicle and driver mapping
    const [mappedVehiclesResult, mappedDriversResult] = await Promise.all([
      supabase
        .from('samsara_vehicles')
        .select('samsara_vehicle_id, truck_id')
        .eq('tenant_id', tenantId)
        .not('truck_id', 'is', null),
      supabase
        .from('samsara_drivers')
        .select('samsara_driver_id, driver_id')
        .eq('tenant_id', tenantId)
        .not('driver_id', 'is', null),
    ])

    const vehicleToTruck = new Map<string, string>()
    for (const v of (mappedVehiclesResult.data ?? [])) {
      vehicleToTruck.set(v.samsara_vehicle_id, v.truck_id)
    }

    const samsaraToDriver = new Map<string, string>()
    for (const d of (mappedDriversResult.data ?? [])) {
      samsaraToDriver.set(d.samsara_driver_id, d.driver_id)
    }

    let inserted = 0

    for (const event of events) {
      const truckId = vehicleToTruck.get(event.vehicleId) ?? null
      const driverId = event.driverId
        ? samsaraToDriver.get(event.driverId) ?? null
        : null

      // Deduplicate by checking samsara_event_id in metadata JSONB
      const { data: existing } = await supabase
        .from('safety_events')
        .select('id')
        .eq('tenant_id', tenantId)
        .contains('metadata' as string, { samsara_event_id: event.id })
        .limit(1)

      if (existing && existing.length > 0) continue

      const { error: insertError } = await supabase
        .from('safety_events')
        .insert({
          tenant_id: tenantId,
          event_type: event.type,
          severity: 'minor',
          status: 'open',
          event_date: new Date(event.time).toISOString().split('T')[0],
          driver_id: driverId,
          truck_id: truckId,
          title: event.behaviorLabel ?? event.type,
          description: `Samsara safety event: ${event.type}${event.maxSpeedMph ? ` (max speed: ${event.maxSpeedMph} mph)` : ''}`,
          location: event.location
            ? `${event.location.latitude}, ${event.location.longitude}`
            : null,
          metadata: {
            samsara_event_id: event.id,
            source: 'samsara',
            max_speed_mph: event.maxSpeedMph ?? null,
            vehicle_name: event.vehicleName ?? null,
            driver_name: event.driverName ?? null,
          },
        })

      if (insertError) {
        console.error('[syncSafetyEvents] Insert failed:', event.id, insertError.message)
        continue
      }

      inserted++
    }

    revalidatePath('/safety')
    revalidatePath('/compliance')
    return { success: true, data: { inserted } }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'syncSafetyEvents'
      ),
    }
  }
}

// ============================================================================
// syncOdometers — Pull odometer readings for mapped vehicles
// ============================================================================

/**
 * Pull the latest odometer reading from Samsara for each mapped vehicle and
 * update `samsara_vehicles.last_odometer_meters` + `last_odometer_time`.
 * Idempotent — runs every full sync.
 *
 * Defense-in-depth: the UPDATE is scoped by BOTH samsara_vehicle_id AND
 * tenant_id, so a malformed Samsara response cannot overwrite another
 * tenant's row even if the upstream ID happens to collide. Vehicles that
 * have never reported OBD data are silently skipped.
 */
export async function syncOdometers() {
  const auth = await authorize('integrations.manage', {
    rateLimit: { key: 'syncOdometers', limit: 30, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    const clientResult = await getClientForTenant(supabase, tenantId)
    if ('error' in clientResult) return { error: clientResult.error }
    const { client } = clientResult

    // Build the set of samsara vehicle IDs this tenant has synced. We only
    // write to rows that already exist in the tenant's samsara_vehicles
    // table — any id Samsara returns that isn't in this set is ignored.
    const { data: tenantVehicles, error: vehiclesError } = await supabase
      .from('samsara_vehicles')
      .select('samsara_vehicle_id')
      .eq('tenant_id', tenantId)

    if (vehiclesError) {
      return {
        error: safeError(
          { message: vehiclesError.message },
          'syncOdometers/vehicles',
        ),
      }
    }

    const allowedIds = new Set(
      (tenantVehicles ?? []).map((v) => v.samsara_vehicle_id as string),
    )
    if (allowedIds.size === 0) {
      return { success: true, data: { updated: 0, skipped: 0 } }
    }

    const snapshots = await client.getVehicleOdometers()

    let updated = 0
    let skipped = 0
    for (const snap of snapshots) {
      if (!allowedIds.has(snap.id)) {
        skipped++
        continue
      }
      if (!snap.obdOdometerMeters) {
        skipped++
        continue
      }
      // Skip OBD-0 readings — some trucks emit 0 before the ECU establishes
      // a baseline; showing "0 mi" in the UI is worse than showing nothing.
      if (snap.obdOdometerMeters.value <= 0) {
        skipped++
        continue
      }

      const { error: updateError } = await supabase
        .from('samsara_vehicles')
        .update({
          last_odometer_meters: snap.obdOdometerMeters.value,
          last_odometer_time: snap.obdOdometerMeters.time,
        })
        .eq('tenant_id', tenantId)
        .eq('samsara_vehicle_id', snap.id)

      if (updateError) {
        safeError(
          { message: updateError.message },
          `syncOdometers/update:${snap.id}`,
        )
        skipped++
        continue
      }
      updated++
    }

    revalidatePath('/trucks')
    return { success: true, data: { updated, skipped } }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'syncOdometers',
      ),
    }
  }
}

// ============================================================================
// triggerFullSync — Run all syncs sequentially to respect Samsara rate limits
// ============================================================================

export async function triggerFullSync() {
  const auth = await authorize('integrations.manage', {
    rateLimit: { key: 'triggerFullSync', limit: 3, windowMs: 300_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    // Mark integration as syncing
    await supabase
      .from('samsara_integrations')
      .update({ sync_status: 'active', last_error: null })
      .eq('tenant_id', tenantId)

    const results = {
      vehicles: { synced: 0, mapped: 0 },
      drivers: { synced: 0, mapped: 0 },
      locations: { updated: 0 },
      odometers: { updated: 0, skipped: 0 },
      hos: { updated: 0 },
      safetyEvents: { inserted: 0 },
    }
    const warnings: string[] = []

    // Run syncs sequentially — continue on individual failures
    const vehicleResult = await syncVehicles()
    if ('error' in vehicleResult) {
      warnings.push(`Vehicles: ${vehicleResult.error}`)
    } else if (vehicleResult.data) {
      results.vehicles = vehicleResult.data
    }

    const driverResult = await syncDrivers()
    if ('error' in driverResult) {
      warnings.push(`Drivers: ${driverResult.error}`)
    } else if (driverResult.data) {
      results.drivers = driverResult.data
    }

    const locationResult = await syncLocations()
    if ('error' in locationResult) {
      warnings.push(`Locations: ${locationResult.error}`)
    } else if (locationResult.data) {
      results.locations = locationResult.data
    }

    const odometerResult = await syncOdometers()
    if ('error' in odometerResult) {
      warnings.push(`Odometers: ${odometerResult.error}`)
    } else if (odometerResult.data) {
      results.odometers = odometerResult.data
    }

    const hosResult = await syncHOS()
    if ('error' in hosResult) {
      warnings.push(`HOS: ${hosResult.error}`)
    } else if (hosResult.data) {
      results.hos = hosResult.data
    }

    const safetyResult = await syncSafetyEvents()
    if ('error' in safetyResult) {
      warnings.push(`Safety Events: ${safetyResult.error}`)
    } else if (safetyResult.data) {
      results.safetyEvents = safetyResult.data
    }

    // If ALL syncs failed, return error
    if (warnings.length === 6) {
      return { error: 'All sync operations failed. Please check your API key and try again.' }
    }

    // Final sync timestamp
    await supabase
      .from('samsara_integrations')
      .update({
        last_sync_at: new Date().toISOString(),
        sync_status: 'active',
        last_error: null,
      })
      .eq('tenant_id', tenantId)

    logAuditEvent(supabase, {
      tenantId,
      entityType: 'integration',
      entityId: 'samsara',
      action: 'full_sync',
      description: `Full Samsara sync completed: ${results.vehicles.synced} vehicles, ${results.drivers.synced} drivers${warnings.length ? ` (${warnings.length} warnings)` : ''}`,
      actorId: auth.ctx.user.id,
      actorEmail: auth.ctx.user.email,
      metadata: { ...results, warnings },
    }).catch(() => {})

    revalidatePath('/settings/integrations')
    return { success: true, data: results, warnings }
  } catch (err) {
    // Mark integration as error on failure
    try {
      await supabase
        .from('samsara_integrations')
        .update({
          sync_status: 'error',
          last_error: err instanceof Error ? err.message : 'Unknown sync error',
        })
        .eq('tenant_id', tenantId)
    } catch {
      // Ignore — best-effort error marking
    }

    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'triggerFullSync'
      ),
    }
  }
}

// ============================================================================
// mapSamsaraVehicle — Manual vehicle mapping (or unmapping if truckId is null)
// ============================================================================

const mapVehicleSchema = z.object({
  samsaraVehicleId: z.string().min(1),
  truckId: z.string().uuid().nullable(),
})

export async function mapSamsaraVehicle(data: unknown) {
  const parsed = mapVehicleSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('integrations.manage')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    const { samsaraVehicleId, truckId } = parsed.data

    // Verify the truck belongs to this tenant (if mapping, not unmapping)
    if (truckId) {
      const { data: truck, error: truckError } = await supabase
        .from('trucks')
        .select('id')
        .eq('id', truckId)
        .eq('tenant_id', tenantId)
        .single()

      if (truckError || !truck) {
        return { error: 'Truck not found.' }
      }
    }

    const { error: updateError } = await supabase
      .from('samsara_vehicles')
      .update({ truck_id: truckId })
      .eq('samsara_vehicle_id', samsaraVehicleId)
      .eq('tenant_id', tenantId)

    if (updateError) {
      return { error: safeError(updateError, 'mapSamsaraVehicle') }
    }

    logAuditEvent(supabase, {
      tenantId,
      entityType: 'integration',
      entityId: samsaraVehicleId,
      action: truckId ? 'vehicle_mapped' : 'vehicle_unmapped',
      description: truckId
        ? `Samsara vehicle ${samsaraVehicleId} mapped to truck ${truckId}`
        : `Samsara vehicle ${samsaraVehicleId} unmapped`,
      actorId: auth.ctx.user.id,
      actorEmail: auth.ctx.user.email,
      metadata: { samsaraVehicleId, truckId },
    }).catch(() => {})

    revalidatePath('/settings/integrations')
    return { success: true }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'mapSamsaraVehicle'
      ),
    }
  }
}

// ============================================================================
// mapSamsaraDriver — Manual driver mapping (or unmapping if driverId is null)
// ============================================================================

const mapDriverSchema = z.object({
  samsaraDriverId: z.string().min(1),
  driverId: z.string().uuid().nullable(),
})

export async function mapSamsaraDriver(data: unknown) {
  const parsed = mapDriverSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('integrations.manage')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    const { samsaraDriverId, driverId } = parsed.data

    // Verify the driver belongs to this tenant (if mapping, not unmapping)
    if (driverId) {
      const { data: driver, error: driverError } = await supabase
        .from('drivers')
        .select('id')
        .eq('id', driverId)
        .eq('tenant_id', tenantId)
        .single()

      if (driverError || !driver) {
        return { error: 'Driver not found.' }
      }
    }

    const { error: updateError } = await supabase
      .from('samsara_drivers')
      .update({ driver_id: driverId })
      .eq('samsara_driver_id', samsaraDriverId)
      .eq('tenant_id', tenantId)

    if (updateError) {
      return { error: safeError(updateError, 'mapSamsaraDriver') }
    }

    logAuditEvent(supabase, {
      tenantId,
      entityType: 'integration',
      entityId: samsaraDriverId,
      action: driverId ? 'driver_mapped' : 'driver_unmapped',
      description: driverId
        ? `Samsara driver ${samsaraDriverId} mapped to driver ${driverId}`
        : `Samsara driver ${samsaraDriverId} unmapped`,
      actorId: auth.ctx.user.id,
      actorEmail: auth.ctx.user.email,
      metadata: { samsaraDriverId, driverId },
    }).catch(() => {})

    revalidatePath('/settings/integrations')
    return { success: true }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'mapSamsaraDriver'
      ),
    }
  }
}
