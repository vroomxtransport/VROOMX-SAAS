// ============================================================================
// QuickBooks Sync Orchestration
// Maps VroomX entities to QuickBooks API calls.
// All functions are designed to be called fire-and-forget from server actions.
// ============================================================================

import { QuickBooksClient } from './client'
import type { QBSyncStatus, QBTokenResponse } from './types'
import type { SupabaseClient } from '@supabase/supabase-js'

// Payment terms → days mapping for QB DueDate calculation
const PAYMENT_TERMS_DAYS: Record<string, number> = {
  NET15: 15,
  NET30: 30,
  NET45: 45,
  NET60: 60,
}

// ============================================================================
// Helper: Get QB client for a tenant (fetch tokens, handle refresh)
// ============================================================================

export async function getQBClientForTenant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<QuickBooksClient | null> {
  const { data: integration, error } = await supabase
    .from('quickbooks_integrations')
    .select(
      'id, realm_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, sync_status'
    )
    .eq('tenant_id', tenantId)
    .single()

  if (error || !integration) return null

  const syncStatus = integration.sync_status as QBSyncStatus
  if (syncStatus === 'disconnected' || syncStatus === 'paused') return null

  const accessToken = integration.access_token_encrypted as string
  const realmId = integration.realm_id as string
  const refreshToken = integration.refresh_token_encrypted as string
  const integrationId = integration.id as string

  // Build client with automatic token refresh callback for 401 retries.
  // The QuickBooksClient handles 401 internally by calling onTokenRefresh,
  // which persists the rotated refresh token immediately (critical for QB).
  const client = new QuickBooksClient(realmId, accessToken, {
    refreshToken,
    onTokenRefresh: async (tokens: QBTokenResponse) => {
      const newExpiresAt = new Date(
        Date.now() + tokens.expires_in * 1000
      ).toISOString()

      await supabase
        .from('quickbooks_integrations')
        .update({
          access_token_encrypted: tokens.access_token,
          refresh_token_encrypted: tokens.refresh_token,
          token_expires_at: newExpiresAt,
        })
        .eq('id', integrationId)
        .eq('tenant_id', tenantId)
    },
  })

  return client
}

// ============================================================================
// Entity map helpers
// ============================================================================

/**
 * Fetch an existing QB entity mapping for (tenant, entity_type, vroomx_id).
 *
 * Note on the `qb_id: string` return type: post-Wave-5 the column is
 * nullable in the DB to represent failed sync attempts (qb_id NULL +
 * sync_error set). Callers in the broker / invoice / payment paths still
 * treat qb_id as a non-null string and that works at runtime because JS
 * truthiness on `null` is `false` — they all gate on `if (existing) { ... }`
 * which narrows correctly. The Wave 5 expense path is more explicit: it
 * checks `existing && existing.qb_id` to distinguish "synced" from "error".
 * Keeping the type as `string` here preserves compatibility with the
 * pre-existing callers; the expense path's truthy check is the only new
 * consumer that actually observes the null.
 */
async function getEntityMapping(
  supabase: SupabaseClient,
  tenantId: string,
  entityType: string,
  vroomxId: string
): Promise<{ qb_id: string; qb_sync_token: string | null } | null> {
  const { data } = await supabase
    .from('quickbooks_entity_map')
    .select('qb_id, qb_sync_token')
    .eq('tenant_id', tenantId)
    .eq('entity_type', entityType)
    .eq('vroomx_id', vroomxId)
    .maybeSingle()

  return data as { qb_id: string; qb_sync_token: string | null } | null
}

