-- ============================================================================
-- VroomX SaaS TMS - Phase 5: Invites, Dunning Columns, Tier Enforcement
-- Migration: 00005
-- Purpose: invites table, tenant dunning/onboarding columns, tier enforcement
--          triggers on trucks and tenant_memberships, RLS policies
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add columns to tenants table for dunning and onboarding
-- ----------------------------------------------------------------------------
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- ----------------------------------------------------------------------------
-- 2. Invites Table
-- Team member invitations with token-based acceptance
-- ----------------------------------------------------------------------------
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'dispatcher' CHECK (role IN ('admin', 'dispatcher', 'viewer')),
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  invited_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint on token
ALTER TABLE public.invites ADD CONSTRAINT invites_token_unique UNIQUE (token);

-- ----------------------------------------------------------------------------
-- 3. Indexes on invites
-- ----------------------------------------------------------------------------
CREATE INDEX idx_invites_tenant_id ON public.invites(tenant_id);
CREATE INDEX idx_invites_token ON public.invites(token);
CREATE INDEX idx_invites_email_tenant ON public.invites(tenant_id, email);

-- ----------------------------------------------------------------------------
-- 4. Trigger: updated_at on invites (reuses existing handle_updated_at function)
-- ----------------------------------------------------------------------------
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.invites
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 5. RLS Policies: Invites
-- SELECT and INSERT for authenticated (admin/owner can manage invites)
-- UPDATE and DELETE via service role only (acceptance flow)
-- ----------------------------------------------------------------------------
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invites_select" ON public.invites
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "invites_insert" ON public.invites
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 6. Tier Enforcement Triggers (SECURITY DEFINER)
-- Enforce truck and user limits based on tenant plan
-- ----------------------------------------------------------------------------

-- Truck limit enforcement
CREATE OR REPLACE FUNCTION public.enforce_truck_limit()
RETURNS TRIGGER AS $$
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
    WHEN 'trial' THEN 5  -- trial uses starter limits
    ELSE 5
  END;

  SELECT COUNT(*) INTO current_count FROM public.trucks WHERE tenant_id = NEW.tenant_id;

  IF current_count >= max_trucks THEN
    RAISE EXCEPTION 'Truck limit reached for your plan (% of %). Please upgrade.', current_count, max_trucks;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER check_truck_limit
  BEFORE INSERT ON public.trucks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_truck_limit();

-- User/member limit enforcement
CREATE OR REPLACE FUNCTION public.enforce_user_limit()
RETURNS TRIGGER AS $$
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
    WHEN 'trial' THEN 3  -- trial uses starter limits
    ELSE 3
  END;

  SELECT COUNT(*) INTO current_count FROM public.tenant_memberships WHERE tenant_id = NEW.tenant_id;

  IF current_count >= max_users THEN
    RAISE EXCEPTION 'User limit reached for your plan (% of %). Please upgrade.', current_count, max_users;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER check_user_limit
  BEFORE INSERT ON public.tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_limit();

-- ----------------------------------------------------------------------------
-- 7. Grants
-- ----------------------------------------------------------------------------

-- Authenticated role: SELECT + INSERT on invites
GRANT SELECT, INSERT ON public.invites TO authenticated;

-- Service role: full access on invites (for acceptance flow)
GRANT ALL ON public.invites TO service_role;

-- ============================================================================
-- End of Migration 00005
-- ============================================================================
