-- ============================================================================
-- VroomX SaaS TMS - Restrict Tenants UPDATE RLS
-- Migration: 00009
-- Purpose: Limit authenticated users to only updating safe tenant fields.
--          Subscription-sensitive fields can only be changed by service role.
-- ============================================================================

-- Drop the overly permissive UPDATE policy
DROP POLICY IF EXISTS "tenant_isolation_update" ON public.tenants;

-- Create a restricted UPDATE policy.
-- WITH CHECK ensures subscription-sensitive columns remain unchanged.
-- Only service role (which bypasses RLS) can modify these fields.
CREATE POLICY "tenant_isolation_update_restricted" ON public.tenants
  FOR UPDATE TO authenticated
  USING (id = (SELECT public.get_tenant_id()))
  WITH CHECK (
    id = (SELECT public.get_tenant_id())
    AND plan = (SELECT t.plan FROM public.tenants t WHERE t.id = (SELECT public.get_tenant_id()))
    AND stripe_customer_id IS NOT DISTINCT FROM (SELECT t.stripe_customer_id FROM public.tenants t WHERE t.id = (SELECT public.get_tenant_id()))
    AND stripe_subscription_id IS NOT DISTINCT FROM (SELECT t.stripe_subscription_id FROM public.tenants t WHERE t.id = (SELECT public.get_tenant_id()))
    AND subscription_status = (SELECT t.subscription_status FROM public.tenants t WHERE t.id = (SELECT public.get_tenant_id()))
    AND is_suspended IS NOT DISTINCT FROM (SELECT t.is_suspended FROM public.tenants t WHERE t.id = (SELECT public.get_tenant_id()))
    AND grace_period_ends_at IS NOT DISTINCT FROM (SELECT t.grace_period_ends_at FROM public.tenants t WHERE t.id = (SELECT public.get_tenant_id()))
    AND trial_ends_at IS NOT DISTINCT FROM (SELECT t.trial_ends_at FROM public.tenants t WHERE t.id = (SELECT public.get_tenant_id()))
  );
