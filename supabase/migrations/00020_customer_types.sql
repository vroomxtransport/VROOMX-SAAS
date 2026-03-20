-- Add customer type fields to pickup/delivery locations
-- Values: private, dealer, business, auction

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pickup_customer_type text DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_customer_type text DEFAULT NULL;
