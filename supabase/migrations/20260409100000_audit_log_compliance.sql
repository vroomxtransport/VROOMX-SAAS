-- ============================================================================
-- Migration: Audit Log SOC 2 Type II Compliance
-- Adds severity, change_diff, integrity hash chain, IP/UA tracking to audit_logs
-- Creates audit_alert_configs and audit_archives tables
-- ============================================================================

-- 1. Extend audit_logs with compliance columns
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS change_diff jsonb;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS integrity_hash text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS previous_hash text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent text;

-- Severity filtering index (common SOC 2 query: "show all critical events")
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_severity
  ON audit_logs(tenant_id, severity, created_at DESC);

-- Hash chain verification index (sequential scan by tenant + time)
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_hash_chain
  ON audit_logs(tenant_id, created_at ASC);

-- Enable Realtime for audit_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'audit_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
  END IF;
END $$;

-- ============================================================================
-- 2. audit_alert_configs — per-tenant configurable alert preferences
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_alert_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  action text NOT NULL,
  severity text NOT NULL DEFAULT 'critical',
  enabled boolean NOT NULL DEFAULT true,
  notify_in_app boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, entity_type, action)
);

ALTER TABLE audit_alert_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_alert_configs_select" ON audit_alert_configs
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "audit_alert_configs_insert" ON audit_alert_configs
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id());

CREATE POLICY "audit_alert_configs_update" ON audit_alert_configs
  FOR UPDATE USING (tenant_id = get_tenant_id())
  WITH CHECK (tenant_id = get_tenant_id());

CREATE POLICY "audit_alert_configs_delete" ON audit_alert_configs
  FOR DELETE USING (tenant_id = get_tenant_id());

CREATE INDEX IF NOT EXISTS idx_audit_alert_configs_tenant
  ON audit_alert_configs(tenant_id);

-- ============================================================================
-- 3. audit_archives — metadata about archived log batches
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  archive_month text NOT NULL,
  date_range_start timestamptz NOT NULL,
  date_range_end timestamptz NOT NULL,
  record_count integer NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  file_size_bytes bigint,
  checksum text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, archive_month)
);

ALTER TABLE audit_archives ENABLE ROW LEVEL SECURITY;

-- Select only for authenticated users (insert/delete via service-role cron)
CREATE POLICY "audit_archives_select" ON audit_archives
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE INDEX IF NOT EXISTS idx_audit_archives_tenant
  ON audit_archives(tenant_id, archive_month DESC);

-- ============================================================================
-- 4. Storage bucket for archived audit logs
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('audit-archives', 'audit-archives', false, 52428800, ARRAY['application/json'])
ON CONFLICT (id) DO NOTHING;

-- Tenant-scoped read policy (folder name = tenant_id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'audit_archives_storage_select' AND tablename = 'objects'
  ) THEN
    CREATE POLICY audit_archives_storage_select ON storage.objects
    FOR SELECT USING (
      bucket_id = 'audit-archives'
      AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::text
    );
  END IF;
END $$;