async function upsertEntityMapping(
  supabase: SupabaseClient,
  tenantId: string,
  entityType: string,
  vroomxId: string,
  qbId: string,
  qbSyncToken: string | null
): Promise<void> {
  await supabase
    .from('quickbooks_entity_map')
    .upsert(
      {
        tenant_id: tenantId,
        entity_type: entityType,
        vroomx_id: vroomxId,
        qb_id: qbId,
        qb_sync_token: qbSyncToken,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,entity_type,vroomx_id' }
    )
}

// ============================================================================
// syncBrokerToQB — Sync a broker as a QB Customer
// ============================================================================

export async function syncBrokerToQB(
  supabase: SupabaseClient,
  tenantId: string,
  brokerId: string
): Promise<void> {
  const client = await getQBClientForTenant(supabase, tenantId)
  if (!client) return

  // Fetch broker from DB
  const { data: broker, error: brokerError } = await supabase
    .from('brokers')
    .select('id, name, email, phone, address, city, state, zip')
    .eq('id', brokerId)
    .eq('tenant_id', tenantId)
    .single()

  if (brokerError || !broker) return

  // Check entity map for existing QB ID
  const existing = await getEntityMapping(supabase, tenantId, 'broker_customer', brokerId)

  if (existing) {
    // Update existing QB Customer — must fetch current SyncToken
    try {
      const currentCustomer = await client.getCustomer(existing.qb_id)
      const updated = await client.updateCustomer({
        Id: existing.qb_id,
        SyncToken: currentCustomer.SyncToken,
        DisplayName: broker.name,
        CompanyName: broker.name,
        PrimaryEmailAddr: broker.email ? { Address: broker.email } : undefined,
        PrimaryPhone: broker.phone ? { FreeFormNumber: broker.phone } : undefined,
        BillAddr: broker.address
          ? {
              Line1: broker.address,
              City: broker.city ?? undefined,
              CountrySubDivisionCode: broker.state ?? undefined,
              PostalCode: broker.zip ?? undefined,
            }
          : undefined,
      })
      await upsertEntityMapping(
        supabase, tenantId, 'broker_customer', brokerId,
        updated.Id, updated.SyncToken
      )
    } catch (err) {
      console.error('[QB sync] Failed to update customer:', err instanceof Error ? err.message : err)
    }
    return
  }

  // New broker — try to find by name first, otherwise create
  try {
    const existingCustomer = await client.findCustomerByName(broker.name)

    if (existingCustomer) {
      // Link to existing QB customer
      await upsertEntityMapping(
        supabase, tenantId, 'broker_customer', brokerId,
        existingCustomer.Id, existingCustomer.SyncToken
      )
      return
    }

    // Create new QB Customer
    const created = await client.createCustomer({
      DisplayName: broker.name,
      CompanyName: broker.name,
      PrimaryEmailAddr: broker.email ? { Address: broker.email } : undefined,
      PrimaryPhone: broker.phone ? { FreeFormNumber: broker.phone } : undefined,
      BillAddr: broker.address
        ? {
            Line1: broker.address,
            City: broker.city ?? undefined,
            CountrySubDivisionCode: broker.state ?? undefined,
            PostalCode: broker.zip ?? undefined,
          }
        : undefined,
    })

    await upsertEntityMapping(
      supabase, tenantId, 'broker_customer', brokerId,
      created.Id, created.SyncToken
    )
  } catch (err) {
    console.error('[QB sync] Failed to sync broker as customer:', err instanceof Error ? err.message : err)
  }
}

// ============================================================================
// syncInvoiceToQB — Sync an invoiced order as a QB Invoice
// ============================================================================

export async function syncInvoiceToQB(
  supabase: SupabaseClient,
  tenantId: string,
  orderId: string
): Promise<void> {
  const client = await getQBClientForTenant(supabase, tenantId)
  if (!client) return

  // Fetch order with broker relation
  interface OrderForInvoice {
    id: string
    order_number: string | null
    carrier_pay: string
    billing_amount: string | null
    payment_type: string | null
    broker_id: string | null
    vehicle_year: number | null
    vehicle_make: string | null
    vehicle_model: string | null
    vehicles: Array<{ year?: number; make?: string; model?: string }> | null
    pickup_city: string | null
    pickup_state: string | null
    delivery_city: string | null
    delivery_state: string | null
    broker: { id: string; name: string; payment_terms: string | null } | null
  }

  const { data: rawOrder, error: orderError } = await supabase
    .from('orders')
    .select(
      'id, order_number, carrier_pay, billing_amount, payment_type, broker_id, ' +
      'vehicle_year, vehicle_make, vehicle_model, vehicles, ' +
      'pickup_city, pickup_state, delivery_city, delivery_state, ' +
      'broker:brokers(id, name, payment_terms)'
    )
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .single()

  if (orderError || !rawOrder) return
  const order = rawOrder as unknown as OrderForInvoice
  if (!order.broker_id) return

  // Ensure broker is synced as QB Customer first
  const brokerMapping = await getEntityMapping(supabase, tenantId, 'broker_customer', order.broker_id)
  if (!brokerMapping) {
    await syncBrokerToQB(supabase, tenantId, order.broker_id)
  }

  // Re-fetch mapping after potential sync
  const customerMapping = await getEntityMapping(supabase, tenantId, 'broker_customer', order.broker_id)
  if (!customerMapping) return // Broker sync failed

  // Check if invoice already synced
  const existingInvoice = await getEntityMapping(supabase, tenantId, 'order_invoice', orderId)
  if (existingInvoice) return // Already synced

  try {
    // Determine billing amount: for SPLIT orders use billing_amount, otherwise carrier_pay
    const isSplit = order.payment_type === 'SPLIT' && order.billing_amount !== null
    const invoiceAmount = parseFloat(
      isSplit ? (order.billing_amount as string) : (order.carrier_pay as string)
    )

    // Build vehicle description
    const vehicleDesc = order.vehicles && Array.isArray(order.vehicles) && order.vehicles.length > 0
      ? order.vehicles
          .map((v) => `${v.year ?? ''} ${v.make ?? ''} ${v.model ?? ''}`.trim())
          .join(', ')
      : `${order.vehicle_year ?? ''} ${order.vehicle_make ?? ''} ${order.vehicle_model ?? ''}`.trim()

    // Build route description
    const route = [
      order.pickup_city && order.pickup_state
        ? `${order.pickup_city}, ${order.pickup_state}`
        : null,
      order.delivery_city && order.delivery_state
        ? `${order.delivery_city}, ${order.delivery_state}`
        : null,
    ]
      .filter(Boolean)
      .join(' → ')

    const lineDescription = [vehicleDesc, route].filter(Boolean).join(' | ')

    // Calculate due date from broker payment terms
    const termsDays = order.broker?.payment_terms
      ? (PAYMENT_TERMS_DAYS[order.broker.payment_terms] ?? 30)
      : 30

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + termsDays)
    const dueDateStr = dueDate.toISOString().split('T')[0]

    const created = await client.createInvoice({
      CustomerRef: { value: customerMapping.qb_id },
      DocNumber: order.order_number ?? undefined,
      DueDate: dueDateStr,
      TxnDate: new Date().toISOString().split('T')[0],
      Line: [
        {
          Amount: invoiceAmount,
          DetailType: 'SalesItemLineDetail',
          Description: lineDescription || 'Vehicle transport service',
          SalesItemLineDetail: {
            Qty: 1,
            UnitPrice: invoiceAmount,
          },
        },
      ],
      CustomerMemo: order.order_number
        ? { value: `VroomX Order #${order.order_number}` }
        : undefined,
    })

    await upsertEntityMapping(
      supabase, tenantId, 'order_invoice', orderId,
      created.Id, created.SyncToken
    )
  } catch (err) {
    console.error('[QB sync] Failed to sync invoice:', err instanceof Error ? err.message : err)
  }
}

