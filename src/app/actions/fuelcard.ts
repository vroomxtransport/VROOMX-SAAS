'use server'

import { z } from 'zod'
import { authorize, safeError } from '@/lib/authz'
import { logAuditEvent } from '@/lib/audit-log'
import { revalidatePath } from 'next/cache'
import type { FuelSyncResult } from '@/lib/fuelcard/types'
import { captureAsyncError } from '@/lib/async-safe'

// ============================================================================
// Types for UI consumption
// ============================================================================

export type FuelCardSyncStatus = 'active' | 'syncing' | 'error' | 'disconnected'

export interface FuelCardStatusData {
  connected: boolean
  provider: string | null
  lastSync: string | null
  syncStatus: FuelCardSyncStatus
  syncError: string | null
  transactionCount: number
  matchRate: number // 0-100 percentage
  flaggedCount: number
}

export interface FuelCardTransactionRow {
  id: string
  externalTransactionId: string
  transactionDate: string
  cardNumber: string
  driverName: string | null
  vehicleUnit: string | null
  productType: string
  gallons: string
  pricePerGallon: string
  totalAmount: string
  odometer: number | null
  locationName: string | null
  city: string | null
  state: string | null
  matchedTruckId: string | null
  matchedTruckUnit: string | null
  matchedDriverId: string | null
  matchedDriverName: string | null
  flagged: boolean
  flagReason: string | null
  createdAt: string
}

export interface FuelCardTransactionsResult {
  transactions: FuelCardTransactionRow[]
  total: number
  page: number
  pageSize: number
}

// ============================================================================
// connectFuelCard — Store API key + test connection
// ============================================================================

const connectSchema = z.object({
  apiKey: z.string().min(10, 'API key must be at least 10 characters'),
  accountNumber: z.string().optional(),
  provider: z.enum(['multi_service']).default('multi_service'),
})

export async function connectFuelCard(data: unknown) {
  const parsed = connectSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('integrations.manage', {
    rateLimit: { key: 'connectFuelCard', limit: 5, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    // Test connection with the fuel card API
    const { FuelCardClient } = await import('@/lib/fuelcard/client')
    const client = new FuelCardClient(parsed.data.apiKey)
    const connected = await client.testConnection()

    if (!connected) {
      return { error: 'Failed to connect. Please verify your API key.' }
    }

    // Fetch account info for storage
    const accountInfo = await client.getAccountInfo()

    // Upsert fuelcard_integrations record
    const { error: upsertError } = await supabase
      .from('fuelcard_integrations')
      .upsert(
        {
          tenant_id: tenantId,
          provider: parsed.data.provider,
          api_key_encrypted: parsed.data.apiKey, // TODO: encrypt at rest via Supabase Vault
          account_number: accountInfo.accountNumber || parsed.data.accountNumber || null,
          company_name: accountInfo.companyName || null,
          card_count: accountInfo.cardCount || 0,
          sync_status: 'active',
          last_error: null,
          connected_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' }
      )

    if (upsertError) {
      return { error: safeError(upsertError, 'connectFuelCard.upsert') }
    }

    logAuditEvent(supabase, {
      tenantId,
      entityType: 'integration',
      entityId: 'multi-service-fuel-card',
      action: 'connected',
      description: `Fuel card connected (${accountInfo.companyName ?? 'Multi Service'})`,
      actorId: auth.ctx.user.id,
      actorEmail: auth.ctx.user.email,
      metadata: {
        provider: parsed.data.provider,
        accountNumber: accountInfo.accountNumber,
        cardCount: accountInfo.cardCount,
      },
    }).catch(captureAsyncError('fuelcard sync'))

    revalidatePath('/settings')
    revalidatePath('/settings/integrations')
    revalidatePath('/fuel-tracking')
    return { success: true, data: { accountNumber: accountInfo.accountNumber, cardCount: accountInfo.cardCount } }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'connectFuelCard'
      ),
    }
  }
}

// ============================================================================
// disconnectFuelCard — Remove integration (keep historical transactions)
// ============================================================================

export async function disconnectFuelCard() {
  const auth = await authorize('integrations.manage', {
    rateLimit: { key: 'disconnectFuelCard', limit: 5, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    const { data: integration, error: fetchError } = await supabase
      .from('fuelcard_integrations')
      .select('id')
      .eq('tenant_id', tenantId)
      .single()

    if (fetchError || !integration) {
      return { error: 'Fuel card integration not found.' }
    }

    // Delete integration record but keep fuelcard_transactions (historical data)
    const { error: deleteError } = await supabase
      .from('fuelcard_integrations')
      .delete()
      .eq('id', integration.id)
      .eq('tenant_id', tenantId)

    if (deleteError) {
      return { error: safeError(deleteError, 'disconnectFuelCard.delete') }
    }

    logAuditEvent(supabase, {
      tenantId,
      entityType: 'integration',
      entityId: 'multi-service-fuel-card',
      action: 'disconnected',
      description: 'Fuel card integration disconnected (transaction history preserved)',
      actorId: auth.ctx.user.id,
      actorEmail: auth.ctx.user.email,
    }).catch(captureAsyncError('fuelcard sync'))

    revalidatePath('/settings')
    revalidatePath('/settings/integrations')
    revalidatePath('/fuel-tracking')
    return { success: true }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'disconnectFuelCard'
      ),
    }
  }
}

// ============================================================================
// getFuelCardStatus — For settings UI
// ============================================================================

export async function getFuelCardStatus(): Promise<
  { success: true; data: FuelCardStatusData } | { error: string }
> {
  const auth = await authorize('integrations.view')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    const { data: integration } = await supabase
      .from('fuelcard_integrations')
      .select('provider, sync_status, last_sync_at, last_error')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!integration) {
      return {
        success: true,
        data: {
          connected: false,
          provider: null,
          lastSync: null,
          syncStatus: 'disconnected',
          syncError: null,
          transactionCount: 0,
          matchRate: 0,
          flaggedCount: 0,
        },
      }
    }

    // Count transactions, matched, and flagged
    const [totalCount, matchedCount, flaggedCount] = await Promise.all([
      supabase
        .from('fuelcard_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      supabase
        .from('fuelcard_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .not('matched_truck_id', 'is', null),
      supabase
        .from('fuelcard_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('anomaly_flagged', true),
    ])

    const total = totalCount.count ?? 0
    const matched = matchedCount.count ?? 0
    const matchRate = total > 0 ? Math.round((matched / total) * 100) : 0

    return {
      success: true,
      data: {
        connected: (integration.sync_status as string) !== 'disconnected',
        provider: integration.provider as string | null,
        lastSync: integration.last_sync_at as string | null,
        syncStatus: integration.sync_status as FuelCardSyncStatus,
        syncError: integration.last_error as string | null,
        transactionCount: total,
        matchRate,
        flaggedCount: flaggedCount.count ?? 0,
      },
    }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'getFuelCardStatus'
      ),
    }
  }
}

