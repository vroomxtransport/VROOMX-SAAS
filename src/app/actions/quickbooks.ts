'use server'

import { z } from 'zod'
import { authorize, safeError } from '@/lib/authz'
import { logAuditEvent } from '@/lib/audit-log'
import { issueNonce } from '@/lib/oauth-nonce'
import { revalidatePath } from 'next/cache'
import { getQuickBooksAuthUrl } from '@/lib/quickbooks/oauth'
import {
  getQBClientForTenant,
  syncBrokerToQB,
  syncInvoiceToQB,
} from '@/lib/quickbooks/sync'
import type { QBSyncStatus } from '@/lib/quickbooks/types'
import crypto from 'crypto'
import { captureAsyncError } from '@/lib/async-safe'

// ============================================================================
// Types for UI consumption
// ============================================================================

export interface QuickBooksStatusData {
  connected: boolean
  realmId: string | null
  lastSync: string | null
  syncStatus: QBSyncStatus
  syncError: string | null
  invoicesSynced: number
  brokersSynced: number
  paymentsSynced: number
  expensesSynced: number
  incomeAccountId: string | null
  expenseAccountId: string | null
}

export interface QBAccountOption {
  id: string
  name: string
  accountType: string
  accountSubType: string
}

// ============================================================================
// connectQuickBooks — Generate OAuth URL
// ============================================================================

export async function connectQuickBooks() {
  const auth = await authorize('integrations.manage', {
    rateLimit: { key: 'connectQuickBooks', limit: 5, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    const nonce = crypto.randomBytes(16).toString('hex')

    // L3 fix: persist the nonce server-side BEFORE redirecting the user
    // to Intuit. The callback will validate that the nonce came from a
    // real OAuth initiation we issued (and hasn't been replayed). If
    // issueNonce throws (e.g. oauth_nonces table missing), we abort the
    // flow rather than starting an unverifiable OAuth handshake.
    await issueNonce(nonce, tenantId, 'quickbooks')

    const statePayload = Buffer.from(
      JSON.stringify({ tenantId, nonce })
    ).toString('base64url')

    const authUrl = getQuickBooksAuthUrl(statePayload)

    logAuditEvent(supabase, {
      tenantId,
      entityType: 'integration',
      entityId: 'quickbooks',
      action: 'oauth_initiated',
      description: 'QuickBooks OAuth connection initiated',
      actorId: auth.ctx.user.id,
      actorEmail: auth.ctx.user.email,
    }).catch(captureAsyncError('QB sync'))

    return { success: true, data: { authUrl, state: statePayload } }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'connectQuickBooks'
      ),
    }
  }
}

// ============================================================================
// disconnectQuickBooks — Revoke + delete integration record
// ============================================================================

export async function disconnectQuickBooks() {
  const auth = await authorize('integrations.manage', {
    rateLimit: { key: 'disconnectQuickBooks', limit: 5, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    const { data: integration, error: fetchError } = await supabase
      .from('quickbooks_integrations')
      .select('id')
      .eq('tenant_id', tenantId)
      .single()

    if (fetchError || !integration) {
      return { error: 'QuickBooks integration not found.' }
    }

    // Delete the integration record but keep entity_map for re-linking
    const { error: deleteError } = await supabase
      .from('quickbooks_integrations')
      .delete()
      .eq('id', integration.id)
      .eq('tenant_id', tenantId)

    if (deleteError) {
      return { error: safeError(deleteError, 'disconnectQuickBooks.delete') }
    }

    logAuditEvent(supabase, {
      tenantId,
      entityType: 'integration',
      entityId: 'quickbooks',
      action: 'disconnected',
      description: 'QuickBooks integration disconnected (entity mappings preserved)',
      actorId: auth.ctx.user.id,
      actorEmail: auth.ctx.user.email,
    }).catch(captureAsyncError('QB sync'))

    revalidatePath('/settings')
    revalidatePath('/settings/integrations')
    return { success: true }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'disconnectQuickBooks'
      ),
    }
  }
}

// ============================================================================
// getQuickBooksStatus — For settings UI
// ============================================================================

export async function getQuickBooksStatus(): Promise<
  { success: true; data: QuickBooksStatusData } | { error: string }
