-- ============================================================================
-- VroomX SaaS TMS - Trips & Dispatch Schema
-- Migration: 00003
-- Purpose: Trips, trip_expenses tables, trip_id on orders, per_car enum, RLS,
--          triggers, indexes, Realtime
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. New Enum Types
-- ----------------------------------------------------------------------------
CREATE TYPE public.trip_status AS ENUM (
  'planned', 'in_progress', 'at_terminal', 'completed'
);

CREATE TYPE public.expense_category AS ENUM (
  'fuel', 'tolls', 'repairs', 'lodging', 'misc'
);

-- ----------------------------------------------------------------------------
-- 2. Extend existing driver_pay_type enum
-- ----------------------------------------------------------------------------
ALTER TYPE public.driver_pay_type ADD VALUE 'per_car';

-- ----------------------------------------------------------------------------
-- 3. Trips Table
-- ----------------------------------------------------------------------------
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  trip_number TEXT,
  driver_id UUID NOT NULL REFERENCES public.drivers(id),
  truck_id UUID NOT NULL REFERENCES public.trucks(id),
  status public.trip_status NOT NULL DEFAULT 'planned',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  -- Manually entered financials
  carrier_pay NUMERIC(12,2) DEFAULT 0,
  -- Denormalized financial summary (computed by app code)
  total_revenue NUMERIC(12,2) DEFAULT 0,
  total_broker_fees NUMERIC(12,2) DEFAULT 0,
  driver_pay NUMERIC(12,2) DEFAULT 0,
  total_expenses NUMERIC(12,2) DEFAULT 0,
  net_profit NUMERIC(12,2) DEFAULT 0,
  order_count INTEGER DEFAULT 0,
  -- Denormalized route summary (computed by app code from assigned orders)
  origin_summary TEXT,
  destination_summary TEXT,
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. Trip Expenses Table
-- ----------------------------------------------------------------------------
CREATE TABLE public.trip_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  category public.expense_category NOT NULL DEFAULT 'misc',
  custom_label TEXT,
  amount NUMERIC(12,2) NOT NULL,
  notes TEXT,
  expense_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. Add trip_id to orders table
-- ----------------------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN trip_id UUID REFERENCES public.trips(id);
CREATE INDEX idx_orders_tenant_trip ON public.orders(tenant_id, trip_id);

-- ----------------------------------------------------------------------------
-- 6. Indexes
-- ----------------------------------------------------------------------------

-- Trips
CREATE INDEX idx_trips_tenant_id ON public.trips(tenant_id);
CREATE INDEX idx_trips_tenant_status ON public.trips(tenant_id, status);
CREATE INDEX idx_trips_tenant_driver ON public.trips(tenant_id, driver_id);
CREATE INDEX idx_trips_tenant_truck ON public.trips(tenant_id, truck_id);
CREATE INDEX idx_trips_tenant_dates ON public.trips(tenant_id, start_date, end_date);

-- Trip Expenses
CREATE INDEX idx_trip_expenses_tenant_id ON public.trip_expenses(tenant_id);
CREATE INDEX idx_trip_expenses_trip_id ON public.trip_expenses(trip_id);

-- ----------------------------------------------------------------------------
-- 7. Triggers: updated_at (reuses existing handle_updated_at function)
-- ----------------------------------------------------------------------------
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.trip_expenses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 8. Trigger: Auto-generate trip numbers (per tenant, atomic)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_trip_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  -- Atomic increment within tenant scope
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(trip_number, '[^0-9]', '', 'g'), '') AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM public.trips
  WHERE tenant_id = NEW.tenant_id;

  NEW.trip_number := 'TRIP-' || LPAD(next_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_trip_number
  BEFORE INSERT ON public.trips
  FOR EACH ROW
  WHEN (NEW.trip_number IS NULL)
  EXECUTE FUNCTION public.generate_trip_number();

-- ----------------------------------------------------------------------------
-- 9. RLS Policies: Trips
-- ----------------------------------------------------------------------------
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trips_select" ON public.trips
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "trips_insert" ON public.trips
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "trips_update" ON public.trips
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "trips_delete" ON public.trips
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 10. RLS Policies: Trip Expenses
-- ----------------------------------------------------------------------------
ALTER TABLE public.trip_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_expenses_select" ON public.trip_expenses
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "trip_expenses_insert" ON public.trip_expenses
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "trip_expenses_update" ON public.trip_expenses
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "trip_expenses_delete" ON public.trip_expenses
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 11. Realtime
-- ----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_expenses;

-- ----------------------------------------------------------------------------
-- 12. Realtime Grants
-- ----------------------------------------------------------------------------
GRANT SELECT ON public.trips TO supabase_realtime;
GRANT SELECT ON public.trip_expenses TO supabase_realtime;

-- ============================================================================
-- End of Migration 00003
-- ============================================================================
