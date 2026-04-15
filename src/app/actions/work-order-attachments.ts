'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { authorize, safeError } from '@/lib/authz'
import { uploadFile, deleteFile } from '@/lib/storage'
import { logWorkOrderActivity } from '@/lib/activity-log'
import { captureAsyncError } from '@/lib/async-safe'
import type { WorkOrderAttachment } from '@/types/database'

const ATTACHMENT_BUCKET = 'attachments'
const uuidSchema = z.string().uuid()

type ActionErr = { error: string }

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Upload a file attachment to an existing work order.
 *
 * Authorization: maintenance.update — same permission required to edit any
 * WO field. Rate-limited to 30 uploads / minute per user.
 *
 * Security: we verify the WO belongs to the caller's tenant before touching
 * storage. This prevents a forged workOrderId from attaching files to
 * another tenant's work order even if RLS on work_order_attachments had a gap.
 */
export async function uploadWorkOrderAttachment(
  formData: FormData,
): Promise<({ success: true; attachment: WorkOrderAttachment }) | ActionErr> {
  const workOrderIdRaw = formData.get('workOrderId')
  const file = formData.get('file')

  const woParsed = uuidSchema.safeParse(workOrderIdRaw)
  if (!woParsed.success) return { error: 'Invalid work order id' }
  if (!(file instanceof File)) return { error: 'Missing file' }

  const workOrderId = woParsed.data

  try {
    const auth = await authorize('maintenance.update', {
      rateLimit: { key: 'uploadWorkOrderAttachment', limit: 30, windowMs: 60_000 },
    })
    if (!auth.ok) return { error: auth.error }
    const { supabase, tenantId, user } = auth.ctx

    // Verify the WO belongs to the caller's tenant before attaching.
    const { data: wo, error: woErr } = await supabase
      .from('maintenance_records')
      .select('id')
      .eq('id', workOrderId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (woErr) return { error: safeError(woErr, 'uploadWorkOrderAttachment.wo') }
    if (!wo) return { error: 'Work order not found' }

    const { path, error: uploadErr } = await uploadFile(
      supabase,
      ATTACHMENT_BUCKET,
      tenantId,
      workOrderId,
      file,
    )
    if (uploadErr || !path) {
      return { error: uploadErr ?? 'Upload failed' }
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('work_order_attachments')
      .insert({
        tenant_id: tenantId,
        work_order_id: workOrderId,
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        storage_path: path,
        file_size: file.size,
        uploaded_by: user.id,
      })
      .select('*')
      .single()

    if (insertErr || !inserted) {
      // Clean up the uploaded object so we don't leak storage on failure.
      await deleteFile(supabase, ATTACHMENT_BUCKET, path).catch(
        captureAsyncError('uploadWorkOrderAttachment.cleanup'),
      )
      return {
        error: safeError(
          insertErr ?? { message: 'insert failed' },
          'uploadWorkOrderAttachment.insert',
        ),
      }
    }

    logWorkOrderActivity(supabase, {
      tenantId,
      workOrderId,
      action: 'attachment_added',
      description: `Attachment uploaded: ${file.name}`,
      actorId: user.id,
      actorEmail: user.email,
    }).catch(captureAsyncError('logWorkOrderActivity'))

    revalidatePath(`/maintenance/${workOrderId}`)
    return { success: true, attachment: inserted as WorkOrderAttachment }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'uploadWorkOrderAttachment.throw') }
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Delete a work-order attachment by id.
 *
 * Authorization: maintenance.update.
 * Storage object is deleted first; if it succeeds and the DB delete fails,
 * we have an orphaned storage object (less bad than a dangling DB row).
 */
export async function deleteWorkOrderAttachment(
  id: string,
): Promise<{ success: true } | ActionErr> {
  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { error: 'Invalid attachment id' }

  try {
    const auth = await authorize('maintenance.update', {
      rateLimit: { key: 'deleteWorkOrderAttachment', limit: 60, windowMs: 60_000 },
    })
    if (!auth.ok) return { error: auth.error }
    const { supabase, tenantId, user } = auth.ctx

    // Fetch tenant-scoped row — this is our authorization check on the attachment.
    const { data: attachment, error: fetchErr } = await supabase
      .from('work_order_attachments')
      .select('id, work_order_id, file_name, storage_path')
      .eq('id', parsed.data)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (fetchErr) return { error: safeError(fetchErr, 'deleteWorkOrderAttachment.fetch') }
    if (!attachment) return { error: 'Attachment not found' }

    // Delete storage object first.
    await deleteFile(supabase, ATTACHMENT_BUCKET, attachment.storage_path).catch(
      captureAsyncError('deleteWorkOrderAttachment.storage'),
    )

    const { error: deleteErr } = await supabase
      .from('work_order_attachments')
      .delete()
      .eq('id', parsed.data)
      .eq('tenant_id', tenantId)
    if (deleteErr) return { error: safeError(deleteErr, 'deleteWorkOrderAttachment.delete') }

    logWorkOrderActivity(supabase, {
      tenantId,
      workOrderId: attachment.work_order_id,
      action: 'attachment_deleted',
      description: `Attachment deleted: ${attachment.file_name}`,
      actorId: user.id,
      actorEmail: user.email,
    }).catch(captureAsyncError('logWorkOrderActivity'))

    revalidatePath(`/maintenance/${attachment.work_order_id}`)
    return { success: true }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'deleteWorkOrderAttachment.throw') }
  }
}
