-- ============================================================================
-- Migration: Add CHECK constraint on tenants.plan
-- ============================================================================
--
-- Context
-- -------
-- Follow-up to 20260407235018_rename_tiers_owner_starter_pro_x.sql and the
-- tier-rename security audit finding H-1 / M-1.
--
-- The prior migration rewrote the tier-enforcement trigger CASE statements to
-- use ELSE 1 as the fail-safe. This means any write of an unrecognized plan
-- value silently clamps the tenant to 1 truck / 1 user at the next insert.
-- The Zod enum on signup + the webhook handler guard (just added) block the
-- known write paths, but neither is a DB-level invariant.
--
-- This migration makes invalid plan values impossible by construction with a
-- CHECK constraint. Any code that tries to write 'trial', 'starter', 'pro',
-- 'enterprise', 'unknown', or a typo will now hit a Postgres error at the DB
-- boundary instead of silently corrupting the tenant row.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Pre-check: every current row must already be a valid new-tier value.
--    The prior migration has a post-migration DO block that enforced this for
--    legacy values, but someone could have poked the DB between migrations.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM public.tenants
  WHERE plan NOT IN ('owner_operator', 'starter_x', 'pro_x');

  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Cannot add CHECK constraint: % tenants have plan values outside the allowed set', invalid_count;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Add the CHECK constraint
-- ----------------------------------------------------------------------------

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_plan_check
  CHECK (plan IN ('owner_operator', 'starter_x', 'pro_x'));

COMMIT;

-- ============================================================================
-- End of tenants.plan CHECK constraint migration
-- ============================================================================
