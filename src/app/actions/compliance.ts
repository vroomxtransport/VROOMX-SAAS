'use server'

import { z } from 'zod'
import { authorize, safeError } from '@/lib/authz'
import { complianceDocSchema } from '@/lib/validations/compliance'
import { deleteFile } from '@/lib/storage'
import { revalidatePath } from 'next/cache'
import { cacheInvalidate } from '@/lib/cache'

export async function createComplianceDoc(data: unknown) {
  const parsed = complianceDocSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('compliance.create', { rateLimit: { key: 'createComplianceDoc', limit: 30, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  const { data: doc, error } = await supabase
    .from('compliance_documents')
    .insert({
      tenant_id: tenantId,
      document_type: parsed.data.documentType,
      entity_type: parsed.data.entityType,
      entity_id: parsed.data.entityId || null,
      name: parsed.data.name,
      expires_at: parsed.data.expiresAt || null,
      issue_date: parsed.data.issueDate || null,
      notes: parsed.data.notes || null,
      file_name: parsed.data.fileName || null,
      storage_path: parsed.data.storagePath || null,
      file_size: parsed.data.fileSize || null,
      uploaded_by: user.id,
      sub_category: parsed.data.subCategory || null,
      regulation_reference: parsed.data.regulationReference || null,
      is_required: parsed.data.isRequired ?? false,
      status: parsed.data.status || 'valid',
    })
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'createComplianceDoc') }
  }

  revalidatePath('/compliance')
  void cacheInvalidate(tenantId, 'compliance-overview')
  return { success: true, data: doc }
}

export async function updateComplianceDoc(id: string, data: unknown) {
  const parsed = complianceDocSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('compliance.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { data: doc, error } = await supabase
    .from('compliance_documents')
    .update({
      document_type: parsed.data.documentType,
      entity_type: parsed.data.entityType,
      entity_id: parsed.data.entityId || null,
      name: parsed.data.name,
      expires_at: parsed.data.expiresAt || null,
      issue_date: parsed.data.issueDate || null,
      notes: parsed.data.notes || null,
      file_name: parsed.data.fileName || null,
      storage_path: parsed.data.storagePath || null,
      file_size: parsed.data.fileSize || null,
      sub_category: parsed.data.subCategory || null,
      regulation_reference: parsed.data.regulationReference || null,
      is_required: parsed.data.isRequired ?? false,
      status: parsed.data.status || 'valid',
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'updateComplianceDoc') }
  }

  revalidatePath('/compliance')
  void cacheInvalidate(tenantId, 'compliance-overview')
  return { success: true, data: doc }
}

const updateFieldsSchema = z.object({
  id: z.string().uuid(),
  issueDate: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export async function updateComplianceDocFields(
  id: string,
  fields: { issueDate?: string | null; expiresAt?: string | null; notes?: string | null }
) {
  const parsed = updateFieldsSchema.safeParse({ id, ...fields })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('compliance.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const updates: Record<string, string | null> = {}
  if ('issueDate' in fields) updates['issue_date'] = parsed.data.issueDate ?? null
  if ('expiresAt' in fields) updates['expires_at'] = parsed.data.expiresAt ?? null
  if ('notes' in fields) updates['notes'] = parsed.data.notes ?? null

  const { data: doc, error } = await supabase
    .from('compliance_documents')
    .update(updates)
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'updateComplianceDocFields') }
  }

  revalidatePath('/compliance')
  void cacheInvalidate(tenantId, 'compliance-overview')
  return { success: true, data: doc }
}

export async function deleteComplianceDoc(id: string) {
  const auth = await authorize('compliance.delete')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Fetch the doc to get storage_path before deleting
  const { data: doc, error: fetchError } = await supabase
    .from('compliance_documents')
    .select('storage_path')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchError || !doc) {
    return { error: safeError(fetchError ?? new Error('Document not found'), 'deleteComplianceDoc') }
  }

  // Delete file from Supabase Storage if it exists
  const storagePath = doc.storage_path as string
  if (storagePath) {
    const { error: storageError } = await deleteFile(supabase, 'documents', storagePath)
    if (storageError) {
      console.error('Failed to delete compliance file from storage:', storageError)
    }
  }

  // Delete the database record
  const { error } = await supabase
    .from('compliance_documents')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: safeError(error, 'deleteComplianceDoc') }
  }

  revalidatePath('/compliance')
  void cacheInvalidate(tenantId, 'compliance-overview')
  return { success: true }
}

