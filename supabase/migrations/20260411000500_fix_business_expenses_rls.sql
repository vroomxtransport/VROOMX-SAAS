-- Wave 5 prerequisite patch: fix business_expenses RLS policies to match
-- the project convention.
--
-- The 20260411000000_create_business_expenses.sql migration shipped a
-- single FOR ALL policy using `auth.jwt() -> 'app_metadata' ->> 'tenant_id'`.
-- That pattern does NOT match the rest of the codebase, which uses
-- `public.get_tenant_id()` and splits CRUD into four separate policies
-- (see 00003_trips_and_dispatch.sql for trip_expenses — the exact
-- analog table).
--
-- This migration drops the original policy and recreates it using the
-- canonical pattern.

BEGIN;

DROP POLICY IF EXISTS business_expenses_tenant_isolation ON business_expenses;

CREATE POLICY "business_expenses_select" ON public.business_expenses
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "business_expenses_insert" ON public.business_expenses
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "business_expenses_update" ON public.business_expenses
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "business_expenses_delete" ON public.business_expenses
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

COMMIT;
