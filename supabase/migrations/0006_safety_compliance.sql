-- Safety & Compliance Module Overhaul
-- Adds sub-categories to compliance_documents, creates safety_events and compliance_requirements tables

-- 1. Alter compliance_documents: add sub_category, status, is_required, regulation_reference
ALTER TABLE compliance_documents
  ADD COLUMN IF NOT EXISTS sub_category text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'valid',
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS regulation_reference text;

CREATE INDEX IF NOT EXISTS idx_compliance_sub ON compliance_documents(tenant_id, document_type, sub_category);
CREATE INDEX IF NOT EXISTS idx_compliance_entity_sub ON compliance_documents(tenant_id, entity_type, entity_id, sub_category);

-- 2. Create safety_events table
CREATE TABLE IF NOT EXISTS safety_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'minor',
  status text NOT NULL DEFAULT 'open',
  event_date date NOT NULL,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  truck_id uuid REFERENCES trucks(id) ON DELETE SET NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  vehicle_vin text,
  title text NOT NULL,
  description text,
  location text,
  location_state text,
  photos jsonb,
  financial_amount numeric(12,2),
  insurance_claim_number text,
  deduction_amount numeric(12,2),
  inspection_level text,
  violations_count integer DEFAULT 0,
  out_of_service boolean DEFAULT false,
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE safety_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "safety_events_select" ON safety_events FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY "safety_events_insert" ON safety_events FOR INSERT WITH CHECK (tenant_id = get_tenant_id());
CREATE POLICY "safety_events_update" ON safety_events FOR UPDATE USING (tenant_id = get_tenant_id());
CREATE POLICY "safety_events_delete" ON safety_events FOR DELETE USING (tenant_id = get_tenant_id());

CREATE INDEX IF NOT EXISTS idx_safety_events_tenant ON safety_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_safety_events_type ON safety_events(tenant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_safety_events_driver ON safety_events(tenant_id, driver_id);
CREATE INDEX IF NOT EXISTS idx_safety_events_truck ON safety_events(tenant_id, truck_id);
CREATE INDEX IF NOT EXISTS idx_safety_events_date ON safety_events(tenant_id, event_date);

-- 3. Create compliance_requirements table
CREATE TABLE IF NOT EXISTS compliance_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  sub_category text NOT NULL,
  display_name text NOT NULL,
  description text,
  regulation_reference text,
  renewal_period_months integer,
  retention_months integer,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, document_type, sub_category)
);

ALTER TABLE compliance_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_requirements_select" ON compliance_requirements FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY "compliance_requirements_insert" ON compliance_requirements FOR INSERT WITH CHECK (tenant_id = get_tenant_id());
CREATE POLICY "compliance_requirements_update" ON compliance_requirements FOR UPDATE USING (tenant_id = get_tenant_id());
CREATE POLICY "compliance_requirements_delete" ON compliance_requirements FOR DELETE USING (tenant_id = get_tenant_id());

CREATE INDEX IF NOT EXISTS idx_compliance_requirements_tenant ON compliance_requirements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_requirements_type ON compliance_requirements(tenant_id, document_type);
