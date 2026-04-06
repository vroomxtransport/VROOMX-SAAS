-- Scheduled Reports table
-- Stores user-defined schedules for automated report email delivery.
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  report_id UUID NOT NULL REFERENCES custom_reports(id) ON DELETE CASCADE,
  schedule TEXT NOT NULL, -- 'daily' | 'weekly_monday' | 'weekly_friday' | 'monthly_1' | 'monthly_15'
  recipients JSONB NOT NULL,  -- string[] of email addresses
  format TEXT NOT NULL DEFAULT 'pdf', -- 'pdf' | 'excel' | 'csv'
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_tenant ON scheduled_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run_at);

ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "scheduled_reports_tenant_isolation" ON scheduled_reports
    FOR ALL USING (
      tenant_id = (SELECT (raw_app_meta_data->>'tenant_id')::uuid FROM auth.users WHERE id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
