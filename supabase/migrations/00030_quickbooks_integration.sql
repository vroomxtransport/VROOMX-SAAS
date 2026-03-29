-- ============================================================================
-- QuickBooks Online Integration Tables
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. quickbooks_integrations — One per tenant, stores OAuth tokens + config
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS quickbooks_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  realm_id TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ NOT NULL,
  company_name TEXT,
  sync_status TEXT NOT NULL DEFAULT 'active' CHECK (sync_status IN ('active', 'paused', 'error', 'disconnected')),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  webhook_verifier_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_qb_integrations_tenant ON quickbooks_integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_qb_integrations_realm ON quickbooks_integrations(realm_id);

ALTER TABLE quickbooks_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quickbooks_integrations_tenant_isolation" ON quickbooks_integrations
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "quickbooks_integrations_tenant_insert" ON quickbooks_integrations
  FOR INSERT WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "quickbooks_integrations_tenant_update" ON quickbooks_integrations
  FOR UPDATE USING (tenant_id IN (
    SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "quickbooks_integrations_tenant_delete" ON quickbooks_integrations
  FOR DELETE USING (tenant_id IN (
    SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
  ));

-- --------------------------------------------------------------------------
-- 2. quickbooks_entity_map — Maps VroomX entities to QB entities
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS quickbooks_entity_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('broker_customer', 'driver_vendor', 'order_invoice', 'payment', 'expense')),
  vroomx_id UUID NOT NULL,
  qb_id TEXT NOT NULL,
  qb_sync_token TEXT,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_type, vroomx_id)
);

CREATE INDEX IF NOT EXISTS idx_qb_entity_map_tenant ON quickbooks_entity_map(tenant_id);
CREATE INDEX IF NOT EXISTS idx_qb_entity_map_lookup ON quickbooks_entity_map(tenant_id, entity_type, vroomx_id);
CREATE INDEX IF NOT EXISTS idx_qb_entity_map_qb_id ON quickbooks_entity_map(tenant_id, entity_type, qb_id);

ALTER TABLE quickbooks_entity_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quickbooks_entity_map_tenant_isolation" ON quickbooks_entity_map
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "quickbooks_entity_map_tenant_insert" ON quickbooks_entity_map
  FOR INSERT WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "quickbooks_entity_map_tenant_update" ON quickbooks_entity_map
  FOR UPDATE USING (tenant_id IN (
    SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "quickbooks_entity_map_tenant_delete" ON quickbooks_entity_map
  FOR DELETE USING (tenant_id IN (
    SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
  ));

-- --------------------------------------------------------------------------
-- 3. quickbooks_webhook_events — Idempotency log for QB webhook processing
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS quickbooks_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  realm_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_qb_webhook_events_tenant ON quickbooks_webhook_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_qb_webhook_events_realm ON quickbooks_webhook_events(realm_id);
CREATE INDEX IF NOT EXISTS idx_qb_webhook_events_entity ON quickbooks_webhook_events(tenant_id, entity_type, entity_id);

ALTER TABLE quickbooks_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quickbooks_webhook_events_tenant_isolation" ON quickbooks_webhook_events
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "quickbooks_webhook_events_tenant_insert" ON quickbooks_webhook_events
  FOR INSERT WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
  ));
