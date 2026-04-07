-- SCAN-001 (SEC-006 from security_todo.md): add WITH CHECK to payments_update.
--
-- The original policy in 00004_billing_invoicing.sql:76-78 gated the OLD row
-- via USING but had no WITH CHECK constraint on the NEW row. In PostgreSQL,
-- UPDATE policies need both: USING decides which rows the caller may SELECT
-- (and thus UPDATE), while WITH CHECK decides what the row is allowed to
-- look like AFTER the update. Without WITH CHECK, a tenant member could
-- UPDATE a payments row and rewrite tenant_id to another tenant — the
-- old-row filter passes (it was their row) and the new row is unconstrained.
--
-- This migration drops and recreates the policy with both clauses to match
-- the pattern used on orders_update / trips_update elsewhere in the schema.

DROP POLICY IF EXISTS "payments_update" ON public.payments;

CREATE POLICY "payments_update" ON public.payments
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

-- Self-verify: abort if the WITH CHECK expression didn't land.
DO $$
DECLARE
  with_check text;
BEGIN
  SELECT pg_get_expr(polwithcheck, polrelid)
  INTO with_check
  FROM pg_policy
  WHERE polname = 'payments_update'
    AND polrelid = 'public.payments'::regclass;

  IF with_check IS NULL THEN
    RAISE EXCEPTION 'payments_update policy is missing WITH CHECK after migration';
  END IF;
END $$;
