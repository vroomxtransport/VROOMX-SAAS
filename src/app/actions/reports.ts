'use server'

import { authorize, safeError } from '@/lib/authz'
import { createReportSchema, updateReportSchema, createViewSchema, updateViewSchema } from '@/lib/validations/reports'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ============================================================================
// Custom Reports
// ============================================================================

export async function createReport(data: unknown) {
  const parsed = createReportSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const auth = await authorize('reports.create', { rateLimit: { key: 'createReport', limit: 20, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  const { data: report, error } = await supabase
    .from('custom_reports')
    .insert({
      tenant_id: tenantId,
      user_id: user.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      config: parsed.data.config,
      is_shared: parsed.data.isShared ?? false,
    })
    .select()
    .single()

  if (error) return { error: safeError(error, 'createReport') }
  revalidatePath('/reports')
  return { success: true, data: report }
}

export async function updateReport(data: unknown) {
  const parsed = updateReportSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const auth = await authorize('reports.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description || null
  if (parsed.data.config !== undefined) updateData.config = parsed.data.config
  if (parsed.data.isShared !== undefined) updateData.is_shared = parsed.data.isShared

  const { error } = await supabase
    .from('custom_reports')
    .update(updateData)
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)

  if (error) return { error: safeError(error, 'updateReport') }
  revalidatePath('/reports')
  return { success: true }
}

export async function deleteReport(id: string) {
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { error: 'Invalid report ID' }

  const auth = await authorize('reports.delete')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('custom_reports')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { error: safeError(error, 'deleteReport') }
  revalidatePath('/reports')
  return { success: true }
}

// ============================================================================
// Saved Views
// ============================================================================

export async function createView(data: unknown) {
  const parsed = createViewSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const auth = await authorize('reports.create', { rateLimit: { key: 'createView', limit: 20, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  // If setting as default, clear existing defaults for this page
  if (parsed.data.isDefault) {
    await supabase
      .from('saved_views')
      .update({ is_default: false })
      .eq('tenant_id', tenantId)
      .eq('page_key', parsed.data.pageKey)
      .eq('is_default', true)
  }

  const { data: view, error } = await supabase
    .from('saved_views')
    .insert({
      tenant_id: tenantId,
      user_id: user.id,
      page_key: parsed.data.pageKey,
      name: parsed.data.name,
      filters: parsed.data.filters,
      sort_by: parsed.data.sortBy || null,
      sort_direction: parsed.data.sortDirection || null,
      is_shared: parsed.data.isShared ?? false,
      is_default: parsed.data.isDefault ?? false,
    })
    .select()
    .single()

  if (error) return { error: safeError(error, 'createView') }
  return { success: true, data: view }
}

export async function updateView(data: unknown) {
  const parsed = updateViewSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const auth = await authorize('reports.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // If setting as default, first fetch the view to get its page_key for scoped clearing
  if (parsed.data.isDefault) {
    const { data: existing } = await supabase
      .from('saved_views')
      .select('page_key')
      .eq('id', parsed.data.id)
      .eq('tenant_id', tenantId)
      .single()

    if (existing) {
      await supabase
        .from('saved_views')
        .update({ is_default: false })
        .eq('tenant_id', tenantId)
        .eq('page_key', existing.page_key)
        .eq('is_default', true)
    }
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name
  if (parsed.data.filters !== undefined) updateData.filters = parsed.data.filters
  if (parsed.data.sortBy !== undefined) updateData.sort_by = parsed.data.sortBy || null
  if (parsed.data.sortDirection !== undefined) updateData.sort_direction = parsed.data.sortDirection || null
  if (parsed.data.isShared !== undefined) updateData.is_shared = parsed.data.isShared
  if (parsed.data.isDefault !== undefined) updateData.is_default = parsed.data.isDefault

  const { error } = await supabase
    .from('saved_views')
    .update(updateData)
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)

  if (error) return { error: safeError(error, 'updateView') }
  return { success: true }
}

export async function deleteView(id: string) {
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { error: 'Invalid view ID' }

  const auth = await authorize('reports.delete')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('saved_views')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { error: safeError(error, 'deleteView') }
  return { success: true }
}
