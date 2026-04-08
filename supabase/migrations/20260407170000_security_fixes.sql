-- SEC-015 + SEC-011 security hardening migration
-- Fixes applied:
--   SEC-015: enforce_pipeline_clearance trigger now fires on INSERT too
--   SEC-011: cap signed_text at 8 KB in driver_application_consents
--   SEC-015 bonus: add enum CHECK on driver_onboarding_pipelines.overall_status

BEGIN;

-- ---------------------------------------------------------------------------
-- SEC-015: Replace enforce_pipeline_clearance() to handle INSERT correctly.
--
-- The original function used `NEW.overall_status IS DISTINCT FROM OLD.overall_status`
-- as a short-circuit. On INSERT, OLD is NULL — the comparison raises a null-reference
-- error and the trigger fires unconditionally (or silently fails depending on PG version).
-- The fix checks TG_OP = 'INSERT' explicitly so both INSERT and UPDATE are handled.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_pipeline_clearance()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT, OLD is NULL; skip the DISTINCT-FROM short-circuit
  IF TG_OP = 'INSERT' OR NEW.overall_status IS DISTINCT FROM OLD.overall_status THEN
    IF NEW.overall_status = 'cleared' AND EXISTS (
      SELECT 1 FROM driver_onboarding_steps
      WHERE pipeline_id = NEW.id
        AND required = true
        AND status NOT IN ('passed', 'waived', 'not_applicable')
    ) THEN
      RAISE EXCEPTION 'Cannot clear pipeline: required step(s) not in terminal-pass state';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- SEC-015: Re-create trigger to fire on INSERT OR UPDATE.
-- DROP first so we can change the event list cleanly.
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_enforce_pipeline_clearance ON driver_onboarding_pipelines;

CREATE TRIGGER trg_enforce_pipeline_clearance
  BEFORE INSERT OR UPDATE ON driver_onboarding_pipelines
  FOR EACH ROW EXECUTE FUNCTION enforce_pipeline_clearance();

-- ---------------------------------------------------------------------------
-- SEC-011: Add CHECK constraint on driver_application_consents.signed_text
-- to hard-cap consent text at 8 KB at the DB layer.
--
-- NOT VALID skips re-checking existing rows (safe — existing rows were
-- written by the old server code and won't exceed this).
-- VALIDATE immediately validates — this is fast on an empty/small table
-- and ensures the constraint is fully enforced going forward.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'driver_application_consents_signed_text_max_length'
  ) THEN
    ALTER TABLE driver_application_consents
      ADD CONSTRAINT driver_application_consents_signed_text_max_length
      CHECK (length(signed_text) <= 8192) NOT VALID;
  END IF;
END$$;

ALTER TABLE driver_application_consents
  VALIDATE CONSTRAINT driver_application_consents_signed_text_max_length;

-- ---------------------------------------------------------------------------
-- SEC-015 bonus: add an enum CHECK on overall_status to prevent arbitrary
-- status values from being written (defence-in-depth against ORM bypasses).
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'driver_onboarding_pipelines_overall_status_check'
  ) THEN
    ALTER TABLE driver_onboarding_pipelines
      ADD CONSTRAINT driver_onboarding_pipelines_overall_status_check
      CHECK (overall_status IN ('pending', 'in_progress', 'on_hold', 'cleared', 'rejected')) NOT VALID;
  END IF;
END$$;

ALTER TABLE driver_onboarding_pipelines
  VALIDATE CONSTRAINT driver_onboarding_pipelines_overall_status_check;

COMMIT;
