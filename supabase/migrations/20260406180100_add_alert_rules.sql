-- Alert Rules table
-- Stores tenant-configurable KPI threshold alerts with notification channels and cooldown.
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  metric TEXT NOT NULL,
  operator TEXT NOT NULL CHECK (operator IN ('gt', 'lt', 'gte', 'lte')),
  threshold NUMERIC(12, 2) NOT NULL,
  notify_in_app BOOLEAN NOT NULL DEFAULT true,
  notify_email BOOLEAN NOT NULL DEFAULT false,
  email_recipients JSONB,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  cooldown_minutes INTEGER NOT NULL DEFAULT 1440,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant ON alert_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant_enabled ON alert_rules(tenant_id, enabled);

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "alert_rules_tenant_isolation" ON alert_rules
    FOR ALL USING (
      tenant_id = (SELECT (raw_app_meta_data->>'tenant_id')::uuid FROM auth.users WHERE id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Alert History table
-- Immutable record of every alert trigger event.
CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  alert_rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  metric_value NUMERIC(12, 2) NOT NULL,
  threshold_value NUMERIC(12, 2) NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON alert_history(alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_tenant_triggered ON alert_history(tenant_id, triggered_at DESC);

ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "alert_history_tenant_isolation" ON alert_history
    FOR ALL USING (
      tenant_id = (SELECT (raw_app_meta_data->>'tenant_id')::uuid FROM auth.users WHERE id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
