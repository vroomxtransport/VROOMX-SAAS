-- ============================================================================
-- Driver Onboarding Pipeline (Phase 9)
-- 49 CFR Part 391 / Part 382 compliance pipeline
-- ============================================================================
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction in PostgreSQL.
-- This file must be executed outside a transaction block (SET autocommit ON
-- or via psql without --single-transaction). Supabase dashboard and the
-- postgres npm driver (prepare: false) both execute statements individually,
-- so this is safe.
-- ============================================================================

-- 1. Extend existing compliance_entity_type enum
--    (must run before any table that references it with the new value)
ALTER TYPE compliance_entity_type ADD VALUE IF NOT EXISTS 'driver_application';

-- 2. New enums
CREATE TYPE driver_application_status AS ENUM (
  'draft',
  'submitted',
  'in_review',
  'pending_adverse_action',
  'approved',
  'rejected',
  'withdrawn'
);

CREATE TYPE onboarding_step_key AS ENUM (
  'application_review',
  'mvr_pull',
  'prior_employer_verification',
  'clearinghouse_query',
  'drug_test',
  'medical_verification',
  'road_test',
  'psp_query',
  'dq_file_assembly',
  'final_approval'
);

CREATE TYPE onboarding_step_status AS ENUM (
  'pending',
  'in_progress',
  'passed',
  'failed',
  'waived',
  'not_applicable'
);

CREATE TYPE driver_application_consent_type AS ENUM (
  'application_certification',
  'fcra_disclosure',
  'driver_license_requirements_certification',
  'drug_alcohol_testing_consent',
  'safety_performance_history_investigation',
  'psp_authorization',
  'clearinghouse_limited_query',
  'mvr_release'
);

CREATE TYPE applicant_document_type AS ENUM (
  'license_front',
  'license_back',
  'medical_card',
  'other'
);

-- ============================================================================
-- 3. New tables
-- ============================================================================

