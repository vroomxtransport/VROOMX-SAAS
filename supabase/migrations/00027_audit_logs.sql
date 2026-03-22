-- Audit Logs: entity-agnostic audit trail for all TMS mutations
-- Covers trips, drivers, trucks, compliance, roles, expenses, etc.

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  description text NOT NULL,
  actor_id uuid NOT NULL,
  actor_email text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped RLS policies using get_tenant_id()
CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id());

-- No UPDATE or DELETE policies — audit logs are append-only

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_entity
  ON audit_logs(tenant_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
  ON audit_logs(tenant_id, created_at DESC);
