import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Fire-and-forget helper to log entity-agnostic audit events.
 * Called from server actions AFTER the main mutation succeeds.
 * Never throws — audit logging should never break the primary action.
 */
export async function logAuditEvent(
  supabase: SupabaseClient,
  event: {
    tenantId: string
    entityType: string
    entityId: string
    action: string
    description: string
    actorId: string
    actorEmail?: string
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      tenant_id: event.tenantId,
      entity_type: event.entityType,
      entity_id: event.entityId,
      action: event.action,
      description: event.description,
      actor_id: event.actorId,
      actor_email: event.actorEmail ?? null,
      metadata: event.metadata ?? null,
    })

    if (error) {
      console.error('[audit-log] Failed to log audit event:', error.message)
    }
  } catch (err) {
    console.error('[audit-log] Unexpected error:', err)
  }
}
