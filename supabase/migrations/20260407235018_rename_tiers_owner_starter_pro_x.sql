-- ============================================================================
-- Migration: Rename tier system to owner_operator / starter_x / pro_x
-- ============================================================================
--
-- Context
-- -------
-- The legacy tier system used {trial, starter, pro, enterprise}. The new
-- product direction is three paid tiers with a trial period on each:
--
--   owner_operator  $29/mo  — 1 truck, 1 user  (solo operator)
--   starter_x       $49/mo  — 5 trucks, 3 users
--   pro_x           $149/mo — 20 trucks, 10 users
--
-- Enterprise is removed. `plan = 'trial'` is removed as a stored value —
-- the trial state now lives on `tenants.subscription_status = 'trialing'`,
-- which is the existing column and already supported by Stripe webhooks.
--
-- Pre-launch: no real paying tenants exist, so this migration wipes and
-- rewrites freely. The mapping rules are:
--
--   trial      -> owner_operator  (safest default for any seed/test data)
--   starter    -> starter_x
--   pro        -> pro_x
--   enterprise -> pro_x           (closest surviving tier)
--
-- This migration also rewrites the two SECURITY DEFINER tier-enforcement
-- triggers (`enforce_truck_limit`, `enforce_user_limit`) to use the new
-- tier names in their CASE statements, preserving the `SET search_path`
-- hardening from the earlier Wave 6 migration.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Rewrite existing tenant rows
-- ----------------------------------------------------------------------------

UPDATE public.tenants
SET plan = CASE plan
  WHEN 'trial'      THEN 'owner_operator'
  WHEN 'starter'    THEN 'starter_x'
  WHEN 'pro'        THEN 'pro_x'
  WHEN 'enterprise' THEN 'pro_x'
  ELSE plan
END
WHERE plan IN ('trial', 'starter', 'pro', 'enterprise');

-- ----------------------------------------------------------------------------
-- 2. Change the column default
-- ----------------------------------------------------------------------------

ALTER TABLE public.tenants
  ALTER COLUMN plan SET DEFAULT 'owner_operator';

-- ----------------------------------------------------------------------------
-- 3. Rewrite enforce_truck_limit() with new tier CASE
-- ----------------------------------------------------------------------------

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
    WHEN 'owner_operator' THEN 1
    WHEN 'starter_x'      THEN 5
    WHEN 'pro_x'          THEN 20
    ELSE 1  -- fail-safe: unknown plan gets the most restrictive limit
  END;

  SELECT COUNT(*) INTO current_count FROM public.trucks WHERE tenant_id = NEW.tenant_id;

  IF current_count >= max_trucks THEN
    RAISE EXCEPTION 'Truck limit reached for your plan (% of %). Please upgrade.', current_count, max_trucks;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 4. Rewrite enforce_user_limit() with new tier CASE
-- ----------------------------------------------------------------------------

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
    WHEN 'owner_operator' THEN 1
    WHEN 'starter_x'      THEN 3
    WHEN 'pro_x'          THEN 10
    ELSE 1  -- fail-safe: unknown plan gets the most restrictive limit
  END;

  SELECT COUNT(*) INTO current_count FROM public.tenant_memberships WHERE tenant_id = NEW.tenant_id;

  IF current_count >= max_users THEN
    RAISE EXCEPTION 'User limit reached for your plan (% of %). Please upgrade.', current_count, max_users;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 5. Self-verify: both trigger functions still have search_path hardening
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 6. Post-migration audit: confirm no legacy tier values remain
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  stragglers INTEGER;
BEGIN
  SELECT COUNT(*) INTO stragglers
  FROM public.tenants
  WHERE plan IN ('trial', 'starter', 'pro', 'enterprise');

  IF stragglers > 0 THEN
    RAISE EXCEPTION 'Tier rename migration left % tenants on legacy plan values', stragglers;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- End of tier rename migration
-- ============================================================================
