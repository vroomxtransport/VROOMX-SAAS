-- ============================================================================
-- VroomX SaaS TMS - iOS Driver App Tables
-- Migration: 00006
-- Purpose: Vehicle inspections, photos, videos, damages, order attachments,
--          driver notifications, device tokens, driver auth columns, ETAs,
--          receipt URLs, storage bucket notes, RLS, triggers, indexes, Realtime
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. New Enum Types
-- ----------------------------------------------------------------------------
CREATE TYPE public.inspection_type AS ENUM ('pickup', 'delivery');

CREATE TYPE public.inspection_status AS ENUM ('in_progress', 'completed');

CREATE TYPE public.damage_type AS ENUM ('scratch', 'dent', 'chip', 'broken', 'missing');

CREATE TYPE public.photo_type AS ENUM (
  'odometer', 'front', 'left', 'right', 'rear', 'top',
  'key_vin', 'custom_1', 'custom_2', 'custom_3', 'custom_4', 'custom_5'
);

CREATE TYPE public.notification_type AS ENUM (
  'trip_assignment', 'status_change', 'dispatch_message', 'urgent'
);

-- ----------------------------------------------------------------------------
-- 2. ALTER Existing Tables
-- ----------------------------------------------------------------------------

-- Drivers: link to Supabase Auth users and add PIN support
ALTER TABLE public.drivers ADD COLUMN auth_user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.drivers ADD COLUMN pin_hash TEXT;
CREATE UNIQUE INDEX idx_drivers_auth_user_id ON public.drivers(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Orders: ETA columns for driver app
ALTER TABLE public.orders ADD COLUMN pickup_eta TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN delivery_eta TIMESTAMPTZ;

-- Trip Expenses: receipt photo URL
ALTER TABLE public.trip_expenses ADD COLUMN receipt_url TEXT;

-- ----------------------------------------------------------------------------
-- 3. Vehicle Inspections Table
-- ----------------------------------------------------------------------------
CREATE TABLE public.vehicle_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id),
  driver_id UUID NOT NULL REFERENCES public.drivers(id),
  inspection_type public.inspection_type NOT NULL,
  status public.inspection_status NOT NULL DEFAULT 'in_progress',
  odometer_reading INTEGER,
  interior_condition TEXT,
  notes TEXT,
  gps_latitude DOUBLE PRECISION,
  gps_longitude DOUBLE PRECISION,
  gps_address TEXT,
  driver_signature_url TEXT,
  customer_signature_url TEXT,
  customer_name TEXT,
  customer_notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. Inspection Photos Table
-- ----------------------------------------------------------------------------
CREATE TABLE public.inspection_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  inspection_id UUID NOT NULL REFERENCES public.vehicle_inspections(id) ON DELETE CASCADE,
  photo_type public.photo_type NOT NULL,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  upload_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. Inspection Videos Table
-- ----------------------------------------------------------------------------
CREATE TABLE public.inspection_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  inspection_id UUID NOT NULL REFERENCES public.vehicle_inspections(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  duration_seconds INTEGER,
  upload_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 6. Inspection Damages Table
-- ----------------------------------------------------------------------------
CREATE TABLE public.inspection_damages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  inspection_id UUID NOT NULL REFERENCES public.vehicle_inspections(id) ON DELETE CASCADE,
  damage_type public.damage_type NOT NULL,
  view TEXT NOT NULL,
  x_position DOUBLE PRECISION NOT NULL,
  y_position DOUBLE PRECISION NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 7. Order Attachments Table
-- ----------------------------------------------------------------------------
CREATE TABLE public.order_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 8. Driver Notifications Table
-- ----------------------------------------------------------------------------
CREATE TABLE public.driver_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id),
  notification_type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 9. Device Tokens Table
-- ----------------------------------------------------------------------------
CREATE TABLE public.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id),
  device_token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ios',
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(driver_id, device_token)
);

-- ----------------------------------------------------------------------------
-- 10. Indexes
-- ----------------------------------------------------------------------------

-- Vehicle Inspections
CREATE INDEX idx_vehicle_inspections_tenant_id ON public.vehicle_inspections(tenant_id);
CREATE INDEX idx_vehicle_inspections_order_id ON public.vehicle_inspections(tenant_id, order_id);
CREATE INDEX idx_vehicle_inspections_driver_id ON public.vehicle_inspections(tenant_id, driver_id);

-- Inspection Photos
CREATE INDEX idx_inspection_photos_tenant_id ON public.inspection_photos(tenant_id);
CREATE INDEX idx_inspection_photos_inspection_id ON public.inspection_photos(inspection_id);

-- Inspection Videos
CREATE INDEX idx_inspection_videos_tenant_id ON public.inspection_videos(tenant_id);
CREATE INDEX idx_inspection_videos_inspection_id ON public.inspection_videos(inspection_id);

