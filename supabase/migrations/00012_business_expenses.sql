-- Business Expenses table for P&L tracking
-- Supports both recurring (fixed) and one-time business expenses

-- Enums
CREATE TYPE business_expense_recurrence AS ENUM ('monthly', 'quarterly', 'annual', 'one_time');
CREATE TYPE business_expense_category AS ENUM (
  'insurance', 'tolls_fixed', 'dispatch', 'parking', 'rent', 'telematics',
  'registration', 'salary', 'truck_lease', 'office_supplies', 'software',
  'professional_services', 'other'
);

-- Table
CREATE TABLE business_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category business_expense_category NOT NULL,
  recurrence business_expense_recurrence NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  truck_id UUID REFERENCES trucks(id),
  effective_from DATE NOT NULL,
  effective_to DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_business_expenses_tenant_id ON business_expenses(tenant_id);
CREATE INDEX idx_business_expenses_tenant_category ON business_expenses(tenant_id, category);
CREATE INDEX idx_business_expenses_tenant_recurrence ON business_expenses(tenant_id, recurrence);

-- RLS
ALTER TABLE business_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON business_expenses
  FOR ALL
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);