// ============================================================================
// syncPaymentToQB — Sync a payment to QB, linked to its invoice
// ============================================================================

export async function syncPaymentToQB(
  supabase: SupabaseClient,
  tenantId: string,
  orderId: string,
  amount: number,
  paymentDate: string
): Promise<void> {
  const client = await getQBClientForTenant(supabase, tenantId)
  if (!client) return

  // Look up QB Invoice ID from entity map
  const invoiceMapping = await getEntityMapping(supabase, tenantId, 'order_invoice', orderId)
  if (!invoiceMapping) return // Invoice not synced to QB, skip

  // Look up broker → QB Customer ID
  const { data: orderRow } = await supabase
    .from('orders')
    .select('broker_id')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .single()

  const brokerId = (orderRow as { broker_id: string | null } | null)?.broker_id
  if (!brokerId) return

  const customerMapping = await getEntityMapping(supabase, tenantId, 'broker_customer', brokerId)
  if (!customerMapping) return

  try {
    await client.createPayment({
      CustomerRef: { value: customerMapping.qb_id },
      TotalAmt: amount,
      TxnDate: paymentDate,
      Line: [
        {
          Amount: amount,
          LinkedTxn: [
            {
              TxnId: invoiceMapping.qb_id,
              TxnType: 'Invoice',
            },
          ],
        },
      ],
    })
    // No entity_map needed for payments — idempotency handled by amount + date + invoice ref
  } catch (err) {
    console.error('[QB sync] Failed to sync payment:', err instanceof Error ? err.message : err)
  }
}

