-- Cached Mapbox Directions geometry for the full ordered trip.
-- One continuous GeoJSON LineString through every stop in
-- `route_sequence`. Replaces the per-order polylines + dashed
-- straight-line connector with a single road-following polyline on
-- the trip route map.
--
-- All three columns are nullable and inherit existing trips RLS.
-- Backfill is intentionally NOT performed: legacy trips render the
-- old fallback until the dispatcher saves a sequence or clicks the
-- Recalculate button.

ALTER TABLE trips ADD COLUMN IF NOT EXISTS route_geometry         jsonb;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS route_distance_meters  numeric(14, 2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS route_duration_seconds integer;