// ============================================================================
// syncFuelTransactions — Manual sync trigger
// ============================================================================

export async function syncFuelTransactions(): Promise<
  { success: true; data: FuelSyncResult } | { error: string }
> {
  const auth = await authorize('integrations.manage', {
    rateLimit: { key: 'syncFuel', limit: 6, windowMs: 3_600_000 }, // 6 per hour
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    // Mark as syncing
    await supabase
      .from('fuelcard_integrations')
      .update({ sync_status: 'syncing' })
      .eq('tenant_id', tenantId)

    // Verify integration exists before syncing
    const { data: integration, error: fetchError } = await supabase
      .from('fuelcard_integrations')
      .select('id')
      .eq('tenant_id', tenantId)
      .single()

    if (fetchError || !integration) {
      return { error: 'Fuel card integration not found. Please connect first.' }
    }

    // Sync last 7 days of transactions
    const { syncFuelTransactions: doSync } = await import('@/lib/fuelcard/sync')
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 7)

    const result = await doSync(
      supabase,
      tenantId,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0],
    )

    // Update sync status
    const hasErrors = result.errors.length > 0
    await supabase
      .from('fuelcard_integrations')
      .update({
        sync_status: hasErrors ? 'error' : 'active',
        last_sync_at: new Date().toISOString(),
        last_error: hasErrors ? result.errors[0] : null,
      })
      .eq('tenant_id', tenantId)

    logAuditEvent(supabase, {
      tenantId,
      entityType: 'integration',
      entityId: 'multi-service-fuel-card',
      action: 'sync_completed',
      description: `Fuel card sync: ${result.synced} synced, ${result.matched} matched, ${result.flagged} flagged`,
      actorId: auth.ctx.user.id,
      actorEmail: auth.ctx.user.email,
      metadata: {
        synced: result.synced,
        matched: result.matched,
        flagged: result.flagged,
        skipped: result.skipped,
        errorCount: result.errors.length,
      },
    }).catch(captureAsyncError('fuelcard sync'))

    revalidatePath('/fuel-tracking')
    revalidatePath('/settings/integrations')
    return { success: true, data: result }
  } catch (err) {
    // Reset sync status on failure
    try {
      await supabase
        .from('fuelcard_integrations')
        .update({
          sync_status: 'error',
          last_error: err instanceof Error ? err.message : 'Sync failed',
        })
        .eq('tenant_id', tenantId)
    } catch {
      // Non-critical — swallow status update failure
    }

    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'syncFuelTransactions'
      ),
    }
  }
}

