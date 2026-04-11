-- Wave 5: QuickBooks expense bidirectional sync — durable error state
--
-- Changes to quickbooks_entity_map so the per-truck ledger UI can display
-- pending / synced / error status for each expense row, and operators can
-- retry failed pushes without guessing which source table the expense
-- lives in.
--
-- Changes:
--   1. Make qb_id nullable. A row with qb_id=NULL + sync_error set
--      represents a failed sync attempt the UI should surface with a
--      "Retry" button. A row with qb_id=NOT NULL represents a successful
--      sync. Absence of a row means "never attempted" (pending).
--
--   2. Split the generic 'expense' entity_type into the four source
--      tables so the retry action knows which table to read from without
--      having to scan all four. Existing 'expense' rows are backfilled by
--      checking trip_expenses and business_expenses (the only two source
--      tables supported by the pre-Wave-5 syncExpenseToQB).
--
--   3. Lookup index on (tenant_id, vroomx_id) — the ledger query joins
--      entity_map by (tenant_id, vroomx_id) across all four expense
--      subtypes at once, so a specific covering index is cheaper than
--      the existing (tenant_id, entity_type, vroomx_id) index.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. qb_id nullable
-- ---------------------------------------------------------------------------

ALTER TABLE quickbooks_entity_map
  ALTER COLUMN qb_id DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Split entity_type='expense' into specific subtypes
-- ---------------------------------------------------------------------------

UPDATE quickbooks_entity_map
SET entity_type = 'expense_trip'
WHERE entity_type = 'expense'
  AND vroomx_id IN (SELECT id FROM trip_expenses);

UPDATE quickbooks_entity_map
SET entity_type = 'expense_business'
WHERE entity_type = 'expense'
  AND vroomx_id IN (SELECT id FROM business_expenses);

-- Any leftover 'expense' row is an orphan (source record deleted). Mark
-- as such so the ledger UI can hide them. This is a no-op if there are
-- none, which is the expected state for a fresh tenant.
UPDATE quickbooks_entity_map
SET entity_type = 'expense_orphan'
WHERE entity_type = 'expense';

-- ---------------------------------------------------------------------------
-- 3. Covering index for the per-truck ledger join
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_qb_entity_map_tenant_vroomx
  ON quickbooks_entity_map (tenant_id, vroomx_id);

COMMIT;
