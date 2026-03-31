-- Terminal Operations: Hub-and-Spoke Auto Hauling
-- Adds terminals, local_runs tables, evolves local_drives, adds new enums

-- ============================================================================
-- 1. New Enums
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE local_drive_type AS ENUM ('pickup_to_terminal', 'delivery_from_terminal', 'standalone');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE local_run_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add 'daily_salary' to driver_pay_type
ALTER TYPE driver_pay_type ADD VALUE IF NOT EXISTS 'daily_salary';

-- Add '2_car' and '3_car' to truck_type
ALTER TYPE truck_type ADD VALUE IF NOT EXISTS '2_car';
ALTER TYPE truck_type ADD VALUE IF NOT EXISTS '3_car';

-- ============================================================================
-- 2. New 'terminals' Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS terminals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  service_radius_miles INTEGER DEFAULT 200,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_create_local_drives BOOLEAN NOT NULL DEFAULT true,
  auto_create_states TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_terminals_tenant_id ON terminals(tenant_id);

-- RLS
ALTER TABLE terminals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terminals_select" ON terminals FOR SELECT TO authenticated USING (tenant_id = (SELECT public.get_tenant_id()));
CREATE POLICY "terminals_insert" ON terminals FOR INSERT TO authenticated WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));
CREATE POLICY "terminals_update" ON terminals FOR UPDATE TO authenticated USING (tenant_id = (SELECT public.get_tenant_id())) WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));
CREATE POLICY "terminals_delete" ON terminals FOR DELETE TO authenticated USING (tenant_id = (SELECT public.get_tenant_id()));

-- ============================================================================
-- 3. New 'local_runs' Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS local_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  terminal_id UUID REFERENCES terminals(id),
  driver_id UUID REFERENCES drivers(id),
  truck_id UUID REFERENCES trucks(id),
  type local_drive_type NOT NULL,
  status local_run_status NOT NULL DEFAULT 'planned',
  scheduled_date DATE,
  completed_date TIMESTAMPTZ,
  total_expense NUMERIC(12,2) DEFAULT '0',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_local_runs_tenant_id ON local_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_local_runs_tenant_status ON local_runs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_local_runs_tenant_terminal ON local_runs(tenant_id, terminal_id);
CREATE INDEX IF NOT EXISTS idx_local_runs_tenant_driver ON local_runs(tenant_id, driver_id);

-- RLS
ALTER TABLE local_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "local_runs_select" ON local_runs FOR SELECT TO authenticated USING (tenant_id = (SELECT public.get_tenant_id()));
CREATE POLICY "local_runs_insert" ON local_runs FOR INSERT TO authenticated WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));
CREATE POLICY "local_runs_update" ON local_runs FOR UPDATE TO authenticated USING (tenant_id = (SELECT public.get_tenant_id())) WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));
CREATE POLICY "local_runs_delete" ON local_runs FOR DELETE TO authenticated USING (tenant_id = (SELECT public.get_tenant_id()));

-- ============================================================================
-- 4. Evolve 'local_drives' — Add New Columns
-- ============================================================================

ALTER TABLE local_drives ADD COLUMN IF NOT EXISTS type local_drive_type NOT NULL DEFAULT 'standalone';
ALTER TABLE local_drives ADD COLUMN IF NOT EXISTS terminal_id UUID REFERENCES terminals(id);
ALTER TABLE local_drives ADD COLUMN IF NOT EXISTS local_run_id UUID REFERENCES local_runs(id);
ALTER TABLE local_drives ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id);
ALTER TABLE local_drives ADD COLUMN IF NOT EXISTS expense_amount NUMERIC(12,2) DEFAULT '0';
ALTER TABLE local_drives ADD COLUMN IF NOT EXISTS inspection_visibility TEXT DEFAULT 'internal';

CREATE INDEX IF NOT EXISTS idx_local_drives_tenant_terminal ON local_drives(tenant_id, terminal_id);
CREATE INDEX IF NOT EXISTS idx_local_drives_tenant_run ON local_drives(tenant_id, local_run_id);
CREATE INDEX IF NOT EXISTS idx_local_drives_tenant_trip ON local_drives(tenant_id, trip_id);

-- ============================================================================
-- 5. Add 'local_operations_expense' to 'trips'
-- ============================================================================

ALTER TABLE trips ADD COLUMN IF NOT EXISTS local_operations_expense NUMERIC(12,2) DEFAULT '0';
