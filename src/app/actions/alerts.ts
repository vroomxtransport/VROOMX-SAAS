'use server'

import { authorize, safeError } from '@/lib/authz'
import {
  createAlertRuleSchema,
  updateAlertRuleSchema,
  deleteAlertRuleSchema,
  toggleAlertRuleSchema,
} from '@/lib/validations/alerts'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AlertRule {
  id: string
  tenant_id: string
  user_id: string
  name: string
  metric: string
  operator: 'gt' | 'lt' | 'gte' | 'lte'
  threshold: string
  notify_in_app: boolean
  notify_email: boolean
  email_recipients: string[] | null
  enabled: boolean
  last_triggered_at: string | null
  cooldown_minutes: number
  created_at: string
  updated_at: string
}

export interface AlertHistoryRow {
  id: string
  tenant_id: string
  alert_rule_id: string
  metric_value: string
  threshold_value: string
  triggered_at: string
}

// ---------------------------------------------------------------------------
// Query functions (called from both server components and actions)
// ---------------------------------------------------------------------------

export async function fetchAlertRules(supabase: SupabaseClient): Promise<AlertRule[]> {
  const { data, error } = await supabase
    .from('alert_rules')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as AlertRule[]
}

export async function fetchAlertHistory(
  supabase: SupabaseClient,
  limit = 20
): Promise<(AlertHistoryRow & { alert_rules: { name: string; metric: string } | null })[]> {
  const { data, error } = await supabase
    .from('alert_history')
    .select('*, alert_rules(name, metric)')
    .order('triggered_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as (AlertHistoryRow & { alert_rules: { name: string; metric: string } | null })[]
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

export async function createAlertRule(data: unknown) {
  const parsed = createAlertRuleSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const auth = await authorize('alerts.create', {
    rateLimit: { key: 'createAlertRule', limit: 20, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  const v = parsed.data

  const { data: rule, error } = await supabase
    .from('alert_rules')
    .insert({
      tenant_id: tenantId,
      user_id: user.id,
      name: v.name,
      metric: v.metric,
      operator: v.operator,
      threshold: String(v.threshold),
      notify_in_app: v.notifyInApp,
      notify_email: v.notifyEmail,
      email_recipients: v.emailRecipients ?? null,
      cooldown_minutes: v.cooldownMinutes,
      enabled: true,
    })
    .select()
    .single()

  if (error) return { error: safeError(error, 'createAlertRule') }

  revalidatePath('/settings/alerts')
  return { success: true, data: rule }
}

export async function updateAlertRule(data: unknown) {
  const parsed = updateAlertRuleSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const auth = await authorize('alerts.update', { rateLimit: { key: 'updateAlert', limit: 20, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const v = parsed.data

  // Verify ownership
  const { data: existing, error: fetchErr } = await supabase
    .from('alert_rules')
    .select('id, tenant_id')
    .eq('id', v.id)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchErr || !existing) return { error: 'Alert rule not found' }

  const { error } = await supabase
    .from('alert_rules')
    .update({
      name: v.name,
      metric: v.metric,
      operator: v.operator,
      threshold: String(v.threshold),
      notify_in_app: v.notifyInApp,
      notify_email: v.notifyEmail,
      email_recipients: v.emailRecipients ?? null,
      cooldown_minutes: v.cooldownMinutes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', v.id)
    .eq('tenant_id', tenantId)

  if (error) return { error: safeError(error, 'updateAlertRule') }

  revalidatePath('/settings/alerts')
  return { success: true }
}

export async function deleteAlertRule(data: unknown) {
  const parsed = deleteAlertRuleSchema.safeParse(data)
  if (!parsed.success) return { error: 'Invalid alert rule ID' }

  const auth = await authorize('alerts.delete', { rateLimit: { key: 'deleteAlert', limit: 10, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('alert_rules')
    .delete()
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)

  if (error) return { error: safeError(error, 'deleteAlertRule') }

  revalidatePath('/settings/alerts')
  return { success: true }
}

export async function toggleAlertRule(data: unknown) {
  const parsed = toggleAlertRuleSchema.safeParse(data)
  if (!parsed.success) return { error: 'Invalid input' }

  const auth = await authorize('alerts.update', { rateLimit: { key: 'toggleAlert', limit: 20, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('alert_rules')
    .update({
      enabled: parsed.data.enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)

  if (error) return { error: safeError(error, 'toggleAlertRule') }

  revalidatePath('/settings/alerts')
  return { success: true }
}
