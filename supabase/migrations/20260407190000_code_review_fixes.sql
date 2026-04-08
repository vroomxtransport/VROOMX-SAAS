-- Code-review fixes migration
-- Fixes applied:
--   MED-012: Restore SET search_path = public, pg_temp on enforce_pipeline_clearance()
--            The SEC-015 migration (20260407170000) inadvertently dropped the search_path
--            hardening that was present in the original function definition.
--            This migration reinstates it as a security regression fix.

BEGIN;

-- ---------------------------------------------------------------------------
-- MED-012: Restore SET search_path on enforce_pipeline_clearance()
--
-- The SEC-015 migration used CREATE OR REPLACE but omitted the SECURITY DEFINER
-- search_path hardening clause. Without SET search_path, a malicious schema
-- injection could shadow pg_catalog functions. Restore the full hardened definition.
--
-- Logic is identical to SEC-015 (INSERT/UPDATE handling) — only the LANGUAGE
-- declaration order and SET clause are restored.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_pipeline_clearance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
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
$$;

COMMIT;