-- Inspection Damages
CREATE INDEX idx_inspection_damages_tenant_id ON public.inspection_damages(tenant_id);
CREATE INDEX idx_inspection_damages_inspection_id ON public.inspection_damages(inspection_id);

-- Order Attachments
CREATE INDEX idx_order_attachments_tenant_id ON public.order_attachments(tenant_id);
CREATE INDEX idx_order_attachments_order_id ON public.order_attachments(tenant_id, order_id);

-- Driver Notifications
CREATE INDEX idx_driver_notifications_tenant_id ON public.driver_notifications(tenant_id);
CREATE INDEX idx_driver_notifications_driver_id ON public.driver_notifications(tenant_id, driver_id);
CREATE INDEX idx_driver_notifications_unread ON public.driver_notifications(tenant_id, driver_id) WHERE read_at IS NULL;

-- Device Tokens
CREATE INDEX idx_device_tokens_tenant_id ON public.device_tokens(tenant_id);
CREATE INDEX idx_device_tokens_driver_id ON public.device_tokens(driver_id);

-- ----------------------------------------------------------------------------
-- 11. Trigger: updated_at on vehicle_inspections
-- (only table with updated_at column among the new tables)
-- ----------------------------------------------------------------------------
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.vehicle_inspections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 12. RLS Policies: Vehicle Inspections
-- ----------------------------------------------------------------------------
ALTER TABLE public.vehicle_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicle_inspections_select" ON public.vehicle_inspections
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "vehicle_inspections_insert" ON public.vehicle_inspections
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "vehicle_inspections_update" ON public.vehicle_inspections
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "vehicle_inspections_delete" ON public.vehicle_inspections
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 13. RLS Policies: Inspection Photos
-- ----------------------------------------------------------------------------
ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspection_photos_select" ON public.inspection_photos
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "inspection_photos_insert" ON public.inspection_photos
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "inspection_photos_update" ON public.inspection_photos
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "inspection_photos_delete" ON public.inspection_photos
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 14. RLS Policies: Inspection Videos
-- ----------------------------------------------------------------------------
ALTER TABLE public.inspection_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspection_videos_select" ON public.inspection_videos
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "inspection_videos_insert" ON public.inspection_videos
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "inspection_videos_update" ON public.inspection_videos
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "inspection_videos_delete" ON public.inspection_videos
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 15. RLS Policies: Inspection Damages
-- ----------------------------------------------------------------------------
ALTER TABLE public.inspection_damages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspection_damages_select" ON public.inspection_damages
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "inspection_damages_insert" ON public.inspection_damages
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "inspection_damages_update" ON public.inspection_damages
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "inspection_damages_delete" ON public.inspection_damages
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 16. RLS Policies: Order Attachments
-- ----------------------------------------------------------------------------
ALTER TABLE public.order_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_attachments_select" ON public.order_attachments
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "order_attachments_insert" ON public.order_attachments
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "order_attachments_update" ON public.order_attachments
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "order_attachments_delete" ON public.order_attachments
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 17. RLS Policies: Driver Notifications
-- ----------------------------------------------------------------------------
ALTER TABLE public.driver_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_notifications_select" ON public.driver_notifications
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "driver_notifications_insert" ON public.driver_notifications
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "driver_notifications_update" ON public.driver_notifications
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "driver_notifications_delete" ON public.driver_notifications
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 18. RLS Policies: Device Tokens
-- ----------------------------------------------------------------------------
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device_tokens_select" ON public.device_tokens
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "device_tokens_insert" ON public.device_tokens
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "device_tokens_update" ON public.device_tokens
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "device_tokens_delete" ON public.device_tokens
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 19. Realtime Publication
-- ----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_inspections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_notifications;

-- ----------------------------------------------------------------------------
-- 20. Realtime Grants
-- ----------------------------------------------------------------------------
GRANT SELECT ON public.vehicle_inspections TO supabase_realtime;
GRANT SELECT ON public.inspection_photos TO supabase_realtime;
GRANT SELECT ON public.inspection_videos TO supabase_realtime;
GRANT SELECT ON public.inspection_damages TO supabase_realtime;
GRANT SELECT ON public.order_attachments TO supabase_realtime;
GRANT SELECT ON public.driver_notifications TO supabase_realtime;
GRANT SELECT ON public.device_tokens TO supabase_realtime;

-- ----------------------------------------------------------------------------
-- 21. Storage Buckets
-- NOTE: Create these storage buckets via Supabase Dashboard or CLI:
-- 1. inspection-media (private) - vehicle inspection photos and videos
-- 2. receipts (private) - trip expense receipt photos
-- 3. bol-documents (private) - bill of lading PDFs and documents
-- Storage RLS policies should check tenant_id from JWT
-- ----------------------------------------------------------------------------

-- ============================================================================
-- End of Migration 00006
-- ============================================================================
