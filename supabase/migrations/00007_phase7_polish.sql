-- ============================================================================
-- VroomX SaaS TMS - Phase 7 Polish & Launch Prep Tables
-- Migration: 00007
-- Purpose: Trailers, driver_documents, truck_documents tables with RLS,
--          trailer_id FK on trucks
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Trailers Table
-- ----------------------------------------------------------------------------
CREATE TABLE public.trailers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  trailer_number TEXT NOT NULL,
  trailer_type TEXT NOT NULL DEFAULT 'open',
  status TEXT NOT NULL DEFAULT 'active',
  year INTEGER,
  make TEXT,
  model TEXT,
  vin TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trailers_type_check CHECK (trailer_type IN ('open', 'enclosed', 'flatbed')),
  CONSTRAINT trailers_status_check CHECK (status IN ('active', 'inactive', 'maintenance'))
);

-- ----------------------------------------------------------------------------
-- 2. Driver Documents Table
-- ----------------------------------------------------------------------------
CREATE TABLE public.driver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INTEGER,
  expires_at DATE,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT driver_documents_type_check CHECK (document_type IN ('cdl', 'medical_card', 'mvr', 'other'))
);

-- ----------------------------------------------------------------------------
-- 3. Truck Documents Table
-- ----------------------------------------------------------------------------
CREATE TABLE public.truck_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  truck_id UUID NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INTEGER,
  expires_at DATE,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT truck_documents_type_check CHECK (document_type IN ('registration', 'insurance', 'inspection_cert', 'other'))
);

-- ----------------------------------------------------------------------------
-- 4. Add trailer_id to trucks
-- ----------------------------------------------------------------------------
ALTER TABLE public.trucks ADD COLUMN trailer_id UUID REFERENCES public.trailers(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 5. Indexes
-- ----------------------------------------------------------------------------

-- Trailers
CREATE INDEX idx_trailers_tenant_id ON public.trailers(tenant_id);
CREATE INDEX idx_trailers_tenant_number ON public.trailers(tenant_id, trailer_number);

-- Driver Documents
CREATE INDEX idx_driver_documents_tenant_id ON public.driver_documents(tenant_id);
CREATE INDEX idx_driver_documents_tenant_driver ON public.driver_documents(tenant_id, driver_id);

-- Truck Documents
CREATE INDEX idx_truck_documents_tenant_id ON public.truck_documents(tenant_id);
CREATE INDEX idx_truck_documents_tenant_truck ON public.truck_documents(tenant_id, truck_id);

-- ----------------------------------------------------------------------------
-- 6. Trigger: updated_at on trailers
-- ----------------------------------------------------------------------------
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.trailers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 7. RLS Policies: Trailers
-- ----------------------------------------------------------------------------
ALTER TABLE public.trailers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trailers_select" ON public.trailers
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "trailers_insert" ON public.trailers
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "trailers_update" ON public.trailers
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "trailers_delete" ON public.trailers
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 8. RLS Policies: Driver Documents
-- ----------------------------------------------------------------------------
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_documents_select" ON public.driver_documents
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "driver_documents_insert" ON public.driver_documents
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "driver_documents_update" ON public.driver_documents
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "driver_documents_delete" ON public.driver_documents
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 9. RLS Policies: Truck Documents
-- ----------------------------------------------------------------------------
ALTER TABLE public.truck_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "truck_documents_select" ON public.truck_documents
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "truck_documents_insert" ON public.truck_documents
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "truck_documents_update" ON public.truck_documents
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

CREATE POLICY "truck_documents_delete" ON public.truck_documents
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

-- ----------------------------------------------------------------------------
-- 10. Realtime Grants
-- ----------------------------------------------------------------------------
GRANT SELECT ON public.trailers TO supabase_realtime;
GRANT SELECT ON public.driver_documents TO supabase_realtime;
GRANT SELECT ON public.truck_documents TO supabase_realtime;

-- ============================================================================
-- End of Migration 00007
-- ============================================================================
