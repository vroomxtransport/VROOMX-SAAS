export type AuditSeverity = 'info' | 'warning' | 'critical'

const CRITICAL_EVENTS = new Set([
  'custom_role:deleted',
  'custom_role:updated',
  'membership:removed',
  'membership:role_changed',
  'tenant:suspended',
  'tenant:plan_changed',
  'billing:subscription_canceled',
  'auth:password_changed',
  'auth:mfa_disabled',
])

const WARNING_EVENTS = new Set([
  'driver:deleted',
  'truck:deleted',
  'order:deleted',
  'trip:deleted',
  'custom_role:created',
  'membership:invited',
  'compliance_doc:deleted',
  'integration:disconnected',
])

export function classifySeverity(entityType: string, action: string): AuditSeverity {
  const key = `${entityType}:${action}`
  if (CRITICAL_EVENTS.has(key)) return 'critical'
  if (WARNING_EVENTS.has(key)) return 'warning'
  return 'info'
}
