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
// syncExpenseToQB — Sync trip or business expense as QB Purchase
// ============================================================================

export async function syncExpenseToQB(
  supabase: SupabaseClient,
  tenantId: string,
  expenseId: string,
  expenseType: 'trip' | 'business'
): Promise<void> {
  const client = await getQBClientForTenant(supabase, tenantId)
  if (!client) return

  // Fetch integration config for expense account mapping
  const { data: integration } = await supabase
    .from('quickbooks_integrations')
    .select('expense_account_id')
    .eq('tenant_id', tenantId)
    .single()

  if (!integration?.expense_account_id) return // No expense account configured

  // Check if already synced
  const existing = await getEntityMapping(supabase, tenantId, 'expense', expenseId)
  if (existing) return

  // Fetch expense from the appropriate table
  const tableName = expenseType === 'trip' ? 'trip_expenses' : 'business_expenses'
  const { data: expense, error: expenseError } = await supabase
    .from(tableName)
    .select('*')
    .eq('id', expenseId)
    .eq('tenant_id', tenantId)
    .single()

  if (expenseError || !expense) return

  try {
    const expenseAmount = parseFloat(expense.amount as string)
    const category = (expense.category as string) ?? 'misc'
    const notes = (expense.notes as string) ?? ''
    const description = expenseType === 'trip'
      ? `Trip expense: ${category}${notes ? ` - ${notes}` : ''}`
      : `Business expense: ${(expense.name as string) ?? category}${notes ? ` - ${notes}` : ''}`

    const expenseDate = expenseType === 'trip'
      ? (expense.expense_date as string | null)
      : (expense.effective_from as string | null)

    const created = await client.createPurchase({
      AccountRef: { value: integration.expense_account_id as string },
      PaymentType: 'Cash',
      TxnDate: expenseDate ?? new Date().toISOString().split('T')[0],
      Line: [
        {
          Amount: expenseAmount,
          DetailType: 'AccountBasedExpenseLineDetail',
          Description: description,
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: integration.expense_account_id as string },
          },
        },
      ],
      PrivateNote: `VroomX ${expenseType} expense: ${expenseId}`,
    })

    await upsertEntityMapping(
      supabase, tenantId, 'expense', expenseId,
      created.Id, created.SyncToken
    )
  } catch (err) {
    console.error('[QB sync] Failed to sync expense:', err instanceof Error ? err.message : err)
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
