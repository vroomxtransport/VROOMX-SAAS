-- Phase 1: Work Orders module schema foundation.
--
-- Adds shops + work_order_items + work_order_notes tables and enriches
-- maintenance_records with shop_id, wo_number, trailer_id, totals
-- (labor/parts/grand), closed_at, created_by. Existing maintenance_records
-- rows are backfilled as single-line labor items under a per-tenant
-- 'Default' internal shop. maintenance_status enum is widened with 'new'
-- and 'closed'.
--
-- The legacy cost / vendor columns on maintenance_records are retained
-- because src/lib/queries/truck-expense-ledger.ts still unions them into
-- the truck ledger. Phase 5 server actions will keep cost and grand_total
-- in sync; Phase 12 (or later) drops the legacy columns.
--
-- All statements are idempotent (DO $$ guards for CREATE TYPE, IF NOT
-- EXISTS on table/column/index, DROP POLICY IF EXISTS before CREATE
-- POLICY). The migration is wrapped in a single BEGIN/COMMIT. The
-- ALTER TYPE ADD VALUE statements are safe inside the transaction because
-- the new enum values ('new', 'closed') are not used in any DML within
-- this migration — backfills only touch shop_id, wo_number, and the
-- numeric totals.

BEGIN;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE shop_kind AS ENUM ('internal', 'external');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE work_order_item_kind AS ENUM ('labor', 'part');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE maintenance_status ADD VALUE IF NOT EXISTS 'new';
ALTER TYPE maintenance_status ADD VALUE IF NOT EXISTS 'closed';

-- ---------------------------------------------------------------------------
-- shops
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind shop_kind NOT NULL DEFAULT 'external',
  contact_name text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  zip text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shops_tenant_id ON shops (tenant_id);
CREATE INDEX IF NOT EXISTS idx_shops_tenant_active ON shops (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_shops_tenant_kind ON shops (tenant_id, kind);

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shops_select" ON public.shops;
CREATE POLICY "shops_select" ON public.shops
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

DROP POLICY IF EXISTS "shops_insert" ON public.shops;
CREATE POLICY "shops_insert" ON public.shops
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

DROP POLICY IF EXISTS "shops_update" ON public.shops;
CREATE POLICY "shops_update" ON public.shops
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

DROP POLICY IF EXISTS "shops_delete" ON public.shops;
CREATE POLICY "shops_delete" ON public.shops
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ---------------------------------------------------------------------------
-- maintenance_records enrichment (additive)
-- ---------------------------------------------------------------------------

ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS shop_id uuid REFERENCES shops(id);
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS wo_number integer;
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS trailer_id uuid REFERENCES trailers(id);
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS total_labor numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS total_parts numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS grand_total numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------

-- Per-tenant 'Default' internal shop (one per tenant)
INSERT INTO shops (tenant_id, name, kind)
SELECT t.id, 'Default', 'internal'
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM shops s WHERE s.tenant_id = t.id AND s.name = 'Default'
);

-- maintenance_records.shop_id -> per-tenant Default
UPDATE maintenance_records m
SET shop_id = s.id
FROM shops s
WHERE m.shop_id IS NULL
  AND s.tenant_id = m.tenant_id
  AND s.name = 'Default';

-- maintenance_records.wo_number sequential per tenant, starting at 1000
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at) + 999 AS n
  FROM maintenance_records
  WHERE wo_number IS NULL
)
UPDATE maintenance_records m
SET wo_number = numbered.n
FROM numbered
WHERE m.id = numbered.id;

-- Seed totals from the legacy cost column
UPDATE maintenance_records
SET grand_total = COALESCE(cost, 0),
    total_labor = COALESCE(cost, 0),
    total_parts = 0
WHERE grand_total = 0 AND total_labor = 0 AND total_parts = 0;

-- ---------------------------------------------------------------------------
-- Tighten constraints after backfill
-- ---------------------------------------------------------------------------

ALTER TABLE maintenance_records ALTER COLUMN shop_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_maintenance_records_tenant_wo_number
  ON maintenance_records (tenant_id, wo_number);

CREATE INDEX IF NOT EXISTS idx_maintenance_records_tenant_shop
  ON maintenance_records (tenant_id, shop_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_records_tenant_trailer
  ON maintenance_records (tenant_id, trailer_id);

-- ---------------------------------------------------------------------------
-- work_order_items
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS work_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE,
  kind work_order_item_kind NOT NULL,
  description text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_rate numeric(12,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  mechanic_name text,
  service_date date,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_order_items_tenant_id ON work_order_items (tenant_id);
CREATE INDEX IF NOT EXISTS idx_work_order_items_tenant_wo ON work_order_items (tenant_id, work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_items_tenant_kind ON work_order_items (tenant_id, kind);

ALTER TABLE work_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_order_items_select" ON public.work_order_items;
CREATE POLICY "work_order_items_select" ON public.work_order_items
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

DROP POLICY IF EXISTS "work_order_items_insert" ON public.work_order_items;
CREATE POLICY "work_order_items_insert" ON public.work_order_items
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

DROP POLICY IF EXISTS "work_order_items_update" ON public.work_order_items;
CREATE POLICY "work_order_items_update" ON public.work_order_items
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

DROP POLICY IF EXISTS "work_order_items_delete" ON public.work_order_items;
CREATE POLICY "work_order_items_delete" ON public.work_order_items
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- Backfill: one labor line per existing maintenance_records row
INSERT INTO work_order_items (
  tenant_id, work_order_id, kind, description, quantity, unit_rate, amount, sort_order
)
SELECT
  mr.tenant_id,
  mr.id,
  'labor',
  COALESCE(NULLIF(mr.description, ''), 'Imported maintenance record'),
  1,
  mr.grand_total,
  mr.grand_total,
  0
FROM maintenance_records mr
WHERE NOT EXISTS (
  SELECT 1 FROM work_order_items woi WHERE woi.work_order_id = mr.id
);

-- ---------------------------------------------------------------------------
-- work_order_notes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS work_order_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_order_notes_tenant_id ON work_order_notes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_work_order_notes_tenant_wo ON work_order_notes (tenant_id, work_order_id);

ALTER TABLE work_order_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_order_notes_select" ON public.work_order_notes;
CREATE POLICY "work_order_notes_select" ON public.work_order_notes
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

DROP POLICY IF EXISTS "work_order_notes_insert" ON public.work_order_notes;
CREATE POLICY "work_order_notes_insert" ON public.work_order_notes
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

DROP POLICY IF EXISTS "work_order_notes_update" ON public.work_order_notes;
CREATE POLICY "work_order_notes_update" ON public.work_order_notes
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

DROP POLICY IF EXISTS "work_order_notes_delete" ON public.work_order_notes;
CREATE POLICY "work_order_notes_delete" ON public.work_order_notes
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuse existing public.handle_updated_at())
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS set_shops_updated_at ON shops;
CREATE TRIGGER set_shops_updated_at
  BEFORE UPDATE ON shops
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_work_order_items_updated_at ON work_order_items;
CREATE TRIGGER set_work_order_items_updated_at
  BEFORE UPDATE ON work_order_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMIT;
