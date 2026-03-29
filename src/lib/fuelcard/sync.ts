import type { SupabaseClient } from '@supabase/supabase-js'
import { FuelCardClient } from './client'
import type { FuelTransaction, FuelSyncResult, FuelAnomalyFlag } from './types'

// ============================================================================
// Fuel Card Sync Orchestration
// ============================================================================

/**
 * Build a FuelCardClient for a given tenant by reading their stored credentials.
 * Returns null if the tenant has no fuel card integration configured.
 */
export async function getFuelCardClient(
  supabase: SupabaseClient,
  tenantId: string
): Promise<FuelCardClient | null> {
  const { data: integration, error } = await supabase
    .from('fuelcard_integrations')
    .select('api_key_encrypted, account_number, sync_status')
    .eq('tenant_id', tenantId)
    .single()

  if (error || !integration) return null
  if (integration.sync_status === 'disconnected') return null

  // API key is stored encrypted — in production this would be decrypted
  // via a KMS or server-side decryption utility. For now we pass through
  // since the encryption layer is handled at insert/read boundaries.
  const apiKey = integration.api_key_encrypted as string
  const accountNumber = integration.account_number as string | undefined

  return new FuelCardClient(apiKey, accountNumber ?? undefined)
}

/**
 * Main sync function — fetches transactions from the fuel card API
 * and upserts them into the database with auto-matching and anomaly detection.
 *
 * Security: caller MUST have already authorized with tenant_id.
 */
export async function syncFuelTransactions(
  supabase: SupabaseClient,
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<FuelSyncResult> {
  const result: FuelSyncResult = {
    synced: 0,
    matched: 0,
    flagged: 0,
    skipped: 0,
    errors: [],
  }

  // 1. Get client for tenant
  const client = await getFuelCardClient(supabase, tenantId)
  if (!client) {
    result.errors.push('Fuel card integration not configured or disconnected')
    return result
  }

  // 2. Fetch transactions from API
  let transactions: FuelTransaction[]
  try {
    transactions = await client.getTransactions(startDate, endDate)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown API error'
    result.errors.push(`Failed to fetch transactions: ${message}`)

    // Update integration status to error
    await supabase
      .from('fuelcard_integrations')
      .update({
        sync_status: 'error',
        last_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)

    return result
  }

  // 3. Process each transaction
  for (const txn of transactions) {
    try {
      // 3a. Dedup check — skip if external_transaction_id already exists
      const { data: existing } = await supabase
        .from('fuelcard_transactions')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('provider', 'msfuelcard')
        .eq('external_transaction_id', txn.transactionId)
        .maybeSingle()

      if (existing) {
        result.skipped++
        continue
      }

      // 3b. Auto-match to truck by unit number
      let matchedTruckId: string | null = null
      if (txn.vehicleUnit) {
        matchedTruckId = await matchToTruck(supabase, tenantId, txn.vehicleUnit)
      }

      // 3c. Auto-match to driver (via truck's current trip assignment)
      let matchedDriverId: string | null = null
      if (matchedTruckId) {
        matchedDriverId = await matchToDriver(supabase, tenantId, matchedTruckId)
      }

      // 3d. Detect anomalies
      const anomaly = detectAnomalies(txn)

      // 3e. Insert into fuelcard_transactions
      const { error: insertError } = await supabase
        .from('fuelcard_transactions')
        .insert({
          tenant_id: tenantId,
          provider: 'msfuelcard',
          external_transaction_id: txn.transactionId,
          transaction_date: txn.transactionDate,
          card_number: txn.cardNumber,
          driver_name_on_card: txn.driverName || null,
          vehicle_unit_on_card: txn.vehicleUnit || null,
          product_type: txn.productType,
          gallons: String(txn.gallons),
          price_per_gallon: String(txn.pricePerGallon),
          total_amount: String(txn.totalAmount),
          odometer: txn.odometer ?? null,
          location_name: txn.locationName || null,
          city: txn.city || null,
          state: txn.state || null,
          latitude: txn.latitude ?? null,
          longitude: txn.longitude ?? null,
          matched_truck_id: matchedTruckId,
          matched_driver_id: matchedDriverId,
          match_status: matchedTruckId ? 'matched' : 'unmatched',
          anomaly_flagged: anomaly.flagged,
          anomaly_reason: anomaly.reason || null,
        })

      if (insertError) {
        result.errors.push(
          `Transaction ${txn.transactionId}: insert failed`
        )
        continue
      }

      result.synced++
      if (matchedTruckId) result.matched++
      if (anomaly.flagged) result.flagged++

      // 3f. If matched, also create a fuel_entries record for unified tracking
      if (matchedTruckId && !anomaly.flagged) {
        const totalCost = txn.gallons * txn.pricePerGallon
        await supabase.from('fuel_entries').insert({
          tenant_id: tenantId,
          truck_id: matchedTruckId,
          driver_id: matchedDriverId,
          date: txn.transactionDate.split('T')[0], // date only
          gallons: String(txn.gallons),
          cost_per_gallon: String(txn.pricePerGallon),
          total_cost: String(totalCost),
          odometer: txn.odometer ?? null,
          location: txn.locationName || null,
          state: txn.state || null,
          notes: `Auto-synced from fuel card (${txn.cardNumber})`,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Transaction ${txn.transactionId}: ${message}`)
    }
  }

  // 4. Update last sync timestamp
  await supabase
    .from('fuelcard_integrations')
    .update({
      sync_status: 'active',
      last_sync_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)

  return result
}

// ============================================================================
// Matching Helpers
// ============================================================================

/**
 * Match a fuel card transaction to a VroomX truck by unit number.
 * Case-insensitive match against trucks.unit_number.
 */
export async function matchToTruck(
  supabase: SupabaseClient,
  tenantId: string,
  vehicleUnit: string
): Promise<string | null> {
  const { data: truck } = await supabase
    .from('trucks')
    .select('id')
    .eq('tenant_id', tenantId)
    .ilike('unit_number', vehicleUnit)
    .maybeSingle()

  return truck?.id ?? null
}

/**
 * Match a fuel card transaction to a driver via the truck's current active trip.
 * Looks for an in_progress or planned trip assigned to this truck and returns
 * the driver_id from that trip.
 */
export async function matchToDriver(
  supabase: SupabaseClient,
  tenantId: string,
  truckId: string
): Promise<string | null> {
  const { data: trip } = await supabase
    .from('trips')
    .select('driver_id')
    .eq('tenant_id', tenantId)
    .eq('truck_id', truckId)
    .in('status', ['in_progress', 'planned'])
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  return trip?.driver_id ?? null
}

// ============================================================================
// Anomaly Detection
// ============================================================================

/**
 * Simple rule-based anomaly detection for fuel card transactions.
 *
 * Rules:
 * - Volume > 200 gallons -> flag (typical truck tank is 100-150 gal)
 * - Total > $1000 -> flag (unusually high single transaction)
 */
export function detectAnomalies(transaction: FuelTransaction): FuelAnomalyFlag {
  if (transaction.gallons > 200) {
    return { flagged: true, reason: 'volume_exceeded' }
  }

  if (transaction.totalAmount > 1000) {
    return { flagged: true, reason: 'high_dollar_amount' }
  }

  return { flagged: false }
}