// ============================================================================
// getFuelCardTransactions — View raw transactions with filters
// ============================================================================

const getTransactionsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  matched: z.enum(['all', 'matched', 'unmatched']).default('all'),
  flagged: z.boolean().default(false),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export async function getFuelCardTransactions(data: unknown): Promise<
  { success: true; data: FuelCardTransactionsResult } | { error: string }
> {
  const parsed = getTransactionsSchema.safeParse(data)
  if (!parsed.success) {
    return { error: 'Invalid filter parameters.' }
  }

  const auth = await authorize('fuel.view')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    const { page, pageSize, matched, flagged, startDate, endDate } = parsed.data
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('fuelcard_transactions')
      .select(
        `id, external_transaction_id, transaction_date, card_number, driver_name_on_card,
         vehicle_unit_on_card, product_type, gallons, price_per_gallon, total_amount,
         odometer, location_name, city, state, matched_truck_id, matched_driver_id,
         anomaly_flagged, anomaly_reason, created_at,
         trucks:matched_truck_id(id, unit_number),
         drivers:matched_driver_id(id, first_name, last_name)`,
        { count: 'exact' }
      )
      .eq('tenant_id', tenantId)
      .order('transaction_date', { ascending: false })
      .range(from, to)

    // Apply filters
    if (matched === 'matched') {
      query = query.not('matched_truck_id', 'is', null)
    } else if (matched === 'unmatched') {
      query = query.is('matched_truck_id', null)
    }

    if (flagged) {
      query = query.eq('anomaly_flagged', true)
    }

    if (startDate) {
      query = query.gte('transaction_date', startDate)
    }

    if (endDate) {
      query = query.lte('transaction_date', endDate)
    }

    const { data: rows, count, error: queryError } = await query

    if (queryError) {
      return { error: safeError(queryError, 'getFuelCardTransactions') }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transactions: FuelCardTransactionRow[] = (rows ?? []).map((r: any) => ({
      id: r.id,
      externalTransactionId: r.external_transaction_id,
      transactionDate: r.transaction_date,
      cardNumber: r.card_number,
      driverName: r.driver_name_on_card,
      vehicleUnit: r.vehicle_unit_on_card,
      productType: r.product_type,
      gallons: r.gallons,
      pricePerGallon: r.price_per_gallon,
      totalAmount: r.total_amount,
      odometer: r.odometer,
      locationName: r.location_name,
      city: r.city,
      state: r.state,
      matchedTruckId: r.matched_truck_id,
      matchedTruckUnit: r.trucks?.unit_number ?? null,
      matchedDriverId: r.matched_driver_id,
      matchedDriverName: r.drivers
        ? `${r.drivers.first_name} ${r.drivers.last_name}`
        : null,
      flagged: r.anomaly_flagged ?? false,
      flagReason: r.anomaly_reason,
      createdAt: r.created_at,
    }))

    return {
      success: true,
      data: {
        transactions,
        total: count ?? 0,
        page,
        pageSize,
      },
    }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'getFuelCardTransactions'
      ),
    }
  }
}

// ============================================================================
// matchTransaction — Manual truck/driver match
// ============================================================================

const matchSchema = z.object({
  transactionId: z.string().uuid(),
  truckId: z.string().uuid(),
})

