-- CodeAuditX Critical #3: trips.version column for optimistic concurrency
--
-- Adds a monotonically-increasing version counter to the `trips` table so that
-- `recalculateTripFinancials()` in src/app/actions/trips.ts can perform a
-- compare-and-swap (CAS) on every write and detect concurrent recalculations
-- that would otherwise produce lost updates on the denormalized financial
-- totals (driver_pay, net_profit, total_revenue, etc.).
--
-- Root cause (prior behavior):
--   The recalc function performed a non-atomic SELECT orders -> compute ->
--   UPDATE trip cycle. Each statement was its own PgBouncer transaction, so
--   two concurrent requests editing different orders on the same trip could
--   each read a stale order set and then overwrite each other's writes. The
--   worst case was silently corrupted driver pay — exactly the scenario
--   .claude/CLAUDE.md flags as "carrier walk-away if wrong".
--
-- New behavior:
--   recalculateTripFinancials reads the current version alongside the trip
--   row, computes totals, then writes with
--     UPDATE trips SET ..., version = old_version + 1
--       WHERE id = X AND tenant_id = T AND version = old_version
--   If the UPDATE affects 0 rows, another writer has bumped the version
--   between read and write, so the TS side re-reads + recomputes + retries
--   (bounded to 5 attempts with exponential backoff). Tenant isolation is
--   preserved because the existing RLS policies on trips already filter by
--   tenant_id and the new column inherits those policies.
--
-- Backwards compatibility:
--   Existing rows get version = 0 via the DEFAULT clause. No rewrite.
--   Any existing writer that updates trips without bumping version
--   (updateTrip, deleteTrip, assignOrderToTrip direct writes, etc.) is fine:
--   the next recalc will simply CAS against version = 0 the same way as a
--   fresh row.

BEGIN;

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN trips.version IS
  'Optimistic concurrency control counter. Bumped by recalculateTripFinancials() on every successful write. Used by the TS CAS retry loop to detect concurrent recalculations that would otherwise lose updates on denormalized financial totals. See src/app/actions/trips.ts and .claude/plans/humming-discovering-flurry.md §5 item 3.';

COMMIT;
