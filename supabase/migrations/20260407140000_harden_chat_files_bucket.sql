-- CFG-001: chat-files storage bucket had no tenant isolation. The three
-- policies in 00016_chat_attachments.sql only checked `bucket_id =
-- 'chat-files'`, so any authenticated user in any tenant could upload,
-- read, or delete files belonging to any other tenant. Cross-tenant
-- file exfiltration of broker/customer documents.
--
-- Fix: require the first folder segment of the object path to equal
-- the caller's tenant_id. Matches the pattern used by the branding
-- bucket in 00030_branding.sql.
--
-- Safe to enforce: src/lib/storage.ts:73 constructs paths as
-- `${tenantId}/${entityId}/${fileName}`, and message-input.tsx:182
-- calls uploadFile(supabase, 'chat-files', tenantId, channelId, file),
-- so all existing chat-files objects are already tenant-prefixed.

DROP POLICY IF EXISTS "Authenticated users can upload to chat-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read chat-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete chat-files" ON storage.objects;

CREATE POLICY "chat_files_tenant_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-files'
    AND (storage.foldername(name))[1] = (SELECT public.get_tenant_id()::text)
  );

CREATE POLICY "chat_files_tenant_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-files'
    AND (storage.foldername(name))[1] = (SELECT public.get_tenant_id()::text)
  );

CREATE POLICY "chat_files_tenant_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-files'
    AND (storage.foldername(name))[1] = (SELECT public.get_tenant_id()::text)
  );

-- Self-verify: confirm all three policies landed and include the folder check.
DO $$
DECLARE
  found_count int;
BEGIN
  SELECT COUNT(*) INTO found_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname IN (
      'chat_files_tenant_insert',
      'chat_files_tenant_select',
      'chat_files_tenant_delete'
    );
  IF found_count <> 3 THEN
    RAISE EXCEPTION 'chat-files policies did not all land: expected 3, got %', found_count;
  END IF;
END $$;
