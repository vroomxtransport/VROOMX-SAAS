-- ============================================================================
-- Migration: Create missing storage buckets + RLS policies
--
-- CFG-002: safety-photos bucket referenced in safety-events.ts but never
-- created. Upload/delete of safety event photos crashes at runtime.
--
-- CFG-003: attachments bucket referenced in orders.ts but never created.
-- Upload/delete of order attachments crashes at runtime.
--
-- Both buckets are PRIVATE with 25MB file size limits and tenant-scoped
-- RLS policies matching the pattern used by the documents, branding, and
-- chat-files buckets. The RLS policy extracts tenant_id from the first
-- path segment (storage.foldername(name))[1] and compares against the
-- authenticated user's get_tenant_id() from JWT app_metadata.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Create the safety-photos bucket (private, 25MB limit)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('safety-photos', 'safety-photos', false, 26214400)
ON CONFLICT (id) DO NOTHING;

-- Drop + recreate pattern for idempotency (CREATE POLICY IF NOT EXISTS
-- is not supported in all Postgres versions)
DROP POLICY IF EXISTS safety_photos_tenant_insert ON storage.objects;
CREATE POLICY safety_photos_tenant_insert
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'safety-photos'
    AND (storage.foldername(name))[1] = (SELECT public.get_tenant_id())::text
  );

DROP POLICY IF EXISTS safety_photos_tenant_select ON storage.objects;
CREATE POLICY safety_photos_tenant_select
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'safety-photos'
    AND (storage.foldername(name))[1] = (SELECT public.get_tenant_id())::text
  );

DROP POLICY IF EXISTS safety_photos_tenant_delete ON storage.objects;
CREATE POLICY safety_photos_tenant_delete
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'safety-photos'
    AND (storage.foldername(name))[1] = (SELECT public.get_tenant_id())::text
  );

-- ---------------------------------------------------------------------------
-- 2. Create the attachments bucket (private, 25MB limit)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('attachments', 'attachments', false, 26214400)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS attachments_tenant_insert ON storage.objects;
CREATE POLICY attachments_tenant_insert
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = (SELECT public.get_tenant_id())::text
  );

DROP POLICY IF EXISTS attachments_tenant_select ON storage.objects;
CREATE POLICY attachments_tenant_select
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = (SELECT public.get_tenant_id())::text
  );

DROP POLICY IF EXISTS attachments_tenant_delete ON storage.objects;
CREATE POLICY attachments_tenant_delete
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = (SELECT public.get_tenant_id())::text
  );

COMMIT;
