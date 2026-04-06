import type { SupabaseClient } from '@supabase/supabase-js'
import type { ComplianceDocument } from '@/types/database'
import {
  COMPLIANCE_SUB_CATEGORY_LABELS,
  DQF_SUB_CATEGORIES,
  VEHICLE_SUB_CATEGORIES,
  COMPANY_SUB_CATEGORIES,
} from '@/types'
import type { ComplianceSubCategory } from '@/types'

export interface ComplianceFolder {
  subCategory: string
  label: string
  documents: ComplianceDocument[] // sorted newest first
  activeDocument: ComplianceDocument | null
  status: 'missing' | 'valid' | 'expiring_soon' | 'expired'
  isRequired: boolean
  isCustom: boolean // true = user-created, can be deleted
}

function resolveSubCategories(
  documentType: 'dqf' | 'vehicle_qualification' | 'company_document'
): readonly string[] {
  switch (documentType) {
    case 'dqf':
      return DQF_SUB_CATEGORIES
    case 'vehicle_qualification':
      return VEHICLE_SUB_CATEGORIES
    case 'company_document':
      return COMPANY_SUB_CATEGORIES
  }
}

function computeStatus(
  activeDocument: ComplianceDocument | null
): ComplianceFolder['status'] {
  if (!activeDocument) return 'missing'
  if (!activeDocument.expires_at) return 'valid'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiresAt = new Date(activeDocument.expires_at)
  expiresAt.setHours(0, 0, 0, 0)

  if (expiresAt < today) return 'expired'

  const thirtyDaysOut = new Date(today)
  thirtyDaysOut.setDate(today.getDate() + 30)
  if (expiresAt <= thirtyDaysOut) return 'expiring_soon'

  return 'valid'
}

export async function fetchComplianceFolders(
  supabase: SupabaseClient,
  documentType: 'dqf' | 'vehicle_qualification' | 'company_document',
  entityType: 'driver' | 'truck' | 'company',
  entityId: string | null
): Promise<ComplianceFolder[]> {
  const subCategories = resolveSubCategories(documentType)

  // Fetch all matching documents — fail-safe (empty array on error so folders still render)
  let docs: ComplianceDocument[] = []
  try {
    let query = supabase
      .from('compliance_documents')
      .select('*')
      .eq('document_type', documentType)
      .eq('entity_type', entityType)
      .order('created_at', { ascending: false })

    if (entityId) query = query.eq('entity_id', entityId)

    const { data, error } = await query
    if (error) {
      console.warn('[compliance-folders] documents fetch failed:', error.message)
    } else {
      docs = (data ?? []) as ComplianceDocument[]
    }
  } catch (err) {
    console.warn('[compliance-folders] documents fetch threw:', err)
  }

  // Fetch tenant-scoped requirements (custom folders + FMCSA seeded ones)
  // Schema: compliance_requirements has display_name, sub_category, document_type, sort_order
  const customRequirements = new Map<string, { displayName: string; sortOrder: number }>()
  try {
    const { data: reqs, error } = await supabase
      .from('compliance_requirements')
      .select('sub_category, display_name, sort_order')
      .eq('document_type', documentType)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      console.warn('[compliance-folders] requirements fetch failed:', error.message)
    } else if (reqs) {
      for (const r of reqs as { sub_category: string; display_name: string; sort_order: number }[]) {
        customRequirements.set(r.sub_category, {
          displayName: r.display_name,
          sortOrder: r.sort_order,
        })
      }
    }
  } catch (err) {
    console.warn('[compliance-folders] requirements fetch threw:', err)
  }

  // Group documents by sub_category (already sorted newest first by query)
  const groupedDocs = new Map<string, ComplianceDocument[]>()
  for (const doc of docs) {
    const group = groupedDocs.get(doc.sub_category) ?? []
    group.push(doc)
    groupedDocs.set(doc.sub_category, group)
  }

  // Build the union of sub_categories: predefined + custom (from requirements) + any orphan docs
  // Skip the 'other' catch-all — orphan docs with sub_category='other' won't get their own folder
  const allSubCategories = new Set<string>([...subCategories, ...customRequirements.keys()])
  for (const doc of docs) {
    if (doc.sub_category && doc.sub_category !== 'other') {
      allSubCategories.add(doc.sub_category)
    }
  }

  // Build folders — predefined first (in catalog order), then custom (sorted by sort_order)
  const predefinedSet = new Set<string>(subCategories)

  const buildFolder = (subCategory: string): ComplianceFolder => {
    const categoryDocs = groupedDocs.get(subCategory) ?? []
    const activeDocument = categoryDocs[0] ?? null
    const status = computeStatus(activeDocument)
    const isPredefined = predefinedSet.has(subCategory)
    const customReq = customRequirements.get(subCategory)

    // Label resolution: custom requirement display_name → predefined label → raw sub_category
    const label =
      customReq?.displayName ??
      COMPLIANCE_SUB_CATEGORY_LABELS[subCategory as ComplianceSubCategory] ??
      subCategory

    return {
      subCategory,
      label,
      documents: categoryDocs,
      activeDocument,
      status,
      isRequired: !!customReq, // any tenant requirement is "required" by definition
      isCustom: !isPredefined,
    }
  }

  const predefinedFolders = subCategories.map(buildFolder)
  const customFolders = Array.from(allSubCategories)
    .filter((sc) => !predefinedSet.has(sc))
    .sort((a, b) => {
      const aOrder = customRequirements.get(a)?.sortOrder ?? 9999
      const bOrder = customRequirements.get(b)?.sortOrder ?? 9999
      return aOrder - bOrder
    })
    .map(buildFolder)

  return [...predefinedFolders, ...customFolders]
}
