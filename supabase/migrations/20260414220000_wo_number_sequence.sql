-- Atomic per-tenant work-order number allocation.
--
-- Audit finding HIGH-2: createWorkOrder/duplicateWorkOrder fell through to a
-- read-max-plus-one fallback on every call (the RPC was named but never
-- defined). Two concurrent creates on the same tenant could read the same
-- max(wo_number), both compute max+1, the second insert hit the unique index
-- and surfaced as a generic "unexpected error" toast.
--
-- This function takes a tenant-scoped pg advisory lock for the duration of
-- the calling transaction, then returns max+1 atomically. Service-role and
-- authenticated callers can both execute it; the SECURITY DEFINER lets the
-- function read maintenance_records for the lock SELECT even though the
-- caller's RLS scope doesn't include cross-tenant rows (we still filter by
-- p_tenant_id explicitly).

BEGIN;

CREATE OR REPLACE FUNCTION public.nextval_wo_number(p_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next integer;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id cannot be null';
  END IF;

  -- Tenant-scoped advisory lock — auto-released at COMMIT/ROLLBACK.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 0));

  SELECT COALESCE(MAX(wo_number), 999) + 1
    INTO v_next
    FROM public.maintenance_records
    WHERE tenant_id = p_tenant_id;

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.nextval_wo_number(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nextval_wo_number(uuid) TO authenticated, service_role;

COMMIT;
