-- Add missing order_id column to local_drives table
-- Required for PostgREST embedded select: order:orders(...)

ALTER TABLE public.local_drives
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id);

-- Index for tenant + order_id lookups
CREATE INDEX IF NOT EXISTS idx_local_drives_tenant_order
  ON public.local_drives (tenant_id, order_id);
