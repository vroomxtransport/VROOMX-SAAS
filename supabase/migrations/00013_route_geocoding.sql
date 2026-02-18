-- 00013_route_geocoding.sql
-- Adds geocoding coordinates to orders and route sequencing to trips

-- Orders: pickup/delivery coordinates for map visualization
ALTER TABLE orders
  ADD COLUMN pickup_latitude double precision,
  ADD COLUMN pickup_longitude double precision,
  ADD COLUMN delivery_latitude double precision,
  ADD COLUMN delivery_longitude double precision;

-- Trips: ordered stop sequence for route planning
ALTER TABLE trips
  ADD COLUMN route_sequence jsonb;

-- No RLS changes needed — existing tenant_id policies cover new columns automatically
