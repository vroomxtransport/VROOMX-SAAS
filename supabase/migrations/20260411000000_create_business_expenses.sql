-- Wave 5 prerequisite: create the missing business_expenses table.
--
-- The business_expenses feature was built in application code (Drizzle
-- schema at src/db/schema.ts:538, server actions at
-- src/app/actions/business-expenses.ts, query layer at
-- src/lib/queries/business-expenses.ts, ledger adapter at
-- src/lib/queries/truck-expense-ledger.ts::fetchBusinessExpensesForTruck)
-- but the DB migration was never emitted. This is a latent production
-- bug: any page that calls fetchBusinessExpensesForTruck (including the
-- Wave 2 per-truck P&L dashboard) would throw a "relation does not
-- exist" error against production Supabase.
--
-- Wave 1 / Wave 2 tests mocked the Supabase client so the missing table
-- wasn't caught until Wave 5 exploration tried to backfill entity_map
-- rows against it and hit a 42P01.
--
-- This migration emits exactly what the Drizzle declaration describes:
-- two enums, the table itself, three indexes, and the full tenant-scoped
-- RLS policy set.

BEGIN;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE business_expense_recurrence AS ENUM (
    'monthly', 'quarterly', 'annual', 'one_time'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE business_expense_category AS ENUM (
    'insurance', 'tolls_fixed', 'dispatch', 'parking', 'rent', 'telematics',
    'registration', 'salary', 'truck_lease', 'office_supplies', 'software',
    'professional_services', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS business_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category business_expense_category NOT NULL,
  recurrence business_expense_recurrence NOT NULL,
  amount numeric(12, 2) NOT NULL,
  truck_id uuid REFERENCES trucks(id),
  effective_from date NOT NULL,
  effective_to date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_expenses_tenant_id
  ON business_expenses (tenant_id);

CREATE INDEX IF NOT EXISTS idx_business_expenses_tenant_category
  ON business_expenses (tenant_id, category);

CREATE INDEX IF NOT EXISTS idx_business_expenses_tenant_recurrence
  ON business_expenses (tenant_id, recurrence);

-- Wave 1 query: fetchBusinessExpensesForTruck filters by truck_id and
-- overlap on the effective window. An explicit truck_id index helps.
CREATE INDEX IF NOT EXISTS idx_business_expenses_tenant_truck
  ON business_expenses (tenant_id, truck_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE business_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_expenses_tenant_isolation ON business_expenses;
CREATE POLICY business_expenses_tenant_isolation
  ON business_expenses
  FOR ALL
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- ---------------------------------------------------------------------------
-- updated_at trigger — match the convention used by other tables
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
  RETURNS TRIGGER AS $func$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $func$ LANGUAGE plpgsql;
EXCEPTION WHEN others THEN NULL; END $$;

DROP TRIGGER IF EXISTS set_business_expenses_updated_at ON business_expenses;
CREATE TRIGGER set_business_expenses_updated_at
  BEFORE UPDATE ON business_expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

COMMIT;
