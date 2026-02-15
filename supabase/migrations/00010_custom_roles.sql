-- ============================================================================
-- VroomX SaaS TMS - Custom Roles
-- Migration: 00010
-- Purpose: Add custom_roles table for tenant-defined permission-based roles.
-- ============================================================================

-- Custom roles table: tenant-specific roles with arbitrary permission sets
CREATE TABLE public.custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT custom_roles_tenant_name_unique UNIQUE(tenant_id, name)
);

-- Enable RLS
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies: tenant isolation
CREATE POLICY "custom_roles_select" ON public.custom_roles
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "custom_roles_insert" ON public.custom_roles
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "custom_roles_update" ON public.custom_roles
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "custom_roles_delete" ON public.custom_roles
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- Index for efficient lookups
CREATE INDEX idx_custom_roles_tenant_id ON public.custom_roles(tenant_id);

-- Migrate existing 'owner' roles to 'admin' in tenant_memberships
UPDATE public.tenant_memberships SET role = 'admin' WHERE role = 'owner';

-- Update the custom access token hook to map 'owner' to 'admin' for JWT claims
-- (existing owner users in auth.users app_metadata will be handled by the permissions system
--  which treats 'owner' identically to 'admin')
