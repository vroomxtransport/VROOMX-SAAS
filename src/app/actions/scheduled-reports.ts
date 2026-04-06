'use server'

import { authorize, safeError } from '@/lib/authz'
import {
  createScheduleSchema,
  updateScheduleSchema,
  toggleScheduleSchema,
} from '@/lib/validations/scheduled-reports'
import { computeNextRunAt } from '@/lib/reports/schedule-utils'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ============================================================================
// CRUD Actions
// ============================================================================

export async function createScheduledReport(data: unknown) {
  const parsed = createScheduleSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const auth = await authorize('reports.create', {
    rateLimit: { key: 'createScheduledReport', limit: 30, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  // Verify the report belongs to this tenant before linking
  const { data: report, error: reportError } = await supabase
    .from('custom_reports')
    .select('id')
    .eq('id', parsed.data.reportId)
    .eq('tenant_id', tenantId)
    .single()

  if (reportError || !report) {
    return { error: 'Report not found or access denied' }
  }

  const nextRunAt = computeNextRunAt(parsed.data.schedule)

  const { data: schedule, error } = await supabase
    .from('scheduled_reports')
    .insert({
      tenant_id: tenantId,
      user_id: user.id,
      report_id: parsed.data.reportId,
      schedule: parsed.data.schedule,
      recipients: parsed.data.recipients,
      format: parsed.data.format,
      enabled: parsed.data.enabled ?? true,
      next_run_at: nextRunAt.toISOString(),
    })
    .select()
    .single()

  if (error) return { error: safeError(error, 'createScheduledReport') }
  revalidatePath('/reports/schedules')
  return { success: true, data: schedule }
}

export async function updateScheduledReport(data: unknown) {
  const parsed = updateScheduleSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const auth = await authorize('reports.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (parsed.data.schedule !== undefined) {
    updateData.schedule = parsed.data.schedule
    updateData.next_run_at = computeNextRunAt(parsed.data.schedule).toISOString()
  }
  if (parsed.data.recipients !== undefined) updateData.recipients = parsed.data.recipients
  if (parsed.data.format !== undefined) updateData.format = parsed.data.format
  if (parsed.data.enabled !== undefined) updateData.enabled = parsed.data.enabled

  const { error } = await supabase
    .from('scheduled_reports')
    .update(updateData)
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)

  if (error) return { error: safeError(error, 'updateScheduledReport') }
  revalidatePath('/reports/schedules')
  return { success: true }
}

export async function deleteScheduledReport(id: string) {
  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { error: 'Invalid schedule ID' }

  const auth = await authorize('reports.delete')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('scheduled_reports')
    .delete()
    .eq('id', idParsed.data)
    .eq('tenant_id', tenantId)

  if (error) return { error: safeError(error, 'deleteScheduledReport') }
  revalidatePath('/reports/schedules')
  return { success: true }
}

export async function toggleScheduledReport(data: unknown) {
  const parsed = toggleScheduleSchema.safeParse(data)
  if (!parsed.success) return { error: 'Invalid request' }

  const auth = await authorize('reports.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('scheduled_reports')
    .update({
      enabled: parsed.data.enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)

  if (error) return { error: safeError(error, 'toggleScheduledReport') }
  revalidatePath('/reports/schedules')
  return { success: true }
}
