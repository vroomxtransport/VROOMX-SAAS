-- ============================================================================
-- VroomX SaaS TMS - Initial Database Schema
-- Migration: 00001
-- Purpose: Multi-tenant foundation with RLS, JWT hooks, and Stripe integration
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper Function: get_tenant_id()
-- Used by all RLS policies to extract tenant_id from JWT
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS UUID AS $$
  SELECT ((auth.jwt()->'app_metadata'->>'tenant_id'))::uuid;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION public.get_tenant_id() TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Tenants Table
-- The root of multi-tenancy. Each tenant is a separate company/organization.
-- ----------------------------------------------------------------------------
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'trial',
  subscription_status TEXT NOT NULL DEFAULT 'trialing',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. Tenant Memberships Table
-- Links users to tenants with role-based access control
-- ----------------------------------------------------------------------------
CREATE TABLE public.tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'dispatcher', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 4. Stripe Events Table
-- Ensures webhook idempotency - prevents duplicate processing
-- ----------------------------------------------------------------------------
CREATE TABLE public.stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. RLS Policies: Tenants Table
-- Users can only see/update their own tenant
-- No INSERT/DELETE - managed via service role during signup/offboarding
-- ----------------------------------------------------------------------------
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.tenants
  FOR SELECT TO authenticated
  USING (id = (SELECT public.get_tenant_id()));

CREATE POLICY "tenant_isolation_update" ON public.tenants
  FOR UPDATE TO authenticated
  USING (id = (SELECT public.get_tenant_id()))
  WITH CHECK (id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 6. RLS Policies: Tenant Memberships Table
-- Users can only see/modify memberships within their tenant
-- ----------------------------------------------------------------------------
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.tenant_memberships
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "tenant_isolation_insert" ON public.tenant_memberships
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "tenant_isolation_update" ON public.tenant_memberships
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "tenant_isolation_delete" ON public.tenant_memberships
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 7. RLS Policies: Stripe Events Table
-- Service role only - no authenticated user access
-- ----------------------------------------------------------------------------
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated role. Only service_role can read/write.

-- ----------------------------------------------------------------------------
-- 8. Custom Access Token Hook
-- Injects tenant_id, role, plan, and subscription_status into JWT claims
-- This is the foundation of all authorization checks in the application
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  claims jsonb;
  tenant_membership RECORD;
BEGIN
  claims := event->'claims';

  -- Get user's first tenant membership (by creation date)
  SELECT tm.tenant_id, tm.role, t.plan, t.subscription_status
  INTO tenant_membership
  FROM public.tenant_memberships tm
  JOIN public.tenants t ON t.id = tm.tenant_id
  WHERE tm.user_id = (event->>'user_id')::uuid
  ORDER BY tm.created_at ASC
  LIMIT 1;

  -- If user has a tenant, inject tenant context into JWT
  IF tenant_membership IS NOT NULL THEN
    claims := jsonb_set(
      claims,
      '{app_metadata}',
      COALESCE(claims->'app_metadata', '{}'::jsonb) ||
      jsonb_build_object(
        'tenant_id', tenant_membership.tenant_id,
        'role', tenant_membership.role,
        'plan', tenant_membership.plan,
        'subscription_status', tenant_membership.subscription_status
      )
    );
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant execution to supabase_auth_admin (runs during JWT generation)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;
GRANT SELECT ON public.tenant_memberships TO supabase_auth_admin;
GRANT SELECT ON public.tenants TO supabase_auth_admin;

-- ----------------------------------------------------------------------------
-- 9. Triggers: updated_at Timestamp
-- Automatically updates updated_at column on any UPDATE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 10. Performance Indexes
-- Critical for multi-tenant query performance
-- ----------------------------------------------------------------------------
CREATE INDEX idx_tenant_memberships_user_id ON public.tenant_memberships(user_id);
CREATE INDEX idx_tenant_memberships_tenant_id ON public.tenant_memberships(tenant_id);
CREATE INDEX idx_tenants_stripe_customer_id ON public.tenants(stripe_customer_id);
CREATE INDEX idx_stripe_events_event_id ON public.stripe_events(event_id);

-- ============================================================================
-- End of Migration 00001
-- ============================================================================
