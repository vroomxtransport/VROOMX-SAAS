import type { SupabaseClient } from '@supabase/supabase-js'
import type { ComplianceDocument, ComplianceRequirement } from '@/types/database'
import { sanitizeSearch } from '@/lib/sanitize-search'

// M4: explicit column allowlist instead of SELECT *. Each list mirrors the
// corresponding type in src/types/database.ts. Adding a new column to the
// schema requires explicitly adding it here too — defense in depth against
// accidental over-exposure when schemas evolve.
const COMPLIANCE_DOC_COLUMNS =
  'id, tenant_id, document_type, entity_type, entity_id, name, file_name, ' +
  'storage_path, file_size, expires_at, issue_date, uploaded_by, notes, ' +
  'sub_category, status, is_required, regulation_reference, created_at, updated_at'

const COMPLIANCE_REQUIREMENT_COLUMNS =
  'id, tenant_id, document_type, sub_category, display_name, description, ' +
  'regulation_reference, renewal_period_months, retention_months, is_active, ' +
  'sort_order, created_at'

export interface ComplianceDocFilters {
  documentType?: string
  entityType?: string
  search?: string
  expiryFrom?: string
  expiryTo?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface ComplianceDocsResult {
  docs: ComplianceDocument[]
  total: number
}

export interface ComplianceOverview {
  total: number
  valid: number
  expiringSoon: number
  expired: number
  missing: number
}

export interface ComplianceChecklistItem {
  requirement: ComplianceRequirement
  document: ComplianceDocument | null
  status: 'valid' | 'expiring_soon' | 'expired' | 'missing'
}

export interface ComplianceScore {
  score: number
  met: number
  total: number
}

export async function fetchComplianceDocs(
  supabase: SupabaseClient,
  filters: ComplianceDocFilters = {}
): Promise<ComplianceDocsResult> {
  const { documentType, entityType, search, expiryFrom, expiryTo, sortBy, sortDir, page = 0, pageSize = 20 } = filters

  // Determine sort column and direction
  const sortColumn = sortBy === 'expiry_date' ? 'expires_at' : 'expires_at'
  const ascending = sortDir === 'desc' ? false : true

  let query = supabase
    .from('compliance_documents')
    .select(COMPLIANCE_DOC_COLUMNS, { count: 'exact' })
    .order(sortColumn, { ascending, nullsFirst: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (documentType) {
    query = query.eq('document_type', documentType)
  }

  if (entityType) {
    query = query.eq('entity_type', entityType)
  }

  if (search) {
    const s = sanitizeSearch(search)
    if (s) {
      query = query.ilike('name', `%${s}%`)
    }
  }

  if (expiryFrom) {
    query = query.gte('expires_at', expiryFrom)
  }

  if (expiryTo) {
    query = query.lte('expires_at', expiryTo)
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    // Supabase JS infers the row shape from the literal passed to .select().
    // We use a constant for the column list (M4) so the inferred type is
    // generic; cast through unknown to the known shape.
    docs: ((data ?? []) as unknown) as ComplianceDocument[],
    total: count ?? 0,
  }
}

export async function fetchComplianceDoc(
  supabase: SupabaseClient,
  id: string
): Promise<ComplianceDocument> {
  const { data, error } = await supabase
    .from('compliance_documents')
    .select(COMPLIANCE_DOC_COLUMNS)
    .eq('id', id)
    .single()

  if (error) throw error

  return (data as unknown) as ComplianceDocument
}

export async function fetchExpirationAlerts(
  supabase: SupabaseClient
): Promise<ComplianceDocument[]> {
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const { data, error } = await supabase
    .from('compliance_documents')
    .select(COMPLIANCE_DOC_COLUMNS)
    .not('expires_at', 'is', null)
    .lte('expires_at', thirtyDaysFromNow.toISOString())
    .order('expires_at', { ascending: true })

  if (error) throw error

  return ((data ?? []) as unknown) as ComplianceDocument[]
}

export async function fetchComplianceOverview(
  supabase: SupabaseClient
): Promise<ComplianceOverview> {
  const { data, error } = await supabase
    .from('compliance_documents')
    .select('status')

  if (error) throw error

  const rows = (data ?? []) as Array<{ status: string }>
  const total = rows.length
  const valid = rows.filter(r => r.status === 'valid').length
  const expiringSoon = rows.filter(r => r.status === 'expiring_soon').length
  const expired = rows.filter(r => r.status === 'expired').length

  // Fetch requirements count to determine "missing"
  const { count: reqCount, error: reqError } = await supabase
    .from('compliance_requirements')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  if (reqError) throw reqError

  const totalRequired = reqCount ?? 0
  const missing = Math.max(0, totalRequired - total)

  return { total, valid, expiringSoon, expired, missing }
}

export async function fetchComplianceChecklist(
  supabase: SupabaseClient,
  documentType: string,
  entityType: string,
  entityId?: string
): Promise<ComplianceChecklistItem[]> {
  // Fetch all active requirements for this document type
  const { data: requirements, error: reqError } = await supabase
    .from('compliance_requirements')
    .select(COMPLIANCE_REQUIREMENT_COLUMNS)
    .eq('document_type', documentType)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (reqError) throw reqError

  if (!requirements || requirements.length === 0) return []

  // Fetch documents for this entity
  let docQuery = supabase
    .from('compliance_documents')
    .select(COMPLIANCE_DOC_COLUMNS)
    .eq('document_type', documentType)
    .eq('entity_type', entityType)

  if (entityId) {
    docQuery = docQuery.eq('entity_id', entityId)
  }

  const { data: documents, error: docError } = await docQuery

  if (docError) throw docError

  const docs = ((documents ?? []) as unknown) as ComplianceDocument[]
  const reqs = ((requirements ?? []) as unknown) as ComplianceRequirement[]

  // Map requirements to checklist items
  return reqs.map(req => {
    const matchingDoc = docs.find(d => d.sub_category === req.sub_category) ?? null

    let status: ComplianceChecklistItem['status'] = 'missing'
    if (matchingDoc) {
      if (matchingDoc.status === 'valid') status = 'valid'
      else if (matchingDoc.status === 'expiring_soon') status = 'expiring_soon'
      else if (matchingDoc.status === 'expired') status = 'expired'
      else status = 'valid' // default if status not set
    }

    return { requirement: req, document: matchingDoc, status }
  })
}

export async function fetchDriverComplianceScore(
  supabase: SupabaseClient,
  driverId: string
): Promise<ComplianceScore> {
  // Fetch all active DQF requirements
  const { data: requirements, error: reqError } = await supabase
    .from('compliance_requirements')
    .select('id, sub_category')
    .eq('document_type', 'dqf')
    .eq('is_active', true)

  if (reqError) throw reqError

  const reqs = (requirements ?? []) as Array<{ id: string; sub_category: string }>
  const total = reqs.length

  if (total === 0) return { score: 100, met: 0, total: 0 }

  // Fetch valid/expiring docs for this driver
  const { data: documents, error: docError } = await supabase
    .from('compliance_documents')
    .select('sub_category, status')
    .eq('document_type', 'dqf')
    .eq('entity_type', 'driver')
    .eq('entity_id', driverId)
    .in('status', ['valid', 'expiring_soon'])

  if (docError) throw docError

  const docs = (documents ?? []) as Array<{ sub_category: string; status: string }>
  const docSubCategories = new Set(docs.map(d => d.sub_category))

  const met = reqs.filter(r => docSubCategories.has(r.sub_category)).length
  const score = total > 0 ? Math.round((met / total) * 100) : 100

  return { score, met, total }
}

export async function fetchTruckComplianceScore(
  supabase: SupabaseClient,
  truckId: string
): Promise<ComplianceScore> {
  // Fetch all active vehicle requirements
  const { data: requirements, error: reqError } = await supabase
    .from('compliance_requirements')
    .select('id, sub_category')
    .eq('document_type', 'vehicle_qualification')
    .eq('is_active', true)

  if (reqError) throw reqError

  const reqs = (requirements ?? []) as Array<{ id: string; sub_category: string }>
  const total = reqs.length

  if (total === 0) return { score: 100, met: 0, total: 0 }

  // Fetch valid/expiring docs for this truck
  const { data: documents, error: docError } = await supabase
    .from('compliance_documents')
    .select('sub_category, status')
    .eq('document_type', 'vehicle_qualification')
    .eq('entity_type', 'truck')
    .eq('entity_id', truckId)
    .in('status', ['valid', 'expiring_soon'])

  if (docError) throw docError

  const docs = (documents ?? []) as Array<{ sub_category: string; status: string }>
  const docSubCategories = new Set(docs.map(d => d.sub_category))

  const met = reqs.filter(r => docSubCategories.has(r.sub_category)).length
  const score = total > 0 ? Math.round((met / total) * 100) : 100

  return { score, met, total }
}

export async function fetchComplianceRequirements(
  supabase: SupabaseClient,
  documentType?: string
): Promise<ComplianceRequirement[]> {
  let query = supabase
    .from('compliance_requirements')
    .select(COMPLIANCE_REQUIREMENT_COLUMNS)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (documentType) {
    query = query.eq('document_type', documentType)
  }

  const { data, error } = await query

  if (error) throw error

  return ((data ?? []) as unknown) as ComplianceRequirement[]
}
