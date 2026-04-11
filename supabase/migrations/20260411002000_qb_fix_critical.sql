-- Wave 5 critical fixes — blocks two latent/regression bugs that would make
-- every QB expense sync a silent no-op.
--
-- 1) Add quickbooks_integrations.expense_account_id and income_account_id.
--    These columns are referenced by pre-existing code (src/app/actions/
--    quickbooks.ts::updateAccountMapping) AND by Wave 5's syncExpenseToQB,
--    but no prior migration actually added them to the database. The
--    short-circuit `if (!integration?.expense_account_id) return` has been
--    silently returning on every call since the feature shipped, making
--    QB expense sync a no-op pre-Wave-5 and making Wave 5 look like it
--    works while actually pushing nothing.
--
--    This was caught by the Wave 5 security-auditor pass (CRITICAL #2).
--    Not strictly a Wave 5 regression — Wave 5 inherited and enlarged the
--    broken surface — but fixing it is a hard prerequisite for Wave 5 to
--    function at all.
--
-- 2) Expand quickbooks_entity_map.entity_type CHECK constraint to allow
--    the new per-source subtypes introduced in 20260411001000. The prior
--    Wave 5 migration relied on UPDATE statements that should have failed
--    the CHECK, but the table happened to be empty in the prod DB so no
--    row violated the constraint at apply time. The constraint is still
--    installed with the old narrow list, so the first real insert from
--    syncExpenseToQB would 23514 abort the transaction.
--
--    Caught by the Wave 5 security-auditor pass (CRITICAL #1).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Missing account-mapping columns on quickbooks_integrations
-- ---------------------------------------------------------------------------

ALTER TABLE quickbooks_integrations
  ADD COLUMN IF NOT EXISTS expense_account_id text;

ALTER TABLE quickbooks_integrations
  ADD COLUMN IF NOT EXISTS income_account_id text;

-- ---------------------------------------------------------------------------
-- 2. Expand quickbooks_entity_map.entity_type CHECK constraint
-- ---------------------------------------------------------------------------

ALTER TABLE quickbooks_entity_map
  DROP CONSTRAINT IF EXISTS quickbooks_entity_map_entity_type_check;

ALTER TABLE quickbooks_entity_map
  ADD CONSTRAINT quickbooks_entity_map_entity_type_check
  CHECK (entity_type = ANY (ARRAY[
    -- Pre-Wave-5 values
    'broker_customer',
    'driver_vendor',
    'order_invoice',
    'payment',
    'expense',
    -- Wave 5 per-source subtypes
    'expense_trip',
    'expense_business',
    'expense_fuel',
    'expense_maintenance',
    -- Wave 5 orphan tombstone for rows whose source row was deleted
    'expense_orphan'
  ]));

COMMIT;
