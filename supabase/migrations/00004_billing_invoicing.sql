-- ============================================================================
-- VroomX SaaS TMS - Billing & Invoicing Schema
-- Migration: 00004
-- Purpose: payment_status enum, payments table, billing columns on orders,
--          company info columns on tenants, RLS, triggers, indexes, Realtime
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. New Enum Type: payment_status
-- ----------------------------------------------------------------------------
CREATE TYPE public.payment_status AS ENUM (
  'unpaid', 'invoiced', 'partially_paid', 'paid'
);

-- ----------------------------------------------------------------------------
-- 2. Add billing columns to orders table
-- ----------------------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN payment_status public.payment_status NOT NULL DEFAULT 'unpaid';
ALTER TABLE public.orders ADD COLUMN invoice_date TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN amount_paid NUMERIC(12,2) DEFAULT 0;

-- ----------------------------------------------------------------------------
-- 3. Add company info columns to tenants table (for invoice headers)
-- ----------------------------------------------------------------------------
ALTER TABLE public.tenants ADD COLUMN address TEXT;
ALTER TABLE public.tenants ADD COLUMN city TEXT;
ALTER TABLE public.tenants ADD COLUMN state TEXT;
ALTER TABLE public.tenants ADD COLUMN zip TEXT;
ALTER TABLE public.tenants ADD COLUMN phone TEXT;

-- ----------------------------------------------------------------------------
-- 4. Payments Table
-- ----------------------------------------------------------------------------
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. Indexes
-- ----------------------------------------------------------------------------

-- Orders billing indexes
CREATE INDEX idx_orders_tenant_payment_status ON public.orders(tenant_id, payment_status);
CREATE INDEX idx_orders_tenant_invoice_date ON public.orders(tenant_id, invoice_date);

-- Payments indexes
CREATE INDEX idx_payments_tenant_id ON public.payments(tenant_id);
CREATE INDEX idx_payments_order_id ON public.payments(order_id);

-- ----------------------------------------------------------------------------
-- 6. Trigger: updated_at on payments (reuses existing handle_updated_at function)
-- ----------------------------------------------------------------------------
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 7. RLS Policies: Payments
-- ----------------------------------------------------------------------------
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select" ON public.payments
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "payments_insert" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "payments_update" ON public.payments
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "payments_delete" ON public.payments
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 8. Realtime
-- ----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;

-- ----------------------------------------------------------------------------
-- 9. Realtime Grants
-- ----------------------------------------------------------------------------
GRANT SELECT ON public.payments TO supabase_realtime;

-- ============================================================================
-- End of Migration 00004
-- ============================================================================
