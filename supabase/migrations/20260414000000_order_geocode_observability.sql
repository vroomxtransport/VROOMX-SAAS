-- Add geocode status, last error, and cached Mapbox route geometry to orders.
-- Gives the app a way to surface silent geocode failures, support a
-- Recalculate Distance action, and serve the trip-route map view without
-- re-fetching Mapbox Directions on every render.
--
-- All three columns are nullable and inherit the existing orders RLS
-- policies — no policy changes required.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS geocode_status text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS geocode_error  text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS route_geometry jsonb;
