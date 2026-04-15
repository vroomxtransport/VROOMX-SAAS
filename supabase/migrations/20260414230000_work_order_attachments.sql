-- Issue 2: work_order_attachments
-- Mirrors the order_attachments pattern. RLS uses get_tenant_id() like shops.
-- Idempotent: IF NOT EXISTS on all DDL, DROP POLICY IF EXISTS before each CREATE POLICY.

BEGIN;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.work_order_attachments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  work_order_id   uuid        NOT NULL REFERENCES public.maintenance_records(id) ON DELETE CASCADE,
  file_name       text        NOT NULL,
  file_type       text        NOT NULL,
  storage_path    text        NOT NULL,
  file_size       integer,
  uploaded_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_work_order_attachments_tenant_id
  ON public.work_order_attachments (tenant_id);

CREATE INDEX IF NOT EXISTS idx_work_order_attachments_tenant_wo
  ON public.work_order_attachments (tenant_id, work_order_id);

CREATE INDEX IF NOT EXISTS idx_work_order_attachments_tenant_wo_created
  ON public.work_order_attachments (tenant_id, work_order_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS — enable + 4 policies matching the shops pattern exactly
-- ---------------------------------------------------------------------------

ALTER TABLE public.work_order_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_order_attachments_select" ON public.work_order_attachments;
CREATE POLICY "work_order_attachments_select" ON public.work_order_attachments
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

DROP POLICY IF EXISTS "work_order_attachments_insert" ON public.work_order_attachments;
CREATE POLICY "work_order_attachments_insert" ON public.work_order_attachments
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

DROP POLICY IF EXISTS "work_order_attachments_update" ON public.work_order_attachments;
CREATE POLICY "work_order_attachments_update" ON public.work_order_attachments
  FOR UPDATE TO authenticated
  USING  (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

DROP POLICY IF EXISTS "work_order_attachments_delete" ON public.work_order_attachments;
CREATE POLICY "work_order_attachments_delete" ON public.work_order_attachments
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

COMMIT;
