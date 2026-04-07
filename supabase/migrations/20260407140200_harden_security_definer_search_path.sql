-- CFG-004: the two tier-enforcement trigger functions in
-- 00005_phase5_invites_tier_enforcement.sql are SECURITY DEFINER but
-- missing an explicit `SET search_path`. That's the classic Postgres
-- privilege-escalation vector — a role with CREATE on a schema earlier
-- in the search path could plant a fake `tenants` table and subvert
-- the plan-limit check. Supabase's `authenticated` role does not have
-- that privilege by default, so the immediate exposure is bounded, but
-- the fix is cheap and brings these in line with
-- 20260406223000_add_auth_user_lookup_rpc.sql which already uses the
-- correct pattern.
--
-- Re-declare the functions with SET search_path = public, pg_temp.
-- Bodies are identical to the originals (read from lines 70-95 and
-- 102-127 of 00005_phase5_invites_tier_enforcement.sql).

CREATE OR REPLACE FUNCTION public.enforce_truck_limit()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_count INTEGER;
  tenant_plan TEXT;
  max_trucks INTEGER;
BEGIN
  SELECT plan INTO tenant_plan FROM public.tenants WHERE id = NEW.tenant_id;

  max_trucks := CASE tenant_plan
    WHEN 'starter' THEN 5
    WHEN 'pro' THEN 20
    WHEN 'enterprise' THEN 2147483647
    WHEN 'trial' THEN 5
    ELSE 5
  END;

  SELECT COUNT(*) INTO current_count FROM public.trucks WHERE tenant_id = NEW.tenant_id;

  IF current_count >= max_trucks THEN
    RAISE EXCEPTION 'Truck limit reached for your plan (% of %). Please upgrade.', current_count, max_trucks;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.enforce_user_limit()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_count INTEGER;
  tenant_plan TEXT;
  max_users INTEGER;
BEGIN
  SELECT plan INTO tenant_plan FROM public.tenants WHERE id = NEW.tenant_id;

  max_users := CASE tenant_plan
    WHEN 'starter' THEN 3
    WHEN 'pro' THEN 10
    WHEN 'enterprise' THEN 2147483647
    WHEN 'trial' THEN 3
    ELSE 3
  END;

  SELECT COUNT(*) INTO current_count FROM public.tenant_memberships WHERE tenant_id = NEW.tenant_id;

  IF current_count >= max_users THEN
    RAISE EXCEPTION 'User limit reached for your plan (% of %). Please upgrade.', current_count, max_users;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Self-verify: both functions must now have a proconfig containing search_path.
DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(proname, ', ')
  INTO bad
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('enforce_truck_limit', 'enforce_user_limit')
    AND (p.proconfig IS NULL OR NOT EXISTS (
      SELECT 1 FROM unnest(p.proconfig) AS cfg WHERE cfg LIKE 'search_path=%'
    ));

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'SECURITY DEFINER function still missing SET search_path: %', bad;
  END IF;
END $$;