-- 3a. driver_applications
CREATE TABLE IF NOT EXISTS driver_applications (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status                  driver_application_status NOT NULL DEFAULT 'draft',

  -- Extracted columns for indexing / dedup / validation
  first_name              TEXT,
  last_name               TEXT,
  email                   TEXT,
  phone                   TEXT,
  date_of_birth           DATE,
  ssn_encrypted           TEXT,
  ssn_last4               TEXT,
  license_number          TEXT,
  license_state           TEXT,

  -- Full § 391.21(b) body (sections 1-12 except address history)
  application_data        JSONB,
  schema_version          INTEGER NOT NULL DEFAULT 1,

  -- Public auth tokens (split read/write)
  resume_token            UUID DEFAULT gen_random_uuid(),
  resume_token_expires_at TIMESTAMPTZ,
  status_token            UUID DEFAULT gen_random_uuid(),
  status_token_expires_at TIMESTAMPTZ,

  -- Lifecycle
  submitted_at            TIMESTAMPTZ,
  reviewed_by             UUID,
  reviewed_at             TIMESTAMPTZ,

  -- FCRA adverse-action two-step
  pre_adverse_sent_at     TIMESTAMPTZ,
  adverse_action_sent_at  TIMESTAMPTZ,
  rejection_reason        TEXT,

  -- Retention soft-delete (§ 391.51)
  archived_at             TIMESTAMPTZ,
  retention_expires_at    TIMESTAMPTZ,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_apps_tenant
  ON driver_applications (tenant_id);

CREATE INDEX IF NOT EXISTS idx_driver_apps_tenant_status
  ON driver_applications (tenant_id, status);

-- Partial unique: prevent re-spam from rejected applicants
CREATE UNIQUE INDEX IF NOT EXISTS uniq_driver_apps_license_active
  ON driver_applications (tenant_id, license_number)
  WHERE status NOT IN ('rejected','withdrawn')
    AND archived_at IS NULL
    AND license_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_driver_apps_resume_token
  ON driver_applications (resume_token);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_driver_apps_status_token
  ON driver_applications (status_token);

-- 3b. driver_application_address_history
CREATE TABLE IF NOT EXISTS driver_application_address_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES driver_applications(id) ON DELETE CASCADE,
  street         TEXT NOT NULL,
  city           TEXT NOT NULL,
  state          TEXT NOT NULL,
  zip            TEXT NOT NULL,
  from_date      DATE NOT NULL,
  to_date        DATE,
  position       INTEGER NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_addr_app
  ON driver_application_address_history (application_id);

-- 3c. driver_application_consents (immutable signature ledger)
CREATE TABLE IF NOT EXISTS driver_application_consents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id      UUID NOT NULL REFERENCES driver_applications(id) ON DELETE CASCADE,
  consent_type        driver_application_consent_type NOT NULL,
  signed_text         TEXT NOT NULL,
  signed_text_locale  TEXT NOT NULL DEFAULT 'en-US',
  typed_name          TEXT NOT NULL,
  ip_address          TEXT NOT NULL,
  user_agent          TEXT NOT NULL,
  signed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_app_consents_app
  ON driver_application_consents (application_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_app_consents_type
  ON driver_application_consents (application_id, consent_type);

-- 3d. driver_application_documents
CREATE TABLE IF NOT EXISTS driver_application_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES driver_applications(id) ON DELETE CASCADE,
  document_type  applicant_document_type NOT NULL,
  file_name      TEXT NOT NULL,
  storage_path   TEXT NOT NULL,
  file_size      INTEGER,
  mime_type      TEXT,
  scan_status    TEXT NOT NULL DEFAULT 'pending',
  uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_docs_app
  ON driver_application_documents (application_id);

-- 3e. driver_onboarding_pipelines
CREATE TABLE IF NOT EXISTS driver_onboarding_pipelines (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id UUID NOT NULL UNIQUE REFERENCES driver_applications(id) ON DELETE CASCADE,
  driver_id      UUID REFERENCES drivers(id) ON DELETE SET NULL,
  overall_status TEXT NOT NULL DEFAULT 'pending',
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cleared_at     TIMESTAMPTZ,
  cleared_by     UUID,
  rejected_at    TIMESTAMPTZ,
  rejected_by    UUID,
  notes          TEXT
);

CREATE INDEX IF NOT EXISTS idx_onb_pipelines_tenant
  ON driver_onboarding_pipelines (tenant_id);

-- 3f. driver_onboarding_steps
CREATE TABLE IF NOT EXISTS driver_onboarding_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id   UUID NOT NULL REFERENCES driver_onboarding_pipelines(id) ON DELETE CASCADE,
  step_key      onboarding_step_key NOT NULL,
  step_order    INTEGER NOT NULL,
  status        onboarding_step_status NOT NULL DEFAULT 'pending',
  required      BOOLEAN NOT NULL DEFAULT TRUE,
  waivable      BOOLEAN NOT NULL DEFAULT FALSE,
  waive_reason  TEXT,
  assignee_id   UUID,
  notes         TEXT,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onb_steps_pipeline
  ON driver_onboarding_steps (pipeline_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_onb_steps_pipeline_key
  ON driver_onboarding_steps (pipeline_id, step_key);

-- ============================================================================
-- 4. ALTER existing tables
-- ============================================================================

-- 4a. drivers — add application_id, hired_at, terminated_at
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES driver_applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMPTZ;

-- 4b. compliance_documents — add onboarding_step_id
ALTER TABLE compliance_documents
  ADD COLUMN IF NOT EXISTS onboarding_step_id UUID REFERENCES driver_onboarding_steps(id) ON DELETE SET NULL;

-- ============================================================================
-- 5. Enable RLS on all new tables
-- ============================================================================

ALTER TABLE driver_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_application_address_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_application_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_onboarding_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_onboarding_steps ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. RLS policies (standardized pattern: get_tenant_id())
-- ============================================================================

-- driver_applications
DROP POLICY IF EXISTS "tenant_isolation" ON driver_applications;
CREATE POLICY "tenant_isolation" ON driver_applications
  FOR ALL TO authenticated
  USING  (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

-- driver_application_address_history
DROP POLICY IF EXISTS "tenant_isolation" ON driver_application_address_history;
CREATE POLICY "tenant_isolation" ON driver_application_address_history
  FOR ALL TO authenticated
  USING  (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

-- driver_application_consents: standard tenant isolation + immutable-ledger policy
DROP POLICY IF EXISTS "tenant_isolation" ON driver_application_consents;
CREATE POLICY "tenant_isolation" ON driver_application_consents
  FOR ALL TO authenticated
  USING  (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

-- Immutable ledger: block UPDATE and DELETE for non-service-role callers
DROP POLICY IF EXISTS "no_update" ON driver_application_consents;
CREATE POLICY "no_update" ON driver_application_consents
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (FALSE);

DROP POLICY IF EXISTS "no_delete" ON driver_application_consents;
CREATE POLICY "no_delete" ON driver_application_consents
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (FALSE);

-- driver_application_documents
DROP POLICY IF EXISTS "tenant_isolation" ON driver_application_documents;
CREATE POLICY "tenant_isolation" ON driver_application_documents
  FOR ALL TO authenticated
  USING  (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

-- driver_onboarding_pipelines
DROP POLICY IF EXISTS "tenant_isolation" ON driver_onboarding_pipelines;
CREATE POLICY "tenant_isolation" ON driver_onboarding_pipelines
  FOR ALL TO authenticated
  USING  (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

-- driver_onboarding_steps
DROP POLICY IF EXISTS "tenant_isolation" ON driver_onboarding_steps;
CREATE POLICY "tenant_isolation" ON driver_onboarding_steps
  FOR ALL TO authenticated
  USING  (tenant_id = (SELECT public.get_tenant_id()))
  WITH CHECK (tenant_id = (SELECT public.get_tenant_id()));

-- ============================================================================
-- 7. enforce_pipeline_clearance() trigger
--    Belt-and-suspenders: prevents raw SQL from bypassing the app-layer check.
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_pipeline_clearance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.overall_status IS DISTINCT FROM OLD.overall_status
     AND NEW.overall_status = 'cleared'
     AND EXISTS (
       SELECT 1 FROM driver_onboarding_steps
       WHERE pipeline_id = NEW.id
         AND required = TRUE
         AND status NOT IN ('passed', 'waived', 'not_applicable')
     )
  THEN
    RAISE EXCEPTION 'Cannot clear pipeline: required step(s) not in terminal-pass state';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pipeline_clearance ON driver_onboarding_pipelines;
CREATE TRIGGER trg_enforce_pipeline_clearance
  BEFORE UPDATE ON driver_onboarding_pipelines
  FOR EACH ROW EXECUTE FUNCTION enforce_pipeline_clearance();

-- ============================================================================
-- 8. approve_pipeline() RPC — SECURITY DEFINER, atomic promotion
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_pipeline(p_pipeline_id UUID)
RETURNS SETOF drivers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_pipeline      driver_onboarding_pipelines%ROWTYPE;
  v_application   driver_applications%ROWTYPE;
  v_driver_id     UUID;
  v_caller_id     UUID;
BEGIN
  -- Identify the authenticated caller
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'approve_pipeline: not authenticated';
  END IF;

  -- Lock the pipeline row for update
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

  -- TOCTOU defence: re-check all required steps are in terminal-pass state
  IF EXISTS (
    SELECT 1 FROM driver_onboarding_steps
    WHERE pipeline_id = p_pipeline_id
      AND required = TRUE
      AND status NOT IN ('passed', 'waived', 'not_applicable')
  ) THEN
    RAISE EXCEPTION 'approve_pipeline: required step(s) not in terminal-pass state';
  END IF;

  -- Fetch the linked application
  SELECT * INTO v_application
  FROM driver_applications
  WHERE id = v_pipeline.application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'approve_pipeline: driver application not found';
  END IF;

  -- INSERT new driver row copying fields from the application
  INSERT INTO drivers (
    tenant_id,
    first_name,
    last_name,
    email,
    phone,
    address,
    city,
    state,
    zip,
    license_number,
    driver_type,
    driver_status,
    pay_type,
    pay_rate,
    application_id,
    hired_at,
    created_at,
    updated_at
  )
  SELECT
    v_application.tenant_id,
    COALESCE(v_application.first_name, ''),
    COALESCE(v_application.last_name, ''),
    v_application.email,
    v_application.phone,
    -- Address fields from application_data JSONB (section 1)
    (v_application.application_data -> 'applicantInfo' ->> 'address'),
    (v_application.application_data -> 'applicantInfo' ->> 'city'),
    (v_application.application_data -> 'applicantInfo' ->> 'state'),
    (v_application.application_data -> 'applicantInfo' ->> 'zip'),
    v_application.license_number,
    'company',            -- default; admin edits post-creation
    'active',
    'percentage_of_carrier_pay',  -- default; admin edits post-creation
    '0',                  -- admin sets actual rate post-creation
    v_application.id,
    NOW(),
    NOW(),
    NOW()
  RETURNING id INTO v_driver_id;

  -- UPDATE pipeline: set cleared
  UPDATE driver_onboarding_pipelines
  SET overall_status = 'cleared',
      cleared_at     = NOW(),
      cleared_by     = v_caller_id,
      driver_id      = v_driver_id
  WHERE id = p_pipeline_id;

  -- UPDATE application: set approved
  UPDATE driver_applications
  SET status      = 'approved',
      reviewed_at = NOW(),
      reviewed_by = v_caller_id
  WHERE id = v_pipeline.application_id;

  -- Repoint compliance_documents from driver_application → driver
  UPDATE compliance_documents
  SET entity_type = 'driver',
      entity_id   = v_driver_id
  WHERE entity_type = 'driver_application'
    AND entity_id   = v_pipeline.application_id;

  -- INSERT audit log for the promotion
  INSERT INTO audit_logs (
    tenant_id,
    entity_type,
    entity_id,
    action,
    description,
    actor_id,
    metadata,
    created_at
  ) VALUES (
    v_application.tenant_id,
    'driver',
    v_driver_id,
    'driver_promoted',
    'Driver promoted from application ' || v_pipeline.application_id::TEXT,
    v_caller_id,
    jsonb_build_object(
      'application_id', v_pipeline.application_id,
      'pipeline_id',    p_pipeline_id
    ),
    NOW()
  );

  -- Return the new driver row
  RETURN QUERY SELECT * FROM drivers WHERE id = v_driver_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_pipeline(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_pipeline(UUID) TO authenticated;

-- ============================================================================
-- Self-verification comments
-- ============================================================================
-- After running this migration, verify with:
--   SELECT table_name FROM information_schema.tables
--     WHERE table_schema = 'public'
--     AND table_name IN (
--       'driver_applications',
--       'driver_application_address_history',
--       'driver_application_consents',
--       'driver_application_documents',
--       'driver_onboarding_pipelines',
--       'driver_onboarding_steps'
--     );
--
--   SELECT enumlabel FROM pg_enum
--     JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
--     WHERE pg_type.typname = 'compliance_entity_type'
--     ORDER BY enumsortorder;
--
--   SELECT polname, tablename FROM pg_policies
--     WHERE tablename IN (
--       'driver_applications',
--       'driver_application_address_history',
--       'driver_application_consents',
--       'driver_application_documents',
--       'driver_onboarding_pipelines',
--       'driver_onboarding_steps'
--     );
--
--   SELECT routine_name FROM information_schema.routines
--     WHERE routine_schema = 'public'
--     AND routine_name IN ('approve_pipeline', 'enforce_pipeline_clearance');
--
--   SELECT trigger_name FROM information_schema.triggers
--     WHERE event_object_table = 'driver_onboarding_pipelines';
