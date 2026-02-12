'use server'

import { createClient } from '@/lib/supabase/server'
import { documentSchema } from '@/lib/validations/document'
import { deleteFile } from '@/lib/storage'
import { revalidatePath } from 'next/cache'

type EntityType = 'driver' | 'truck'

function getTable(entityType: EntityType) {
  return entityType === 'driver' ? 'driver_documents' : 'truck_documents'
}

function getForeignKey(entityType: EntityType) {
  return entityType === 'driver' ? 'driver_id' : 'truck_id'
}

function getRevalidatePath(entityType: EntityType) {
  return entityType === 'driver' ? '/drivers' : '/trucks'
}

export async function createDocument(
  entityType: EntityType,
  entityId: string,
  data: unknown
) {
  const parsed = documentSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) {
    return { error: 'No tenant found' }
  }

  const table = getTable(entityType)
  const foreignKey = getForeignKey(entityType)

  const { data: doc, error } = await supabase
    .from(table)
    .insert({
      tenant_id: tenantId,
      [foreignKey]: entityId,
      document_type: parsed.data.documentType,
      file_name: parsed.data.fileName,
      storage_path: parsed.data.storagePath,
      file_size: parsed.data.fileSize || null,
      expires_at: parsed.data.expiresAt || null,
      uploaded_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath(getRevalidatePath(entityType))
  return { data: doc }
}

export async function deleteDocument(
  entityType: EntityType,
  documentId: string
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) {
    return { error: 'No tenant found' }
  }

  const table = getTable(entityType)

  // Fetch the document to get storage_path before deleting
  const { data: doc, error: fetchError } = await supabase
    .from(table)
    .select('storage_path')
    .eq('id', documentId)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchError || !doc) {
    return { error: fetchError?.message ?? 'Document not found' }
  }

  // Delete the file from Supabase Storage
  const storagePath = doc.storage_path as string
  if (storagePath) {
    const { error: storageError } = await deleteFile(
      supabase,
      'documents',
      storagePath
    )
    if (storageError) {
      // Log but don't block -- the DB record should still be removed
      console.error('Failed to delete file from storage:', storageError)
    }
  }

  // Delete the database record
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', documentId)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(getRevalidatePath(entityType))
  return { success: true }
}
