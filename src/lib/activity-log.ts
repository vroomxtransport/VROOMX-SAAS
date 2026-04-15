import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Fire-and-forget helper to log order activity.
 * Called from server actions AFTER the main mutation succeeds.
 * Never throws — activity logging should never break the primary action.
 */
export async function logOrderActivity(
  supabase: SupabaseClient,
  params: {
    tenantId: string
    orderId: string
    action: string
    description: string
    actorId?: string
    actorEmail?: string
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  try {
    const { error } = await supabase.from('order_activity_logs').insert({
      tenant_id: params.tenantId,
      order_id: params.orderId,
      action: params.action,
      description: params.description,
      actor_id: params.actorId ?? null,
      actor_email: params.actorEmail ?? null,
      metadata: params.metadata ?? null,
    })

    if (error) {
      console.error('[activity-log] Failed to log order activity:', error.message)
    }
  } catch (err) {
    console.error('[activity-log] Unexpected error:', err)
  }
}

/**
 * Fire-and-forget helper to log work-order activity.
 * Mirrors logOrderActivity exactly — same shape, same fire-and-forget contract.
 * Never throws — activity logging should never break the primary action.
 */
export async function logWorkOrderActivity(
  supabase: SupabaseClient,
  params: {
    tenantId: string
    workOrderId: string
    action: string
    description: string
    actorId?: string
    actorEmail?: string
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  try {
    const { error } = await supabase.from('work_order_activity_logs').insert({
      tenant_id: params.tenantId,
      work_order_id: params.workOrderId,
      action: params.action,
      description: params.description,
      actor_id: params.actorId ?? null,
      actor_email: params.actorEmail ?? null,
      metadata: params.metadata ?? null,
    })

    if (error) {
      console.error('[activity-log] Failed to log work-order activity:', error.message)
    }
  } catch (err) {
    console.error('[activity-log] Unexpected error:', err)
  }
}