// ============================================================================
// Compliance Requirements Seeding
// ============================================================================

interface RequirementSeed {
  sub_category: string
  display_name: string
  regulation_reference: string | null
  renewal_period_months: number | null
  retention_months: number | null
  document_type: string
  sort_order: number
}

const FMCSA_REQUIREMENTS: RequirementSeed[] = [
  // DQF requirements
  { sub_category: 'cdl_endorsements', display_name: 'CDL & Endorsements', regulation_reference: '49 CFR 391.21', renewal_period_months: null, retention_months: 36, document_type: 'dqf', sort_order: 1 },
  { sub_category: 'medical_certificate', display_name: 'Medical Certificate (DOT Physical)', regulation_reference: '49 CFR 391.43', renewal_period_months: 24, retention_months: 36, document_type: 'dqf', sort_order: 2 },
  { sub_category: 'mvr', display_name: 'Motor Vehicle Record (MVR)', regulation_reference: '49 CFR 391.25', renewal_period_months: 12, retention_months: 36, document_type: 'dqf', sort_order: 3 },
  { sub_category: 'drug_alcohol_testing', display_name: 'Drug & Alcohol Testing', regulation_reference: '49 CFR 382.301', renewal_period_months: null, retention_months: 60, document_type: 'dqf', sort_order: 4 },
  { sub_category: 'road_test_cert', display_name: 'Road Test Certificate', regulation_reference: '49 CFR 391.31', renewal_period_months: null, retention_months: 36, document_type: 'dqf', sort_order: 5 },
  { sub_category: 'employment_application', display_name: 'Employment Application', regulation_reference: '49 CFR 391.21', renewal_period_months: null, retention_months: 36, document_type: 'dqf', sort_order: 6 },
  { sub_category: 'employer_verification', display_name: 'Previous Employer Verification', regulation_reference: '49 CFR 391.23', renewal_period_months: null, retention_months: 36, document_type: 'dqf', sort_order: 7 },
  { sub_category: 'annual_review', display_name: 'Annual Review of Driving Record', regulation_reference: '49 CFR 391.25', renewal_period_months: 12, retention_months: 36, document_type: 'dqf', sort_order: 8 },
  { sub_category: 'violations_incidents', display_name: 'Violations & Incidents', regulation_reference: '49 CFR 391.27', renewal_period_months: null, retention_months: 36, document_type: 'dqf', sort_order: 9 },
  // Vehicle requirements
  { sub_category: 'registration_title', display_name: 'Registration & Title', regulation_reference: '49 CFR 396', renewal_period_months: 12, retention_months: 18, document_type: 'vehicle_qualification', sort_order: 10 },
  { sub_category: 'annual_dot_inspection', display_name: 'Annual DOT Inspection', regulation_reference: '49 CFR 396.17', renewal_period_months: 12, retention_months: 14, document_type: 'vehicle_qualification', sort_order: 11 },
  { sub_category: 'insurance', display_name: 'Insurance (Liability/Cargo)', regulation_reference: '49 CFR 387', renewal_period_months: 12, retention_months: 18, document_type: 'vehicle_qualification', sort_order: 12 },
  { sub_category: 'dvir', display_name: 'DVIR (Pre/Post Trip)', regulation_reference: '49 CFR 396.11', renewal_period_months: null, retention_months: 3, document_type: 'vehicle_qualification', sort_order: 13 },
  { sub_category: 'maintenance_records', display_name: 'Maintenance Records', regulation_reference: '49 CFR 396.3', renewal_period_months: null, retention_months: 18, document_type: 'vehicle_qualification', sort_order: 14 },
  { sub_category: 'permits', display_name: 'Permits (IRP/IFTA/OS&OW)', regulation_reference: 'State DOT', renewal_period_months: 12, retention_months: 18, document_type: 'vehicle_qualification', sort_order: 15 },
  // Company requirements
  { sub_category: 'operating_authority', display_name: 'Operating Authority (MC/DOT)', regulation_reference: '49 CFR Part 365', renewal_period_months: 24, retention_months: null, document_type: 'company_document', sort_order: 16 },
  { sub_category: 'boc3', display_name: 'BOC-3 Process Agent', regulation_reference: '49 CFR 366', renewal_period_months: 12, retention_months: null, document_type: 'company_document', sort_order: 17 },
  { sub_category: 'ucr', display_name: 'UCR Registration', regulation_reference: '49 CFR 387', renewal_period_months: 12, retention_months: null, document_type: 'company_document', sort_order: 18 },
  { sub_category: 'insurance_certificates', display_name: 'Insurance Certificates (MCS-90)', regulation_reference: '49 CFR 387.9', renewal_period_months: 12, retention_months: null, document_type: 'company_document', sort_order: 19 },
  { sub_category: 'drug_alcohol_policy', display_name: 'Drug & Alcohol Policy', regulation_reference: '49 CFR 382', renewal_period_months: 12, retention_months: 60, document_type: 'company_document', sort_order: 20 },
  { sub_category: 'safety_rating', display_name: 'FMCSA Safety Rating', regulation_reference: '49 CFR 385', renewal_period_months: null, retention_months: null, document_type: 'company_document', sort_order: 21 },
]