// ============================================================================
// syncExpenseToQB — Sync any expense (trip / business / fuel / maintenance)
// as a QuickBooks Purchase
// ============================================================================

/**
 * Source type that determines which table the expense id belongs to, and
 * which `entity_type` to use in `quickbooks_entity_map` for dedup/retry.
 *
 * Kept narrow so the retry action can map source → table without
 * re-scanning every expense table in the database.
 */
export type QBExpenseSource = 'trip' | 'business' | 'fuel' | 'maintenance'

function sourceToEntityType(source: QBExpenseSource): string {
  switch (source) {
    case 'trip':
      return 'expense_trip'
    case 'business':
      return 'expense_business'
    case 'fuel':
      return 'expense_fuel'
    case 'maintenance':
      return 'expense_maintenance'
  }
}

function sourceToTableName(source: QBExpenseSource): string {
  switch (source) {
    case 'trip':
      return 'trip_expenses'
    case 'business':
      return 'business_expenses'
    case 'fuel':
      return 'fuel_entries'
    case 'maintenance':
      return 'maintenance_records'
  }
}

/**
 * Extract a QB Purchase payload from a source row. Each source table has
 * a different shape (date column, category, description, amount field),
 * so adapting happens here at the boundary.
 */
interface QBExpensePayload {
  amount: number
  description: string
  txnDate: string
}

function buildPayloadForSource(
  source: QBExpenseSource,
  row: Record<string, unknown>,
): QBExpensePayload | null {
  const today = new Date().toISOString().split('T')[0]

  switch (source) {
    case 'trip': {
      const amount = parseFloat((row.amount as string) ?? '0')
      if (!(amount > 0)) return null
      const category = (row.category as string) ?? 'misc'
      const notes = (row.notes as string | null) ?? ''
      return {
        amount,
        description: `Trip expense: ${category}${notes ? ` - ${notes}` : ''}`,
        txnDate: ((row.expense_date as string | null) ?? today).slice(0, 10),
      }
    }
    case 'business': {
      const amount = parseFloat((row.amount as string) ?? '0')
      if (!(amount > 0)) return null
      const name = (row.name as string | null) ?? (row.category as string | null) ?? 'business'
      const notes = (row.notes as string | null) ?? ''
      return {
        amount,
        description: `Business expense: ${name}${notes ? ` - ${notes}` : ''}`,
        txnDate: ((row.effective_from as string | null) ?? today).slice(0, 10),
      }
    }
    case 'fuel': {
      const amount = parseFloat((row.total_cost as string) ?? '0')
      if (!(amount > 0)) return null
      const location = (row.location as string | null) ?? 'Fuel purchase'
      const state = (row.state as string | null) ?? ''
      const gallons = parseFloat((row.gallons as string) ?? '0')
      return {
        amount,
        description: `Fuel: ${location}${state ? `, ${state}` : ''} (${gallons.toFixed(2)} gal)`,
        txnDate: ((row.date as string | null) ?? today).slice(0, 10),
      }
    }
    case 'maintenance': {
      const amount = parseFloat((row.cost as string) ?? '0')
      if (!(amount > 0)) return null
      const type = (row.maintenance_type as string | null) ?? 'maintenance'
      const vendor = (row.vendor as string | null) ?? ''
      const description = (row.description as string | null) ?? ''
      const label = description || `${type}${vendor ? ` at ${vendor}` : ''}`
      const completedDate = row.completed_date as string | null
      return {
        amount,
        description: `Maintenance: ${label}`,
        txnDate: (completedDate ?? today).slice(0, 10),
      }
    }
  }
}

