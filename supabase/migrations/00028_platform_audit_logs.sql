-- Platform Audit Logs: cross-tenant admin action trail
-- NO RLS — only accessed via service-role client from authorizeAdmin()

CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email text NOT NULL,
  action text NOT NULL,
  target_tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  description text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_created
  ON platform_audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_audit_tenant
  ON platform_audit_logs(target_tenant_id, created_at DESC);