> {
  const auth = await authorize('integrations.view')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    const { data: integration } = await supabase
      .from('quickbooks_integrations')
      .select('realm_id, sync_status, last_sync_at, last_error, income_account_id, expense_account_id')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!integration) {
      return {
        success: true,
        data: {
          connected: false,
          realmId: null,
          lastSync: null,
          syncStatus: 'disconnected',
          syncError: null,
          invoicesSynced: 0,
          brokersSynced: 0,
          paymentsSynced: 0,
          expensesSynced: 0,
          incomeAccountId: null,
          expenseAccountId: null,
        },
      }
    }

    // Count entity map records by type
    const [brokersCount, invoicesCount, expensesCount] = await Promise.all([
      supabase
        .from('quickbooks_entity_map')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('entity_type', 'broker_customer'),
      supabase
        .from('quickbooks_entity_map')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('entity_type', 'order_invoice'),
      supabase
        .from('quickbooks_entity_map')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('entity_type', 'expense'),
    ])

    return {
      success: true,
      data: {
        connected: (integration.sync_status as string) !== 'disconnected',
        realmId: integration.realm_id as string | null,
        lastSync: integration.last_sync_at as string | null,
        syncStatus: integration.sync_status as QBSyncStatus,
        syncError: integration.last_error as string | null,
        invoicesSynced: invoicesCount.count ?? 0,
        brokersSynced: brokersCount.count ?? 0,
        paymentsSynced: 0, // Payments don't have entity_map entries
        expensesSynced: expensesCount.count ?? 0,
        incomeAccountId: integration.income_account_id as string | null,
        expenseAccountId: integration.expense_account_id as string | null,
      },
    }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'getQuickBooksStatus'
      ),
    }
  }
}

// ============================================================================
// getQuickBooksAccounts — Fetch chart of accounts for mapping
// ============================================================================

export async function getQuickBooksAccounts(): Promise<
  { success: true; data: QBAccountOption[] } | { error: string }
> {
  const auth = await authorize('integrations.manage')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    const client = await getQBClientForTenant(supabase, tenantId)
    if (!client) {
      return { error: 'QuickBooks not connected. Please connect your account first.' }
    }

    const accounts = await client.getAccounts()

    // Filter to Income + Expense account types
    const filtered: QBAccountOption[] = accounts
      .filter((a) => {
        const type = a.AccountType ?? ''
        return (
          type === 'Income' ||
          type === 'Other Income' ||
          type === 'Expense' ||
          type === 'Other Expense' ||
          type === 'Cost of Goods Sold'
        )
      })
      .filter((a) => a.Active !== false)
      .map((a) => ({
        id: a.Id,
        name: a.FullyQualifiedName ?? a.Name,
        accountType: a.AccountType,
        accountSubType: a.AccountSubType,
      }))

    return { success: true, data: filtered }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'getQuickBooksAccounts'
      ),
    }
  }
}

// ============================================================================
// setQuickBooksAccounts — Save account mapping configuration
// ============================================================================

const setAccountsSchema = z.object({
  incomeAccountId: z.string().min(1, 'Income account is required'),
  expenseAccountId: z.string().min(1, 'Expense account is required'),
})