export async function matchTransaction(data: unknown) {
  const parsed = matchSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('fuel.update', {
    rateLimit: { key: 'matchFuelTx', limit: 60, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    // Verify the transaction belongs to this tenant
    const { data: txn, error: txnError } = await supabase
      .from('fuelcard_transactions')
      .select('id, external_transaction_id, gallons, price_per_gallon, total_amount, transaction_date, location_name, state, odometer, product_type, matched_truck_id')
      .eq('id', parsed.data.transactionId)
      .eq('tenant_id', tenantId)
      .single()

    if (txnError || !txn) {
      return { error: 'Transaction not found.' }
    }

    // Verify the truck belongs to this tenant
    const { data: truck, error: truckError } = await supabase
      .from('trucks')
      .select('id, unit_number, assigned_driver_id')
      .eq('id', parsed.data.truckId)
      .eq('tenant_id', tenantId)
      .single()

    if (truckError || !truck) {
      return { error: 'Truck not found.' }
    }

    // Update transaction with match
    const { error: updateError } = await supabase
      .from('fuelcard_transactions')
      .update({
        matched_truck_id: truck.id,
        matched_driver_id: truck.assigned_driver_id || null,
      })
      .eq('id', txn.id)
      .eq('tenant_id', tenantId)

    if (updateError) {
      return { error: safeError(updateError, 'matchTransaction.update') }
    }

    // Create a fuel_entry if this transaction hasn't been converted yet
    if (!txn.matched_truck_id) {
      const gallons = parseFloat(txn.gallons as string) || 0
      const costPerGallon = parseFloat(txn.price_per_gallon as string) || 0
      const totalCost = parseFloat(txn.total_amount as string) || gallons * costPerGallon

      if (gallons > 0 && costPerGallon > 0) {
        // Match must use the SAME `source` + `source_external_id` combo that
        // the sync path writes, otherwise:
        //   (a) the ledger renders a "Manual" badge instead of "MSFuelCard"
        //   (b) the Wave 3 partial unique index on
        //       (tenant_id, source, source_external_id) doesn't dedupe the
        //       row, so a subsequent sync of the same transaction can create
        //       a duplicate fuel_entries row
        const { error: insertError } = await supabase
          .from('fuel_entries')
          .insert({
            tenant_id: tenantId,
            truck_id: truck.id,
            driver_id: truck.assigned_driver_id || null,
            date: (txn.transaction_date as string).split('T')[0],
            gallons: String(gallons),
            cost_per_gallon: String(costPerGallon),
            total_cost: String(totalCost),
            odometer: txn.odometer as number | null,
            location: txn.location_name as string | null,
            state: txn.state as string | null,
            notes: null,
            source: 'msfuelcard',
            source_external_id: txn.external_transaction_id as string,
          })
        // 23505 unique_violation is expected if the same transaction was
        // already materialized by a prior sync or match — swallow it.
        if (insertError && insertError.code !== '23505') {
          // Non-critical — log but don't fail the match UI flow.
          safeError({ message: insertError.message }, 'matchTransaction/fuel_entries_insert')
        }
      }
    }

    revalidatePath('/fuel-tracking')
    return { success: true }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'matchTransaction'
      ),
    }
  }
}

// ============================================================================
// flagTransaction — Manual anomaly flag
// ============================================================================

const flagSchema = z.object({
  transactionId: z.string().uuid(),
  reason: z.string().min(1, 'Reason is required').max(500),
})

export async function flagTransaction(data: unknown) {
  const parsed = flagSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('fuel.update', {
    rateLimit: { key: 'flagFuelTx', limit: 30, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    // Verify transaction belongs to this tenant
    const { data: txn, error: txnError } = await supabase
      .from('fuelcard_transactions')
      .select('id')
      .eq('id', parsed.data.transactionId)
      .eq('tenant_id', tenantId)
      .single()

    if (txnError || !txn) {
      return { error: 'Transaction not found.' }
    }

    const { error: updateError } = await supabase
      .from('fuelcard_transactions')
      .update({
        anomaly_flagged: true,
        anomaly_reason: parsed.data.reason,
      })
      .eq('id', txn.id)
      .eq('tenant_id', tenantId)

    if (updateError) {
      return { error: safeError(updateError, 'flagTransaction.update') }
    }

    logAuditEvent(supabase, {
      tenantId,
      entityType: 'fuelcard_transaction',
      entityId: txn.id,
      action: 'flagged',
      description: `Fuel card transaction flagged: ${parsed.data.reason}`,
      actorId: auth.ctx.user.id,
      actorEmail: auth.ctx.user.email,
    }).catch(captureAsyncError('fuelcard sync'))

    revalidatePath('/fuel-tracking')
    return { success: true }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'flagTransaction'
      ),
    }
  }
}

// ============================================================================
// unflagTransaction — Remove manual flag
// ============================================================================

const unflagSchema = z.object({
  transactionId: z.string().uuid(),
})

export async function unflagTransaction(data: unknown) {
  const parsed = unflagSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('fuel.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    const { error: updateError } = await supabase
      .from('fuelcard_transactions')
      .update({
        anomaly_flagged: false,
        anomaly_reason: null,
      })
      .eq('id', parsed.data.transactionId)
      .eq('tenant_id', tenantId)

    if (updateError) {
      return { error: safeError(updateError, 'unflagTransaction.update') }
    }

    revalidatePath('/fuel-tracking')
    return { success: true }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'unflagTransaction'
      ),
    }
  }
}
