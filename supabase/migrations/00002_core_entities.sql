-- ============================================================================
-- VroomX SaaS TMS - Core Entities Schema
-- Migration: 00002
-- Purpose: Orders, Drivers, Trucks, Brokers tables with RLS, triggers, indexes
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enum Types
-- ----------------------------------------------------------------------------
CREATE TYPE public.order_status AS ENUM (
  'new', 'assigned', 'picked_up', 'delivered', 'invoiced', 'paid', 'cancelled'
);

CREATE TYPE public.payment_type AS ENUM (
  'COD', 'COP', 'CHECK', 'BILL', 'SPLIT'
);

CREATE TYPE public.driver_type AS ENUM (
  'company', 'owner_operator'
);

CREATE TYPE public.driver_status AS ENUM (
  'active', 'inactive'
);

CREATE TYPE public.truck_type AS ENUM (
  '7_car', '8_car', '9_car', 'flatbed', 'enclosed'
);

CREATE TYPE public.truck_status AS ENUM (
  'active', 'inactive', 'maintenance'
);

CREATE TYPE public.driver_pay_type AS ENUM (
  'percentage_of_carrier_pay', 'dispatch_fee_percent', 'per_mile'
);

CREATE TYPE public.payment_terms AS ENUM (
  'NET15', 'NET30', 'NET45', 'NET60'
);

-- ----------------------------------------------------------------------------
-- 2. Brokers Table
-- ----------------------------------------------------------------------------
CREATE TABLE public.brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  payment_terms public.payment_terms,
  factoring_company TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. Drivers Table
-- ----------------------------------------------------------------------------
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  license_number TEXT,
  driver_type public.driver_type NOT NULL DEFAULT 'company',
  driver_status public.driver_status NOT NULL DEFAULT 'active',
  pay_type public.driver_pay_type NOT NULL DEFAULT 'percentage_of_carrier_pay',
  pay_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. Trucks Table
-- ----------------------------------------------------------------------------
CREATE TABLE public.trucks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_number TEXT NOT NULL,
  truck_type public.truck_type NOT NULL DEFAULT '7_car',
  truck_status public.truck_status NOT NULL DEFAULT 'active',
  year INTEGER,
  make TEXT,
  model TEXT,
  vin TEXT,
  ownership TEXT DEFAULT 'company',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. Orders Table
-- ----------------------------------------------------------------------------
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_number TEXT,
  broker_id UUID REFERENCES public.brokers(id),
  driver_id UUID REFERENCES public.drivers(id),
  -- Vehicle
  vehicle_vin TEXT,
  vehicle_year INTEGER,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_type TEXT,
  vehicle_color TEXT,
  -- Status
  status public.order_status NOT NULL DEFAULT 'new',
  cancelled_reason TEXT,
  -- Pickup
  pickup_location TEXT,
  pickup_city TEXT,
  pickup_state TEXT,
  pickup_zip TEXT,
  pickup_contact_name TEXT,
  pickup_contact_phone TEXT,
  pickup_date DATE,
  -- Delivery
  delivery_location TEXT,
  delivery_city TEXT,
  delivery_state TEXT,
  delivery_zip TEXT,
  delivery_contact_name TEXT,
  delivery_contact_phone TEXT,
  delivery_date DATE,
  -- Actual dates
  actual_pickup_date TIMESTAMPTZ,
  actual_delivery_date TIMESTAMPTZ,
  -- Financial
  revenue NUMERIC(12,2) DEFAULT '0',
  carrier_pay NUMERIC(12,2) DEFAULT '0',
  broker_fee NUMERIC(12,2) DEFAULT '0',
  payment_type public.payment_type DEFAULT 'COP',
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 6. RLS Policies: Brokers
-- ----------------------------------------------------------------------------
ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brokers_select" ON public.brokers
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "brokers_insert" ON public.brokers
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "brokers_update" ON public.brokers
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "brokers_delete" ON public.brokers
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 7. RLS Policies: Drivers
-- ----------------------------------------------------------------------------
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drivers_select" ON public.drivers
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "drivers_insert" ON public.drivers
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "drivers_update" ON public.drivers
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "drivers_delete" ON public.drivers
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 8. RLS Policies: Trucks
-- ----------------------------------------------------------------------------
ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trucks_select" ON public.trucks
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "trucks_insert" ON public.trucks
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "trucks_update" ON public.trucks
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "trucks_delete" ON public.trucks
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 9. RLS Policies: Orders
-- ----------------------------------------------------------------------------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select" ON public.orders
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "orders_insert" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "orders_update" ON public.orders
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "orders_delete" ON public.orders
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 10. Indexes
-- ----------------------------------------------------------------------------

-- Brokers
CREATE INDEX idx_brokers_tenant_id ON public.brokers(tenant_id);

-- Drivers
CREATE INDEX idx_drivers_tenant_id ON public.drivers(tenant_id);
CREATE INDEX idx_drivers_tenant_status ON public.drivers(tenant_id, driver_status);

-- Trucks
CREATE INDEX idx_trucks_tenant_id ON public.trucks(tenant_id);
CREATE INDEX idx_trucks_tenant_status ON public.trucks(tenant_id, truck_status);

-- Orders
CREATE INDEX idx_orders_tenant_id ON public.orders(tenant_id);
CREATE INDEX idx_orders_tenant_status ON public.orders(tenant_id, status);
CREATE INDEX idx_orders_tenant_broker ON public.orders(tenant_id, broker_id);
CREATE INDEX idx_orders_tenant_driver ON public.orders(tenant_id, driver_id);

-- ----------------------------------------------------------------------------
-- 11. Triggers: updated_at (reuses existing handle_updated_at function)
-- ----------------------------------------------------------------------------
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.brokers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.trucks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 12. Trigger: Auto-generate order numbers (per tenant, atomic)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  -- Atomic increment within tenant scope
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(order_number, '[^0-9]', '', 'g'), '') AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM public.orders
  WHERE tenant_id = NEW.tenant_id;

  NEW.order_number := 'ORD-' || LPAD(next_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION public.generate_order_number();

-- ----------------------------------------------------------------------------
-- 13. Realtime Grants
-- Required for Supabase Realtime to deliver events through RLS
-- ----------------------------------------------------------------------------
GRANT SELECT ON public.orders TO supabase_realtime;
GRANT SELECT ON public.drivers TO supabase_realtime;
GRANT SELECT ON public.trucks TO supabase_realtime;
GRANT SELECT ON public.brokers TO supabase_realtime;

-- ============================================================================
-- End of Migration 00002
-- ============================================================================