export async function setQuickBooksAccounts(data: unknown) {
  const parsed = setAccountsSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('integrations.manage', {
    rateLimit: { key: 'setQBAccounts', limit: 10, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error: updateError } = await supabase
    .from('quickbooks_integrations')
    .update({
      income_account_id: parsed.data.incomeAccountId,
      expense_account_id: parsed.data.expenseAccountId,
    })
    .eq('tenant_id', tenantId)

  if (updateError) {
    return { error: safeError(updateError, 'setQuickBooksAccounts') }
  }

  logAuditEvent(supabase, {
    tenantId,
    entityType: 'integration',
    entityId: 'quickbooks',
    action: 'accounts_configured',
    description: 'QuickBooks account mapping updated',
    actorId: auth.ctx.user.id,
    actorEmail: auth.ctx.user.email,
    metadata: {
      incomeAccountId: parsed.data.incomeAccountId,
      expenseAccountId: parsed.data.expenseAccountId,
    },
  }).catch(captureAsyncError('QB sync'))

  revalidatePath('/settings/integrations')
  return { success: true }
}

// ============================================================================
// syncAllBrokers — Bulk sync all brokers to QB
// ============================================================================

export async function syncAllBrokers() {
  const auth = await authorize('integrations.manage', {
    rateLimit: { key: 'syncAllBrokers', limit: 2, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    const { data: brokers, error: brokersError } = await supabase
      .from('brokers')
      .select('id')
      .eq('tenant_id', tenantId)

    if (brokersError || !brokers) {
      return { error: safeError(brokersError ?? { message: 'Failed to fetch brokers' }, 'syncAllBrokers') }
    }

    let synced = 0
    for (const broker of brokers) {
      try {
        await syncBrokerToQB(supabase, tenantId, broker.id)
        synced++
      } catch {
        // Continue on individual failures — fire-and-forget per broker
      }
    }

    logAuditEvent(supabase, {
      tenantId,
      entityType: 'integration',
      entityId: 'quickbooks',
      action: 'bulk_broker_sync',
      description: `Synced ${synced}/${brokers.length} brokers to QuickBooks`,
      actorId: auth.ctx.user.id,
      actorEmail: auth.ctx.user.email,
    }).catch(captureAsyncError('QB sync'))

    revalidatePath('/settings/integrations')
    return { success: true, data: { synced, total: brokers.length } }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'syncAllBrokers'
      ),
    }
  }
}

// ============================================================================
// syncAllInvoices — Bulk sync unsynced invoiced orders to QB
// ============================================================================

export async function syncAllInvoices() {
  const auth = await authorize('integrations.manage', {
    rateLimit: { key: 'syncAllInvoices', limit: 2, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    // Fetch invoiced/partially_paid/paid orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('payment_status', ['invoiced', 'partially_paid', 'paid'])

    if (ordersError || !orders) {
      return { error: safeError(ordersError ?? { message: 'Failed to fetch orders' }, 'syncAllInvoices') }
    }

    // Get already-synced order IDs
    const { data: existingMappings } = await supabase
      .from('quickbooks_entity_map')
      .select('vroomx_id')
      .eq('tenant_id', tenantId)
      .eq('entity_type', 'order_invoice')

    const syncedIds = new Set((existingMappings ?? []).map((m) => m.vroomx_id as string))
    const unsyncedOrders = orders.filter((o) => !syncedIds.has(o.id))

    let synced = 0
    for (const order of unsyncedOrders) {
      try {
        await syncInvoiceToQB(supabase, tenantId, order.id)
        synced++
      } catch {
        // Continue on individual failures
      }
    }

    logAuditEvent(supabase, {
      tenantId,
      entityType: 'integration',
      entityId: 'quickbooks',
      action: 'bulk_invoice_sync',
      description: `Synced ${synced}/${unsyncedOrders.length} invoices to QuickBooks`,
      actorId: auth.ctx.user.id,
      actorEmail: auth.ctx.user.email,
    }).catch(captureAsyncError('QB sync'))

    revalidatePath('/settings/integrations')
    return { success: true, data: { synced, total: unsyncedOrders.length } }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'syncAllInvoices'
      ),
    }
  }
}

// ============================================================================
// triggerFullSync — Sync all brokers then all invoices
// ============================================================================

export async function triggerFullSync() {
  const auth = await authorize('integrations.manage', {
    rateLimit: { key: 'triggerFullSync', limit: 1, windowMs: 300_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  try {
    // Sync brokers first (invoices depend on customers existing)
    const brokersResult = await syncAllBrokers()
    const invoicesResult = await syncAllInvoices()

    // Update last_sync_at
    await supabase
      .from('quickbooks_integrations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)

    logAuditEvent(supabase, {
      tenantId,
      entityType: 'integration',
      entityId: 'quickbooks',
      action: 'full_sync',
      description: 'Full QuickBooks sync completed',
      actorId: auth.ctx.user.id,
      actorEmail: auth.ctx.user.email,
      metadata: {
        brokers: 'success' in brokersResult ? brokersResult : null,
        invoices: 'success' in invoicesResult ? invoicesResult : null,
      },
    }).catch(captureAsyncError('QB sync'))

    revalidatePath('/settings/integrations')
    return { success: true }
  } catch (err) {
    return {
      error: safeError(
        { message: err instanceof Error ? err.message : 'Unknown error' },
        'triggerFullSync'
      ),
    }
  }
}
