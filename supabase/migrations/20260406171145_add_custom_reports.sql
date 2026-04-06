-- Custom Reports table
CREATE TABLE IF NOT EXISTS custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_reports_tenant ON custom_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custom_reports_user ON custom_reports(tenant_id, user_id);

ALTER TABLE custom_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "custom_reports_tenant_isolation" ON custom_reports
    FOR ALL USING (
      tenant_id = (SELECT (raw_app_meta_data->>'tenant_id')::uuid FROM auth.users WHERE id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Saved Views table
CREATE TABLE IF NOT EXISTS saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  page_key TEXT NOT NULL,
  name TEXT NOT NULL,
  filters JSONB NOT NULL,
  sort_by TEXT,
  sort_direction TEXT,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_views_tenant ON saved_views(tenant_id);
CREATE INDEX IF NOT EXISTS idx_saved_views_page ON saved_views(tenant_id, page_key);

ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "saved_views_tenant_isolation" ON saved_views
    FOR ALL USING (
      tenant_id = (SELECT (raw_app_meta_data->>'tenant_id')::uuid FROM auth.users WHERE id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
