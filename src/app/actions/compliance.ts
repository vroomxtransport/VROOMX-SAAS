'use server'

import { createClient } from '@/lib/supabase/server'
import { complianceDocSchema } from '@/lib/validations/compliance'
import { revalidatePath } from 'next/cache'

export async function createComplianceDoc(data: unknown) {
  const parsed = complianceDocSchema.safeParse(data)
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
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/compliance')
  return { data: doc }
}

export async function updateComplianceDoc(id: string, data: unknown) {
  const parsed = complianceDocSchema.safeParse(data)
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

  const { data: doc, error } = await supabase
    .from('compliance_documents')
    .update({
      document_type: parsed.data.documentType,
      entity_type: parsed.data.entityType,
      entity_id: parsed.data.entityId || null,
      name: parsed.data.name,
      expires_at: parsed.data.expiresAt || null,
      notes: parsed.data.notes || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/compliance')
  return { data: doc }
}

export async function deleteComplianceDoc(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('compliance_documents')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/compliance')
  return { success: true }
}