export async function seedComplianceRequirements() {
  const auth = await authorize('compliance.create')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const rows = FMCSA_REQUIREMENTS.map(req => ({
    tenant_id: tenantId,
    document_type: req.document_type,
    sub_category: req.sub_category,
    display_name: req.display_name,
    description: null,
    regulation_reference: req.regulation_reference,
    renewal_period_months: req.renewal_period_months,
    retention_months: req.retention_months,
    is_active: true,
    sort_order: req.sort_order,
  }))

  const { error } = await supabase
    .from('compliance_requirements')
    .upsert(rows, { onConflict: 'tenant_id,sub_category,document_type', ignoreDuplicates: true })

  if (error) {
    return { error: safeError(error, 'seedComplianceRequirements') }
  }

  revalidatePath('/compliance')
  void cacheInvalidate(tenantId, 'compliance-overview')
  return { success: true }
}

// ============================================================================
// Custom Folder Management
// ============================================================================

const createFolderSchema = z.object({
  documentType: z.enum(['dqf', 'vehicle_qualification', 'company_document']),
  label: z.string().min(1, 'Folder name is required').max(80),
})

/**
 * Slugify a user-entered folder name into a sub_category key.
 * Prefixed with `custom_` to distinguish from FMCSA predefined categories.
 */
function slugifyFolderName(label: string): string {
  const slug = label
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
  return `custom_${slug || 'folder'}`
}

export async function createCustomFolder(data: unknown) {
  const parsed = createFolderSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const auth = await authorize('compliance.create', {
    rateLimit: { key: 'createCustomFolder', limit: 20, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const subCategory = slugifyFolderName(parsed.data.label)

  // Determine sort_order: place after the highest existing sort_order for this document_type
  const { data: lastSortRow } = await supabase
    .from('compliance_requirements')
    .select('sort_order')
    .eq('tenant_id', tenantId)
    .eq('document_type', parsed.data.documentType)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextSortOrder = (lastSortRow?.sort_order ?? 99) + 1

  const { error } = await supabase
    .from('compliance_requirements')
    .insert({
      tenant_id: tenantId,
      document_type: parsed.data.documentType,
      sub_category: subCategory,
      display_name: parsed.data.label.trim(),
      is_active: true,
      sort_order: nextSortOrder,
    })

  if (error) {
    if (error.code === '23505') {
      return { error: 'A folder with this name already exists' }
    }
    return { error: safeError(error, 'createCustomFolder') }
  }

  revalidatePath('/compliance')
  void cacheInvalidate(tenantId, 'compliance-overview')
  return { success: true, subCategory }
}

const deleteFolderSchema = z.object({
  documentType: z.enum(['dqf', 'vehicle_qualification', 'company_document']),
  subCategory: z.string().min(1),
})

export async function deleteCustomFolder(data: unknown) {
  const parsed = deleteFolderSchema.safeParse(data)
  if (!parsed.success) return { error: 'Invalid folder' }

  const auth = await authorize('compliance.delete')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Safety: only allow deleting custom folders (sub_category prefixed with `custom_`)
  if (!parsed.data.subCategory.startsWith('custom_')) {
    return { error: 'Cannot delete predefined FMCSA folders' }
  }

  const { error } = await supabase
    .from('compliance_requirements')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('document_type', parsed.data.documentType)
    .eq('sub_category', parsed.data.subCategory)

  if (error) return { error: safeError(error, 'deleteCustomFolder') }

  revalidatePath('/compliance')
  void cacheInvalidate(tenantId, 'compliance-overview')
  return { success: true }
}