/**
 * Sanitize a QuickBooks API error message before storing or surfacing
 * it to the UI. QB `Detail` fields frequently include:
 *   - request payload echoes (account names, amounts, customer ids)
 *   - OAuth refresh errors that may contain token fragments
 *   - stack traces with internal paths
 *
 * We keep the status code, the short `Message`, and drop everything
 * after the first colon/semicolon/newline. Truncates to 120 chars.
 * The goal is a useful hint for the operator without leaking PII or
 * secrets to lower-privilege users who can see the ledger.
 */
function sanitizeQBErrorMessage(raw: string): string {
  const oneLine = raw.split(/[\r\n]/)[0] ?? raw
  const trimmed = oneLine.split(/[:;]/)[0]?.trim() ?? oneLine
  return trimmed.slice(0, 120)
}

/**
 * Record (or clear) a durable error state in quickbooks_entity_map so the
 * ledger UI can surface a Retry button. Safe to call repeatedly — upserts
 * on the unique constraint.
 *
 * The stored error is sanitized (QB detail fields can include customer
 * data + token fragments) and truncated to 120 chars.
 */
async function recordQBExpenseError(
  supabase: SupabaseClient,
  tenantId: string,
  entityType: string,
  expenseId: string,
  errorMessage: string,
): Promise<void> {
  await supabase
    .from('quickbooks_entity_map')
    .upsert(
      {
        tenant_id: tenantId,
        entity_type: entityType,
        vroomx_id: expenseId,
        qb_id: null,
        qb_sync_token: null,
        last_synced_at: new Date().toISOString(),
        sync_error: sanitizeQBErrorMessage(errorMessage),
      },
      { onConflict: 'tenant_id,entity_type,vroomx_id' },
    )
}

/**
 * Push a VroomX expense (trip / business / fuel / maintenance) to
 * QuickBooks as a Purchase. Fire-and-forget: caller does NOT await the
 * result; errors are recorded durably in quickbooks_entity_map so the
 * UI can retry.
 *
 * No-ops safely if:
 *   - QB integration is not connected / disconnected / paused
 *   - No expense_account_id is configured on the integration
 *   - A successful sync already exists (qb_id is NOT NULL)
 *   - The expense row can't be found
 *   - The expense amount is zero or negative
 *
 * Re-runs on a row currently in error state (qb_id IS NULL): retries the
 * push and clears the error on success or refreshes the error message on
 * another failure.
 */
