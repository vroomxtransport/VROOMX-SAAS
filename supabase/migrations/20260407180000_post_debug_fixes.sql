-- Post-debug fixes for driver onboarding pipeline
-- 1. Create the `documents` storage bucket (pre-existing gap — referenced by
--    multiple actions but never created in any migration)
-- 2. Add tenant-scoped RLS policies on storage.objects for the `documents` bucket
-- 3. Fix `approve_pipeline` RPC JSONB path — frontend writes under
--    `application_data.page1.applicantInfo.*` (camelCase, nested) but the RPC
--    was reading `application_data.applicant_info.*` (snake_case, flat).
--    Result: promoted drivers had NULL address/city/state/zip.

BEGIN;

-- ============================================================================
-- 1. Create `documents` storage bucket
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,                  -- not publicly readable
  26214400,               -- 25 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. RLS policies on storage.objects for the `documents` bucket
--    Path convention: {tenantId}/{entityId}/{uuid}.{ext}
--    First path segment = tenant_id as uuid
-- ============================================================================

-- Authenticated users can INSERT into their own tenant's folder
DROP POLICY IF EXISTS "documents_tenant_insert" ON storage.objects;
CREATE POLICY "documents_tenant_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1]::uuid = (SELECT public.get_tenant_id())
  );

-- Authenticated users can SELECT from their own tenant's folder
DROP POLICY IF EXISTS "documents_tenant_select" ON storage.objects;
CREATE POLICY "documents_tenant_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1]::uuid = (SELECT public.get_tenant_id())
  );

-- Authenticated users can UPDATE (rename/metadata) their own tenant's folder
DROP POLICY IF EXISTS "documents_tenant_update" ON storage.objects;
CREATE POLICY "documents_tenant_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1]::uuid = (SELECT public.get_tenant_id())
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1]::uuid = (SELECT public.get_tenant_id())
  );

-- Authenticated users can DELETE from their own tenant's folder
DROP POLICY IF EXISTS "documents_tenant_delete" ON storage.objects;
CREATE POLICY "documents_tenant_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1]::uuid = (SELECT public.get_tenant_id())
  );

-- Note: Public applicant uploads go through the service-role client (via
-- publicAuthForResume in src/lib/public-auth.ts), which bypasses RLS entirely.
-- The server action is responsible for tenant-path validation in that path.

-- ============================================================================
-- 3. Fix `approve_pipeline` RPC JSONB path for address fields
--    Old: application_data -> 'applicant_info' ->> 'address'   (wrong key)
--    New: application_data -> 'page1' -> 'applicantInfo' ->> 'address'
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_pipeline(p_pipeline_id uuid)
  RETURNS SETOF drivers
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_pipeline      driver_onboarding_pipelines%ROWTYPE;
  v_application   driver_applications%ROWTYPE;
  v_driver_id     UUID;
  v_caller_id     UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'approve_pipeline: not authenticated';
  END IF;

  SELECT * INTO v_pipeline
  FROM driver_onboarding_pipelines
  WHERE id = p_pipeline_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'approve_pipeline: pipeline % not found', p_pipeline_id;
  END IF;

  IF v_pipeline.overall_status = 'cleared' THEN
    RAISE EXCEPTION 'approve_pipeline: pipeline already cleared';
  END IF;

  IF EXISTS (
    SELECT 1 FROM driver_onboarding_steps
    WHERE pipeline_id = p_pipeline_id
      AND required = TRUE
      AND status NOT IN ('passed', 'waived', 'not_applicable')
  ) THEN
    RAISE EXCEPTION 'approve_pipeline: required step(s) not in terminal-pass state';
  END IF;

  SELECT * INTO v_application
  FROM driver_applications
  WHERE id = v_pipeline.application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'approve_pipeline: driver application not found';
  END IF;

  INSERT INTO drivers (
    tenant_id, first_name, last_name, email, phone,
    address, city, state, zip, license_number,
    driver_type, driver_status, pay_type, pay_rate,
    application_id, hired_at, created_at, updated_at
  )
  SELECT
    v_application.tenant_id,
    COALESCE(v_application.first_name, ''),
    COALESCE(v_application.last_name, ''),
    v_application.email,
    v_application.phone,
    (v_application.application_data -> 'page1' -> 'applicantInfo' ->> 'address'),
    (v_application.application_data -> 'page1' -> 'applicantInfo' ->> 'city'),
    (v_application.application_data -> 'page1' -> 'applicantInfo' ->> 'state'),
    (v_application.application_data -> 'page1' -> 'applicantInfo' ->> 'zip'),
    v_application.license_number,
    'company', 'active', 'percentage_of_carrier_pay', '0',
    v_application.id, NOW(), NOW(), NOW()
  RETURNING id INTO v_driver_id;

  UPDATE driver_onboarding_pipelines
  SET overall_status = 'cleared',
      cleared_at     = NOW(),
      cleared_by     = v_caller_id,
      driver_id      = v_driver_id
  WHERE id = p_pipeline_id;

  UPDATE driver_applications
  SET status      = 'approved',
      reviewed_at = NOW(),
      reviewed_by = v_caller_id
  WHERE id = v_pipeline.application_id;

  UPDATE compliance_documents
  SET entity_type = 'driver',
      entity_id   = v_driver_id
  WHERE entity_type = 'driver_application'
    AND entity_id   = v_pipeline.application_id;

  INSERT INTO audit_logs (
    tenant_id, entity_type, entity_id, action, description,
    actor_id, metadata, created_at
  ) VALUES (
    v_application.tenant_id,
    'driver',
    v_driver_id,
    'driver_promoted',
    'Driver promoted from application ' || v_pipeline.application_id::TEXT,
    v_caller_id,
    jsonb_build_object('application_id', v_pipeline.application_id, 'pipeline_id', p_pipeline_id),
    NOW()
  );

  RETURN QUERY SELECT * FROM drivers WHERE id = v_driver_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.approve_pipeline(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.approve_pipeline(uuid) TO authenticated;

COMMIT;
