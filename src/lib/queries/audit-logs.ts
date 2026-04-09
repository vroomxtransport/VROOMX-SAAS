import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuditLog, AuditArchive, AuditAlertConfig } from '@/types/database'
import { sanitizeSearch } from '@/lib/sanitize-search'
import { clampPageSize } from '@/lib/queries/pagination'

export interface AuditLogFilters {
  entityType?: string
  action?: string
  severity?: 'info' | 'warning' | 'critical'
  startDate?: string
  endDate?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface AuditLogsResult {
  logs: AuditLog[]
  total: number
}

// SCAN-008 pattern: sort column allowlist to block column-injection via
// unvalidated sortBy. Audit logs are always newest-first; no caller-supplied sort.
// const AUDIT_LOG_DEFAULT_SORT = 'created_at'

export async function fetchAuditLogs(
  supabase: SupabaseClient,
  filters: AuditLogFilters = {}
): Promise<AuditLogsResult> {
  const {
    entityType,
    action,
    severity,
    startDate,
    endDate,
    search,
    page = 0,
  } = filters
  const pageSize = clampPageSize(filters.pageSize)

  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (entityType) {
    query = query.eq('entity_type', entityType)
  }

  if (action) {
    query = query.eq('action', action)
  }

  if (severity) {
    query = query.eq('severity', severity)
  }

  if (startDate) {
    query = query.gte('created_at', startDate)
  }

  if (endDate) {
    query = query.lte('created_at', endDate)
  }

  if (search) {
    const s = sanitizeSearch(search)
    if (s) {
      query = query.or(`description.ilike.%${s}%,actor_email.ilike.%${s}%`)
    }
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    logs: (data ?? []) as AuditLog[],
    total: count ?? 0,
  }
}

export async function fetchAuditArchives(
  supabase: SupabaseClient
): Promise<AuditArchive[]> {
  const { data, error } = await supabase
    .from('audit_archives')
    .select('*')
    .order('archive_month', { ascending: false })

  if (error) throw error

  return (data ?? []) as AuditArchive[]
}

export async function fetchAuditAlertConfigs(
  supabase: SupabaseClient
): Promise<AuditAlertConfig[]> {
  const { data, error } = await supabase
    .from('audit_alert_configs')
    .select('*')
    .order('entity_type', { ascending: true })

  if (error) throw error

  return (data ?? []) as AuditAlertConfig[]
}
