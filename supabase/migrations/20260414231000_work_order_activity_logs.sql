-- Issue 3: work_order_activity_logs
-- Append-only audit trail mirroring order_activity_logs.
-- SELECT + INSERT only (no UPDATE, no DELETE — log is immutable).

BEGIN;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.work_order_activity_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  work_order_id   uuid        NOT NULL REFERENCES public.maintenance_records(id) ON DELETE CASCADE,
  action          text        NOT NULL,
  description     text        NOT NULL,
  actor_id        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email     text,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_work_order_activity_logs_tenant_wo_created
  ON public.work_order_activity_logs (tenant_id, work_order_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS — enable + SELECT/INSERT only (append-only, no update/delete)
-- ---------------------------------------------------------------------------

ALTER TABLE public.work_order_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_order_activity_logs_select" ON public.work_order_activity_logs;
CREATE POLICY "work_order_activity_logs_select" ON public.work_order_activity_logs
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT public.get_tenant_id()));

DROP POLICY IF EXISTS "work_order_activity_logs_insert" ON public.work_order_activity_logs;
CREATE POLICY "work_order_activity_logs_insert" ON public.work_order_activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

COMMIT;
