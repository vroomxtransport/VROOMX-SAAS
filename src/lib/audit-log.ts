import type { SupabaseClient } from '@supabase/supabase-js'
import { classifySeverity, type AuditSeverity } from './audit-severity'
import { computeIntegrityHash } from './audit-integrity'

/**
 * Fire-and-forget helper to log entity-agnostic audit events.
 * Called from server actions AFTER the main mutation succeeds.
 * Never throws — audit logging should never break the primary action.
 *
 * Enhanced for SOC 2 Type II: severity classification, SHA-256 hash chain,
 * change diff tracking, IP/UA forensics, critical event alerting.
 * All new fields are optional — existing 69+ callsites are unaffected.
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
    changeDiff?: { before: Record<string, unknown>; after: Record<string, unknown> }
    severity?: AuditSeverity
    ipAddress?: string
    userAgent?: string
  }
): Promise<void> {
  try {
    const severity = event.severity ?? classifySeverity(event.entityType, event.action)
    const createdAt = new Date().toISOString()

    // Fetch latest hash for chain (fire-and-forget, default to null on error)
    let previousHash: string | null = null
    try {
      const { data } = await supabase
        .from('audit_logs')
        .select('integrity_hash')
        .eq('tenant_id', event.tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      previousHash = data?.integrity_hash ?? null
    } catch {
      // Hash chain breaks gracefully — don't block the audit log insert
    }

    const integrityHash = computeIntegrityHash(previousHash, {
      tenantId: event.tenantId,
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      actorId: event.actorId,
      createdAt,
    })

    const { error } = await supabase.from('audit_logs').insert({
      tenant_id: event.tenantId,
      entity_type: event.entityType,
      entity_id: event.entityId,
      action: event.action,
      description: event.description,
      actor_id: event.actorId,
      actor_email: event.actorEmail ?? null,
      metadata: event.metadata ?? null,
      severity,
      change_diff: event.changeDiff ?? null,
      integrity_hash: integrityHash,
      previous_hash: previousHash,
      ip_address: event.ipAddress ?? null,
      user_agent: event.userAgent ?? null,
      created_at: createdAt,
    })

    if (error) {
      console.error('[audit-log] Failed to log audit event:', error.message)
      return
    }

    // Fire critical event alerts (non-blocking)
    if (severity === 'critical') {
      notifyCriticalEvent(supabase, event).catch(() => {})
    }
  } catch (err) {
    console.error('[audit-log] Unexpected error:', err)
  }
}

/**
 * When a critical event is logged, check if the tenant has an alert config
 * for it and notify admin/owner users via web_notifications.
 */
async function notifyCriticalEvent(
  supabase: SupabaseClient,
  event: { tenantId: string; entityType: string; action: string; description: string }
): Promise<void> {
  try {
    // Check if tenant has alert config for this event
    const { data: config } = await supabase
      .from('audit_alert_configs')
      .select('enabled, notify_in_app')
      .eq('tenant_id', event.tenantId)
      .eq('entity_type', event.entityType)
      .eq('action', event.action)
      .maybeSingle()

    if (!config?.enabled || !config?.notify_in_app) return

    // Get admin/owner user IDs
    const { data: members } = await supabase
      .from('tenant_memberships')
      .select('user_id')
      .eq('tenant_id', event.tenantId)
      .in('role', ['admin', 'owner'])

    if (!members?.length) return

    // Insert web_notifications for each admin/owner
    const notifications = members.map((m) => ({
      tenant_id: event.tenantId,
      user_id: m.user_id,
      type: 'audit_critical',
      title: `Critical: ${event.description}`,
      body: `${event.entityType} ${event.action} detected`,
      link: '/settings/audit-log',
    }))

    await supabase.from('web_notifications').insert(notifications)
  } catch (err) {
    console.error('[audit-log] Alert notification error:', err)
  }
}
