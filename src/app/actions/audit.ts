'use server'

import { authorize, safeError } from '@/lib/authz'
import {
  fetchAuditLogsSchema,
  updateAlertConfigSchema,
  verifyIntegritySchema,
  exportAuditLogsSchema,
} from '@/lib/validations/audit'
import { revalidatePath } from 'next/cache'
import { redactPii } from '@/lib/audit-redact'
import { computeIntegrityHash } from '@/lib/audit-integrity'
import { getSignedUrl } from '@/lib/storage'
import type { AuditLog, AuditAlertConfig, AuditArchive } from '@/types/database'

// ---------------------------------------------------------------------------
// fetchTenantAuditLogs
// ---------------------------------------------------------------------------

export async function fetchTenantAuditLogs(input: unknown) {
  const parsed = fetchAuditLogsSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const auth = await authorize('settings.manage', {
    rateLimit: { key: 'fetchAuditLogs', limit: 30, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, role } = auth.ctx

  if (role !== 'admin' && role !== 'owner') {
    return { error: 'Unauthorized' }
  }

  const v = parsed.data
  const pageSize = Math.min(v.pageSize, 500)
  const page = Math.max(1, v.page)
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (v.entityType) {
    query = query.eq('entity_type', v.entityType)
  }

  if (v.action) {
    query = query.eq('action', v.action)
  }

  if (v.severity) {
    query = query.eq('severity', v.severity)
  }

  if (v.startDate) {
    query = query.gte('created_at', v.startDate)
  }

  if (v.endDate) {
    query = query.lte('created_at', v.endDate)
  }

  if (v.search) {
    // sanitizeSearch is called client-side before sending; re-sanitize server-side
    const s = v.search.replace(/[(),.\\'"%;:!]/g, '').trim().slice(0, 200)
    if (s) {
      query = query.or(`description.ilike.%${s}%,actor_email.ilike.%${s}%`)
    }
  }

  const { data, error, count } = await query

  if (error) return { error: safeError(error, 'fetchTenantAuditLogs') }

  return {
    success: true,
    data: {
      logs: (data ?? []) as AuditLog[],
      total: count ?? 0,
    },
  }
}

// ---------------------------------------------------------------------------
// fetchAuditArchives
// ---------------------------------------------------------------------------

export async function fetchAuditArchives() {
  const auth = await authorize('settings.manage', {
    rateLimit: { key: 'fetchAuditArchives', limit: 10, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, role } = auth.ctx

  if (role !== 'admin' && role !== 'owner') {
    return { error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('audit_archives')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('archive_month', { ascending: false })

  if (error) return { error: safeError(error, 'fetchAuditArchives') }

  return {
    success: true,
    data: (data ?? []) as AuditArchive[],
  }
}

// ---------------------------------------------------------------------------
// downloadAuditArchive
// ---------------------------------------------------------------------------

export async function downloadAuditArchive(input: unknown) {
  const parsed = (await import('zod'))
    .z.object({ archiveId: (await import('zod')).z.string().uuid() })
    .safeParse(input)

  if (!parsed.success) return { error: 'Invalid archive ID' }

  const auth = await authorize('settings.manage', {
    rateLimit: { key: 'downloadAuditArchive', limit: 5, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, role } = auth.ctx

  if (role !== 'admin' && role !== 'owner') {
    return { error: 'Unauthorized' }
  }

  // Verify the archive belongs to this tenant
  const { data: archive, error: fetchErr } = await supabase
    .from('audit_archives')
    .select('id, tenant_id, storage_path')
    .eq('id', parsed.data.archiveId)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchErr || !archive) return { error: 'Archive not found' }

  const { url, error: signErr } = await getSignedUrl(
    supabase,
    'audit-archives',
    archive.storage_path,
    3600
  )

  if (signErr) return { error: safeError({ message: signErr }, 'downloadAuditArchive') }

  return { success: true, data: { url } }
}

// ---------------------------------------------------------------------------
// getAuditAlertConfig
// ---------------------------------------------------------------------------

export async function getAuditAlertConfig() {
  const auth = await authorize('settings.manage', {
    rateLimit: { key: 'getAuditAlertConfig', limit: 10, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, role } = auth.ctx

  if (role !== 'admin' && role !== 'owner') {
    return { error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('audit_alert_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('entity_type', { ascending: true })

  if (error) return { error: safeError(error, 'getAuditAlertConfig') }

  return {
    success: true,
    data: (data ?? []) as AuditAlertConfig[],
  }
}

// ---------------------------------------------------------------------------
// updateAuditAlertConfig
// ---------------------------------------------------------------------------

export async function updateAuditAlertConfig(input: unknown) {
  const parsed = updateAlertConfigSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const auth = await authorize('settings.manage', {
    rateLimit: { key: 'updateAuditAlertConfig', limit: 10, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, role } = auth.ctx

  if (role !== 'admin' && role !== 'owner') {
    return { error: 'Unauthorized' }
  }

  // Delete all existing configs for this tenant
  const { error: deleteErr } = await supabase
    .from('audit_alert_configs')
    .delete()
    .eq('tenant_id', tenantId)

  if (deleteErr) return { error: safeError(deleteErr, 'updateAuditAlertConfig:delete') }

  // Insert new configs (skip empty arrays)
  if (parsed.data.configs.length > 0) {
    const rows = parsed.data.configs.map((c) => ({
      tenant_id: tenantId,
      entity_type: c.entity_type,
      action: c.action,
      severity: c.severity,
      enabled: c.enabled,
      notify_in_app: c.notify_in_app,
    }))

    const { error: insertErr } = await supabase
      .from('audit_alert_configs')
      .insert(rows)

    if (insertErr) return { error: safeError(insertErr, 'updateAuditAlertConfig:insert') }
  }

  revalidatePath('/settings/audit-log')
  return { success: true }
}

// ---------------------------------------------------------------------------
// verifyAuditIntegrity
// ---------------------------------------------------------------------------

export async function verifyAuditIntegrity(input: unknown) {
  const parsed = verifyIntegritySchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid date range' }

  const auth = await authorize('settings.manage', {
    rateLimit: { key: 'verifyAuditIntegrity', limit: 3, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, role } = auth.ctx

  if (role !== 'admin' && role !== 'owner') {
    return { error: 'Unauthorized' }
  }

  const { startDate, endDate } = parsed.data

  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, tenant_id, entity_type, entity_id, action, actor_id, created_at, integrity_hash, previous_hash')
    .eq('tenant_id', tenantId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: true })
    .limit(10000)

  if (error) return { error: safeError(error, 'verifyAuditIntegrity') }

  const logs = data ?? []
  let totalChecked = 0

  for (const log of logs) {
    totalChecked++

    const expected = computeIntegrityHash(log.previous_hash, {
      tenantId: log.tenant_id,
      entityType: log.entity_type,
      entityId: log.entity_id,
      action: log.action,
      actorId: log.actor_id,
      createdAt: log.created_at,
    })

    if (log.integrity_hash !== expected) {
      return {
        success: true,
        data: {
          valid: false,
          totalChecked,
          firstBroken: {
            id: log.id,
            created_at: log.created_at,
            expected,
            actual: log.integrity_hash ?? '',
          },
        },
      }
    }
  }

  return {
    success: true,
    data: {
      valid: true,
      totalChecked,
    },
  }
}

// ---------------------------------------------------------------------------
// exportAuditLogs
// ---------------------------------------------------------------------------

export async function exportAuditLogs(input: unknown) {
  const parsed = exportAuditLogsSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const auth = await authorize('settings.manage', {
    rateLimit: { key: 'exportAuditLogs', limit: 5, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, role } = auth.ctx

  if (role !== 'admin' && role !== 'owner') {
    return { error: 'Unauthorized' }
  }

  const v = parsed.data

  let query = supabase
    .from('audit_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(10000)

  if (v.entityType) {
    query = query.eq('entity_type', v.entityType)
  }

  if (v.action) {
    query = query.eq('action', v.action)
  }

  if (v.severity) {
    query = query.eq('severity', v.severity)
  }

  if (v.startDate) {
    query = query.gte('created_at', v.startDate)
  }

  if (v.endDate) {
    query = query.lte('created_at', v.endDate)
  }

  if (v.search) {
    const s = v.search.replace(/[(),.\\'"%;:!]/g, '').trim().slice(0, 200)
    if (s) {
      query = query.or(`description.ilike.%${s}%,actor_email.ilike.%${s}%`)
    }
  }

  const { data, error } = await query

  if (error) return { error: safeError(error, 'exportAuditLogs') }

  const logs = (data ?? []) as AuditLog[]

  // Redact PII before export
  const redacted = logs.map((l) => redactPii(l) as AuditLog)

  if (v.format === 'json') {
    const siem = redacted.map((l) => ({
      timestamp: new Date(l.created_at).toISOString(),
      severity: l.severity,
      actor: { id: l.actor_id, email: l.actor_email },
      entity: { type: l.entity_type, id: l.entity_id },
      action: l.action,
      description: l.description,
      ip_address: l.ip_address,
      user_agent: l.user_agent,
      change_diff: l.change_diff,
      metadata: l.metadata,
    }))

    return {
      success: true,
      data: { data: JSON.stringify(siem, null, 2), format: 'json' as const },
    }
  }

  // CSV format
  const headers = [
    'Timestamp',
    'Severity',
    'Entity Type',
    'Entity ID',
    'Action',
    'Description',
    'Actor ID',
    'Actor Email',
    'IP Address',
    'User Agent',
  ]

  const rows = redacted.map((l) => [
    new Date(l.created_at).toISOString(),
    l.severity,
    l.entity_type,
    l.entity_id,
    l.action,
    (l.description ?? '').replace(/,/g, ';').replace(/\n/g, ' '),
    l.actor_id,
    l.actor_email ?? '',
    l.ip_address ?? '',
    (l.user_agent ?? '').replace(/,/g, ';'),
  ])

  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')

  return {
    success: true,
    data: { data: csv, format: 'csv' as const },
  }
}
