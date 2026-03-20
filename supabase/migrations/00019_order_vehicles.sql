-- Add multi-vehicle support to orders
-- vehicles JSONB array: [{vin, year, make, model, type, color}]
-- Flat vehicle columns remain for backward compat + search

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vehicles jsonb DEFAULT NULL;
