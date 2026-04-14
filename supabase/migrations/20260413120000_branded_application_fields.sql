-- Add branded employment application fields to tenants table
BEGIN;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS app_welcome_message text,
  ADD COLUMN IF NOT EXISTS app_banner_storage_path text,
  ADD COLUMN IF NOT EXISTS app_footer_text text,
  ADD COLUMN IF NOT EXISTS app_estimated_time varchar(50) DEFAULT '15-20 minutes';

COMMIT;
