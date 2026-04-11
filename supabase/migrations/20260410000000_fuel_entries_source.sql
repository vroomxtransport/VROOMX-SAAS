-- Wave 3: fuel_entries source tracking + Samsara odometer timestamp column
--
-- 1. Adds `source` + `source_external_id` to `fuel_entries` so rows can carry
--    their origin (manual vs integration) and a stable external id for dedup.
--    Pre-existing rows get backfilled to 'manual' via the ADD COLUMN DEFAULT.
--    Installs a partial unique index that enforces idempotency on integration
--    sync writes without blocking manual entries, plus a secondary index
--    optimising the per-truck ledger filter-by-source case.
--
-- 2. Adds `last_odometer_time` to `samsara_vehicles` so the Samsara odometer
--    sync has a dedicated timestamp column and no longer has to reuse
--    `last_location_time` (which is owned by the GPS sync). Without a
--    dedicated field the odometer sync would silently clobber the fleet
--    map's "last seen" timestamp on every full sync.
--
-- The ledger UI (Wave 2) already renders a source badge for each row — this
-- migration lights it up for Samsara (Wave 3) and is a prerequisite for the
-- EFS fuel card integration (Wave 4).

BEGIN;

-- ---------------------------------------------------------------------------
-- fuel_entries columns — DEFAULT on ADD COLUMN backfills existing rows via
-- catalog metadata in PG 11+; no rewrite, no separate UPDATE needed.
-- ---------------------------------------------------------------------------

ALTER TABLE fuel_entries
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

ALTER TABLE fuel_entries
  ADD COLUMN IF NOT EXISTS source_external_id text;

-- ---------------------------------------------------------------------------
-- Dedup index — partial unique so manual rows (with NULL source_external_id)
-- can coexist with integration rows. Scoped by tenant so two tenants can
-- have the same external id without collision.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS uq_fuel_entries_tenant_source_external
  ON fuel_entries (tenant_id, source, source_external_id)
  WHERE source_external_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Helper index: the per-truck ledger query filters by (truck_id, date)
-- heavily. Adding source to the covering index is cheap and lets the
-- planner skip a full row fetch when filtering ledger by source.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_fuel_entries_tenant_truck_source
  ON fuel_entries (tenant_id, truck_id, source);

-- ---------------------------------------------------------------------------
-- samsara_vehicles: dedicated odometer timestamp so the odometer sync path
-- doesn't collide with the GPS sync path on `last_location_time`.
-- ---------------------------------------------------------------------------

ALTER TABLE samsara_vehicles
  ADD COLUMN IF NOT EXISTS last_odometer_time timestamptz;

COMMIT;