export async function syncExpenseToQB(
  supabase: SupabaseClient,
  tenantId: string,
  expenseId: string,
  expenseSource: QBExpenseSource,
): Promise<void> {
  const entityType = sourceToEntityType(expenseSource)

  // Short-circuit if already successfully synced (qb_id is NOT NULL).
  // A row with qb_id NULL is an error state — fall through and retry.
  const existing = await getEntityMapping(supabase, tenantId, entityType, expenseId)
  if (existing && existing.qb_id) return

  const client = await getQBClientForTenant(supabase, tenantId)
  if (!client) return // Not connected — silent no-op, not an error

  // Fetch integration config for expense account mapping
  const { data: integration } = await supabase
    .from('quickbooks_integrations')
    .select('expense_account_id')
    .eq('tenant_id', tenantId)
    .single()

  if (!integration?.expense_account_id) return // No expense account configured

  // Fetch the source row
  const tableName = sourceToTableName(expenseSource)
  const { data: expense, error: expenseError } = await supabase
    .from(tableName)
    .select('*')
    .eq('id', expenseId)
    .eq('tenant_id', tenantId)
    .single()

  if (expenseError || !expense) return // Row missing — nothing to sync

  const payload = buildPayloadForSource(expenseSource, expense as Record<string, unknown>)
  if (!payload) return // Zero-amount row — nothing to sync

  try {
    const created = await client.createPurchase({
      AccountRef: { value: integration.expense_account_id as string },
      PaymentType: 'Cash',
      TxnDate: payload.txnDate,
      Line: [
        {
          Amount: payload.amount,
          DetailType: 'AccountBasedExpenseLineDetail',
          Description: payload.description,
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: integration.expense_account_id as string },
          },
        },
      ],
      PrivateNote: `VroomX ${expenseSource} expense: ${expenseId}`,
    })

    // Success: upsert with qb_id set + sync_error cleared. Upsert handles
    // the retry case where an error row already exists.
    await supabase
      .from('quickbooks_entity_map')
      .upsert(
        {
          tenant_id: tenantId,
          entity_type: entityType,
          vroomx_id: expenseId,
          qb_id: created.Id,
          qb_sync_token: created.SyncToken,
          last_synced_at: new Date().toISOString(),
          sync_error: null,
        },
        { onConflict: 'tenant_id,entity_type,vroomx_id' },
      )
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : 'Unknown QB sync error'
    // Sanitize BEFORE logging — QB Detail fields can contain customer
    // data, account numbers, and token fragments. The server-log path
    // reaches Sentry / Netlify logs and was previously unsanitized.
    const safeMessage = sanitizeQBErrorMessage(rawMessage)
    console.error(
      `[QB sync] Failed to sync ${expenseSource} expense ${expenseId}: ${safeMessage}`,
    )
    await recordQBExpenseError(supabase, tenantId, entityType, expenseId, rawMessage)
  }
}

// ============================================================================
// syncPaymentFromQB — Handle incoming QB webhook payment
// ============================================================================

export async function syncPaymentFromQB(
  supabase: SupabaseClient,
  tenantId: string,
  qbInvoiceId: string,
  amount: number
): Promise<void> {
  // Look up VroomX order from entity map (by qb_id where entity_type='order_invoice')
  const { data: mapping } = await supabase
    .from('quickbooks_entity_map')
    .select('vroomx_id')
    .eq('tenant_id', tenantId)
    .eq('entity_type', 'order_invoice')
    .eq('qb_id', qbInvoiceId)
    .maybeSingle()

  if (!mapping) return // No matching VroomX order

  const orderId = mapping.vroomx_id as string

  // Fetch order to check current payment status
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('carrier_pay, amount_paid, payment_status')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .single()

  if (orderError || !order) return

  const carrierPay = parseFloat(order.carrier_pay as string)
  const currentPaid = parseFloat(order.amount_paid as string)

  // Don't record if already fully paid
  if (order.payment_status === 'paid') return

  // Insert payment record
  const { error: insertError } = await supabase
    .from('payments')
    .insert({
      tenant_id: tenantId,
      order_id: orderId,
      amount: String(amount),
      payment_date: new Date().toISOString().split('T')[0],
      notes: 'Synced from QuickBooks',
    })

  if (insertError) {
    console.error('[QB sync] Failed to record payment from QB:', insertError.message)
    return
  }

  // Update order payment status
  const newTotalPaid = currentPaid + amount
  let newPaymentStatus: string
  if (Math.abs(carrierPay - newTotalPaid) < 0.01 || newTotalPaid >= carrierPay) {
    newPaymentStatus = 'paid'
  } else if (newTotalPaid > 0) {
    newPaymentStatus = 'partially_paid'
  } else {
    newPaymentStatus = order.payment_status as string
  }

  await supabase
    .from('orders')
    .update({
      amount_paid: String(Math.round(newTotalPaid * 100) / 100),
      payment_status: newPaymentStatus,
    })
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
}
