'use server'

import { authorize, safeError } from '@/lib/authz'
import { complianceDocSchema } from '@/lib/validations/compliance'
import { revalidatePath } from 'next/cache'

export async function createComplianceDoc(data: unknown) {
  const parsed = complianceDocSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('compliance.create', { rateLimit: { key: 'createComplianceDoc', limit: 30, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

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
    return { error: safeError(error, 'createComplianceDoc') }
  }

  revalidatePath('/compliance')
  return { data: doc }
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
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'updateComplianceDoc') }
  }

  revalidatePath('/compliance')
  return { data: doc }
}

export async function deleteComplianceDoc(id: string) {
  const auth = await authorize('compliance.delete')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

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
