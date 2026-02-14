import type { SupabaseClient } from '@supabase/supabase-js'
import type { ComplianceDocument } from '@/types/database'

export interface ComplianceDocFilters {
  documentType?: string
  entityType?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface ComplianceDocsResult {
  docs: ComplianceDocument[]
  total: number
}

export async function fetchComplianceDocs(
  supabase: SupabaseClient,
  filters: ComplianceDocFilters = {}
): Promise<ComplianceDocsResult> {
  const { documentType, entityType, search, page = 0, pageSize = 20 } = filters

  let query = supabase
    .from('compliance_documents')
    .select('*', { count: 'exact' })
    .order('expires_at', { ascending: true, nullsFirst: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (documentType) {
    query = query.eq('document_type', documentType)
  }

  if (entityType) {
    query = query.eq('entity_type', entityType)
  }

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    docs: (data ?? []) as ComplianceDocument[],
    total: count ?? 0,
  }
}

export async function fetchComplianceDoc(
  supabase: SupabaseClient,
  id: string
): Promise<ComplianceDocument> {
  const { data, error } = await supabase
    .from('compliance_documents')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  return data as ComplianceDocument
}

export async function fetchExpirationAlerts(
  supabase: SupabaseClient
): Promise<ComplianceDocument[]> {
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const { data, error } = await supabase
    .from('compliance_documents')
    .select('*')
    .not('expires_at', 'is', null)
    .lte('expires_at', thirtyDaysFromNow.toISOString())
    .order('expires_at', { ascending: true })

  if (error) throw error

  return (data ?? []) as ComplianceDocument[]
}
