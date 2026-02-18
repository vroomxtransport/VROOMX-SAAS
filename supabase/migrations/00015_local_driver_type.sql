-- Add local_driver to driver_type enum
ALTER TYPE public.driver_type ADD VALUE IF NOT EXISTS 'local_driver';
