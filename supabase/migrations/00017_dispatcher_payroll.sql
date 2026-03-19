-- Dispatcher Payroll: enums, tables, order attribution, and RLS

-- New enum types
CREATE TYPE dispatcher_pay_type AS ENUM ('fixed_salary', 'performance_revenue');
CREATE TYPE pay_frequency AS ENUM ('weekly', 'biweekly', 'monthly');
CREATE TYPE payroll_period_status AS ENUM ('draft', 'approved', 'paid');

-- Add dispatcher attribution to orders
ALTER TABLE orders ADD COLUMN dispatched_by UUID;
CREATE INDEX idx_orders_tenant_dispatched_by ON orders (tenant_id, dispatched_by);

-- Dispatcher Pay Configs
CREATE TABLE dispatcher_pay_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  pay_type dispatcher_pay_type NOT NULL,
  pay_rate NUMERIC(12,2) NOT NULL,
  pay_frequency pay_frequency NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dispatcher_pay_configs_tenant_id ON dispatcher_pay_configs (tenant_id);
CREATE INDEX idx_dispatcher_pay_configs_tenant_user ON dispatcher_pay_configs (tenant_id, user_id);

ALTER TABLE dispatcher_pay_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON dispatcher_pay_configs
  FOR ALL
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Dispatcher Payroll Periods
CREATE TABLE dispatcher_payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  pay_type dispatcher_pay_type NOT NULL,
  pay_rate NUMERIC(12,2) NOT NULL,
  base_amount NUMERIC(12,2) DEFAULT '0',
  performance_amount NUMERIC(12,2) DEFAULT '0',
  total_amount NUMERIC(12,2) DEFAULT '0',
  order_count INTEGER DEFAULT 0,
  total_order_revenue NUMERIC(12,2) DEFAULT '0',
  status payroll_period_status NOT NULL DEFAULT 'draft',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dispatcher_payroll_periods_tenant_id ON dispatcher_payroll_periods (tenant_id);
CREATE INDEX idx_dispatcher_payroll_periods_tenant_user ON dispatcher_payroll_periods (tenant_id, user_id);
CREATE INDEX idx_dispatcher_payroll_periods_tenant_status ON dispatcher_payroll_periods (tenant_id, status);
CREATE INDEX idx_dispatcher_payroll_periods_tenant_dates ON dispatcher_payroll_periods (tenant_id, period_start, period_end);

ALTER TABLE dispatcher_payroll_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON dispatcher_payroll_periods
  FOR ALL
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);
