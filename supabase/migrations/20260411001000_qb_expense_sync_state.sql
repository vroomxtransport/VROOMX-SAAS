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
-- 0. Expand entity_type CHECK constraint BEFORE the UPDATE backfill.
--
-- Wave 7 hardening: previously this migration ran the `UPDATE SET
-- entity_type = 'expense_trip'` blocks before the CHECK was expanded
-- (the CHECK expansion lived in a later migration, 20260411002000).
-- On prod that was safe only because the table happened to be empty
-- at apply time. On a fresh clone or any non-empty DB the UPDATE would
-- have aborted with 23514 check_violation. Moving the CHECK expansion
-- here makes this migration replay-safe for future fresh applies.
--
-- The prod DB already has the expanded CHECK from 20260411002000 —
-- dropping-and-recreating with the same values is a no-op.
-- ---------------------------------------------------------------------------

ALTER TABLE quickbooks_entity_map
  DROP CONSTRAINT IF EXISTS quickbooks_entity_map_entity_type_check;

ALTER TABLE quickbooks_entity_map
  ADD CONSTRAINT quickbooks_entity_map_entity_type_check
  CHECK (entity_type = ANY (ARRAY[
    'broker_customer',
    'driver_vendor',
    'order_invoice',
    'payment',
    'expense',
    'expense_trip',
    'expense_business',
    'expense_fuel',
    'expense_maintenance',
    'expense_orphan'
  ]));

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
