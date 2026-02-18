'use server'

import { authorize, safeError } from '@/lib/authz'
import { complianceDocSchema } from '@/lib/validations/compliance'
import { deleteFile } from '@/lib/storage'
import { revalidatePath } from 'next/cache'

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
      notes: parsed.data.notes || null,
      file_name: parsed.data.fileName || null,
      storage_path: parsed.data.storagePath || null,
      file_size: parsed.data.fileSize || null,
      uploaded_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'createComplianceDoc') }
  }

  revalidatePath('/compliance')
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
      notes: parsed.data.notes || null,
      file_name: parsed.data.fileName || null,
      storage_path: parsed.data.storagePath || null,
      file_size: parsed.data.fileSize || null,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'updateComplianceDoc') }
  }

  revalidatePath('/compliance')
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
    return { error: safeError(fetchError, 'deleteComplianceDoc') }
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
  return { success: true }
}
