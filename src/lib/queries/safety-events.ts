import type { SupabaseClient } from '@supabase/supabase-js'
import type { SafetyEvent } from '@/types/database'
import { sanitizeSearch } from '@/lib/sanitize-search'

export interface SafetyEventFilters {
  eventType?: string
  severity?: string
  status?: string
  driverId?: string
  truckId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface SafetyEventsResult {
  events: SafetyEvent[]
  total: number
}

export interface SafetyEventStats {
  totalOpen: number
  totalEvents: number
  totalFinancialImpact: number
  byType: {
    incident: number
    claim: number
    dot_inspection: number
  }
  bySeverity: {
    minor: number
    moderate: number
    severe: number
    critical: number
  }
}

export async function fetchSafetyEvents(
  supabase: SupabaseClient,
  filters: SafetyEventFilters = {}
): Promise<SafetyEventsResult> {
  const {
    eventType, severity, status, driverId, truckId,
    dateFrom, dateTo, search, sortBy, sortDir,
    page = 0, pageSize = 20,
  } = filters

  const sortColumn = sortBy === 'severity' ? 'severity'
    : sortBy === 'title' ? 'title'
    : sortBy === 'status' ? 'status'
    : 'event_date'
  const ascending = sortDir === 'asc'

  let query = supabase
    .from('safety_events')
    .select(
      `*, driver:driver_id(id, first_name, last_name), truck:truck_id(id, unit_number, make, model)`,
      { count: 'exact' }
    )
    .order(sortColumn, { ascending, nullsFirst: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (eventType) {
    query = query.eq('event_type', eventType)
  }

  if (severity) {
    query = query.eq('severity', severity)
  }

  if (status) {
    query = query.eq('status', status)
  }

  if (driverId) {
    query = query.eq('driver_id', driverId)
  }

  if (truckId) {
    query = query.eq('truck_id', truckId)
  }

  if (dateFrom) {
    query = query.gte('event_date', dateFrom)
  }

  if (dateTo) {
    query = query.lte('event_date', dateTo)
  }

  if (search) {
    const s = sanitizeSearch(search)
    if (s) {
      query = query.ilike('title', `%${s}%`)
    }
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    events: (data ?? []) as SafetyEvent[],
    total: count ?? 0,
  }
}

export async function fetchSafetyEvent(
  supabase: SupabaseClient,
  id: string
): Promise<SafetyEvent> {
  const { data, error } = await supabase
    .from('safety_events')
    .select(`*, driver:driver_id(id, first_name, last_name), truck:truck_id(id, unit_number, make, model)`)
    .eq('id', id)
    .single()

  if (error) throw error

  return data as SafetyEvent
}

export async function fetchSafetyEventStats(
  supabase: SupabaseClient
): Promise<SafetyEventStats> {
  const { data, error } = await supabase
    .from('safety_events')
    .select('status, event_type, severity, financial_amount')

  if (error) throw error

  const rows = (data ?? []) as Array<{
    status: string
    event_type: string
    severity: string
    financial_amount: string | null
  }>

  const totalOpen = rows.filter(r => r.status === 'open' || r.status === 'under_review').length
  const totalEvents = rows.length
  const totalFinancialImpact = rows.reduce((sum, r) => {
    return sum + (r.financial_amount ? parseFloat(r.financial_amount) : 0)
  }, 0)

  const byType = {
    incident: rows.filter(r => r.event_type === 'incident').length,
    claim: rows.filter(r => r.event_type === 'claim').length,
    dot_inspection: rows.filter(r => r.event_type === 'dot_inspection').length,
  }

  const bySeverity = {
    minor: rows.filter(r => r.severity === 'minor').length,
    moderate: rows.filter(r => r.severity === 'moderate').length,
    severe: rows.filter(r => r.severity === 'severe').length,
    critical: rows.filter(r => r.severity === 'critical').length,
  }

  return { totalOpen, totalEvents, totalFinancialImpact, byType, bySeverity }
}
