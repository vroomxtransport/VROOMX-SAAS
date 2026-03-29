-- ============================================================================
-- Fuel Card Integration Tables
-- Multi Service Fuel Card (msfuelcard) integration for VroomX TMS
-- ============================================================================

-- --------------------------------------------------------------------------
-- fuelcard_integrations: one per tenant, stores API credentials + sync state
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fuelcard_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'msfuelcard',
  api_key_encrypted TEXT NOT NULL,
  account_number TEXT,
  company_name TEXT,
  sync_status TEXT NOT NULL DEFAULT 'active'
    CHECK (sync_status IN ('active', 'paused', 'error', 'disconnected')),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

-- RLS
ALTER TABLE fuelcard_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fuelcard_integrations_tenant_isolation" ON fuelcard_integrations
  USING (tenant_id = get_tenant_id())
  WITH CHECK (tenant_id = get_tenant_id());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fuelcard_integrations_tenant
  ON fuelcard_integrations(tenant_id);

-- --------------------------------------------------------------------------
-- fuelcard_transactions: raw transaction data synced from the fuel card API
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fuelcard_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'msfuelcard',
  external_transaction_id TEXT NOT NULL,
  transaction_date TIMESTAMPTZ NOT NULL,
  card_number TEXT NOT NULL,
  driver_name_on_card TEXT,
  vehicle_unit_on_card TEXT,
  product_type TEXT NOT NULL,
  gallons NUMERIC(12,2) NOT NULL DEFAULT 0,
  price_per_gallon NUMERIC(12,4) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  odometer INTEGER,
  location_name TEXT,
  city TEXT,
  state TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,

  -- VroomX matching
  matched_truck_id UUID REFERENCES trucks(id) ON DELETE SET NULL,
  matched_driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  match_status TEXT NOT NULL DEFAULT 'unmatched'
    CHECK (match_status IN ('matched', 'unmatched', 'manual')),

  -- Anomaly detection
  anomaly_flagged BOOLEAN NOT NULL DEFAULT false,
  anomaly_reason TEXT,

  -- Linked fuel_entry (if auto-created)
  fuel_entry_id UUID REFERENCES fuel_entries(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Dedup: one external transaction per tenant per provider
  UNIQUE (tenant_id, provider, external_transaction_id)
);

-- RLS
ALTER TABLE fuelcard_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fuelcard_transactions_tenant_isolation" ON fuelcard_transactions
  USING (tenant_id = get_tenant_id())
  WITH CHECK (tenant_id = get_tenant_id());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fuelcard_txn_tenant_date
  ON fuelcard_transactions(tenant_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_fuelcard_txn_tenant_truck
  ON fuelcard_transactions(tenant_id, matched_truck_id);
CREATE INDEX IF NOT EXISTS idx_fuelcard_txn_tenant_driver
  ON fuelcard_transactions(tenant_id, matched_driver_id);
CREATE INDEX IF NOT EXISTS idx_fuelcard_txn_anomaly
  ON fuelcard_transactions(tenant_id, anomaly_flagged)
  WHERE anomaly_flagged = true;
