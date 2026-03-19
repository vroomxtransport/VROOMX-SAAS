'use server'

import { authorize, safeError } from '@/lib/authz'
import {
  dispatcherPayConfigSchema,
  generatePayrollPeriodSchema,
  batchGeneratePayrollSchema,
} from '@/lib/validations/dispatcher-payroll'
import { calculateDispatcherPay, type DispatcherOrderFinancials, type DispatcherPayConfig } from '@/lib/financial/dispatcher-calculations'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Pay Config Actions
// ============================================================================

export async function createDispatcherPayConfig(data: unknown) {
  const parsed = dispatcherPayConfigSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('dispatcher_payroll.create', {
    rateLimit: { key: 'createDispatcherPayConfig', limit: 20, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const v = parsed.data

  // Close out any existing active config for this dispatcher
  const { error: closeError } = await supabase
    .from('dispatcher_pay_configs')
    .update({
      effective_to: v.effectiveFrom,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('user_id', v.userId)
    .is('effective_to', null)

  if (closeError) {
    return { error: safeError(closeError, 'closeOldPayConfig') }
  }

  const { data: config, error } = await supabase
    .from('dispatcher_pay_configs')
    .insert({
      tenant_id: tenantId,
      user_id: v.userId,
      pay_type: v.payType,
      pay_rate: String(v.payRate),
      pay_frequency: v.payFrequency,
      effective_from: v.effectiveFrom,
      effective_to: v.effectiveTo || null,
      notes: v.notes || null,
    })
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'createDispatcherPayConfig') }
  }

  revalidatePath('/dispatchers')
  revalidatePath('/payroll')
  return { success: true, data: config }
}

export async function updateDispatcherPayConfig(id: string, data: unknown) {
  const parsed = dispatcherPayConfigSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('dispatcher_payroll.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const v = parsed.data

  const { data: config, error } = await supabase
    .from('dispatcher_pay_configs')
    .update({
      pay_type: v.payType,
      pay_rate: String(v.payRate),
      pay_frequency: v.payFrequency,
      effective_from: v.effectiveFrom,
      effective_to: v.effectiveTo || null,
      notes: v.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'updateDispatcherPayConfig') }
  }

  revalidatePath('/dispatchers')
  revalidatePath('/payroll')
  return { success: true, data: config }
}

// ============================================================================
// Payroll Period Actions
// ============================================================================

async function generateSinglePeriod(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  periodStart: string,
  periodEnd: string,
): Promise<{ success: true; data: Record<string, unknown> } | { error: string }> {
  // Fetch active pay config for this dispatcher
  const { data: payConfig, error: configError } = await supabase
    .from('dispatcher_pay_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .is('effective_to', null)
    .order('effective_from', { ascending: false })
    .limit(1)
    .single()

  if (configError || !payConfig) {
    return { error: 'No active pay configuration found for this dispatcher.' }
  }

  // Check for overlapping periods
  const { data: existing } = await supabase
    .from('dispatcher_payroll_periods')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .lte('period_start', periodEnd)
    .gte('period_end', periodStart)
    .limit(1)

  if (existing && existing.length > 0) {
    return { error: 'A payroll period already exists that overlaps with the selected dates.' }
  }

  // Fetch orders dispatched by this user in the period
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('revenue, broker_fee, local_fee')
    .eq('tenant_id', tenantId)
    .eq('dispatched_by', userId)
    .gte('created_at', `${periodStart}T00:00:00Z`)
    .lte('created_at', `${periodEnd}T23:59:59Z`)
    .neq('status', 'cancelled')

  if (ordersError) {
    return { error: 'Failed to fetch orders for payroll calculation.' }
  }

  const orderFinancials: DispatcherOrderFinancials[] = (orders ?? []).map(
    (o: Record<string, string>) => ({
      revenue: parseFloat(o.revenue || '0'),
      brokerFee: parseFloat(o.broker_fee || '0'),
      localFee: parseFloat(o.local_fee || '0'),
    })
  )

  const config: DispatcherPayConfig = {
    payType: payConfig.pay_type,
    payRate: parseFloat(payConfig.pay_rate),
    payFrequency: payConfig.pay_frequency,
  }

  const result = calculateDispatcherPay(config, orderFinancials)

  const { data: period, error: insertError } = await supabase
    .from('dispatcher_payroll_periods')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      period_start: periodStart,
      period_end: periodEnd,
      pay_type: payConfig.pay_type,
      pay_rate: String(parseFloat(payConfig.pay_rate)),
      base_amount: String(result.baseAmount),
      performance_amount: String(result.performanceAmount),
      total_amount: String(result.totalAmount),
      order_count: result.orderCount,
      total_order_revenue: String(result.totalOrderRevenue),
      status: 'draft',
    })
    .select()
    .single()

  if (insertError) {
    return { error: 'Failed to create payroll period.' }
  }

  return { success: true, data: period }
}

export async function generatePayrollPeriod(data: unknown) {
  const parsed = generatePayrollPeriodSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('dispatcher_payroll.create', {
    rateLimit: { key: 'generatePayroll', limit: 10, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const result = await generateSinglePeriod(
    supabase,
    tenantId,
    parsed.data.userId,
    parsed.data.periodStart,
    parsed.data.periodEnd,
  )

  if ('error' in result) return result

  revalidatePath('/payroll')
  return result
}

export async function batchGeneratePayroll(data: unknown) {
  const parsed = batchGeneratePayrollSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('dispatcher_payroll.create', {
    rateLimit: { key: 'batchGeneratePayroll', limit: 5, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Fetch all dispatchers with active pay configs
  const { data: configs, error: configsError } = await supabase
    .from('dispatcher_pay_configs')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .is('effective_to', null)

  if (configsError || !configs || configs.length === 0) {
    return { error: 'No dispatchers with active pay configurations found.' }
  }

  const results: { userId: string; success: boolean; error?: string }[] = []

  for (const config of configs) {
    const result = await generateSinglePeriod(
      supabase,
      tenantId,
      config.user_id,
      parsed.data.periodStart,
      parsed.data.periodEnd,
    )

    results.push({
      userId: config.user_id,
      success: !('error' in result),
      error: 'error' in result ? result.error : undefined,
    })
  }

  revalidatePath('/payroll')

  const successCount = results.filter((r) => r.success).length
  return {
    success: true,
    data: {
      total: configs.length,
      generated: successCount,
      skipped: configs.length - successCount,
      details: results,
    },
  }
}

export async function approvePayrollPeriod(id: string) {
  const auth = await authorize('dispatcher_payroll.approve')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Verify current status is draft
  const { data: period, error: fetchError } = await supabase
    .from('dispatcher_payroll_periods')
    .select('status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchError || !period) {
    return { error: 'Payroll period not found.' }
  }

  if (period.status !== 'draft') {
    return { error: 'Only draft payroll periods can be approved.' }
  }

  const { error } = await supabase
    .from('dispatcher_payroll_periods')
    .update({
      status: 'approved',
      approved_by: auth.ctx.user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: safeError(error, 'approvePayrollPeriod') }
  }

  revalidatePath('/payroll')
  return { success: true }
}

export async function markPayrollPeriodPaid(id: string) {
  const auth = await authorize('dispatcher_payroll.approve')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { data: period, error: fetchError } = await supabase
    .from('dispatcher_payroll_periods')
    .select('status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchError || !period) {
    return { error: 'Payroll period not found.' }
  }

  if (period.status !== 'approved') {
    return { error: 'Only approved payroll periods can be marked as paid.' }
  }

  const { error } = await supabase
    .from('dispatcher_payroll_periods')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: safeError(error, 'markPayrollPeriodPaid') }
  }

  revalidatePath('/payroll')
  return { success: true }
}

export async function deletePayrollPeriod(id: string) {
  const auth = await authorize('dispatcher_payroll.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { data: period, error: fetchError } = await supabase
    .from('dispatcher_payroll_periods')
    .select('status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchError || !period) {
    return { error: 'Payroll period not found.' }
  }

  if (period.status !== 'draft') {
    return { error: 'Only draft payroll periods can be deleted.' }
  }

  const { error } = await supabase
    .from('dispatcher_payroll_periods')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: safeError(error, 'deletePayrollPeriod') }
  }

  revalidatePath('/payroll')
  return { success: true }
}
