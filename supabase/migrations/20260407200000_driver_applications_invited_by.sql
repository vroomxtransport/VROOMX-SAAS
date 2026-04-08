BEGIN;

ALTER TABLE driver_applications
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_driver_apps_created_by
  ON driver_applications (tenant_id, created_by_user_id)
  WHERE created_by_user_id IS NOT NULL;

COMMIT;
