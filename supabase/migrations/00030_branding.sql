-- Branding columns for tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS logo_storage_path text,
  ADD COLUMN IF NOT EXISTS brand_color_primary text DEFAULT '#1a2b3f',
  ADD COLUMN IF NOT EXISTS brand_color_secondary text,
  ADD COLUMN IF NOT EXISTS invoice_header_text text,
  ADD COLUMN IF NOT EXISTS invoice_footer_text text;

-- Branding storage bucket (5MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('branding', 'branding', false, 5242880)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for branding bucket (drop first to be idempotent)
DROP POLICY IF EXISTS "branding_select" ON storage.objects;
DROP POLICY IF EXISTS "branding_insert" ON storage.objects;
DROP POLICY IF EXISTS "branding_update" ON storage.objects;
DROP POLICY IF EXISTS "branding_delete" ON storage.objects;

CREATE POLICY "branding_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'branding' AND (storage.foldername(name))[1] = (SELECT get_tenant_id()::text));
CREATE POLICY "branding_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'branding' AND (storage.foldername(name))[1] = (SELECT get_tenant_id()::text));
CREATE POLICY "branding_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'branding' AND (storage.foldername(name))[1] = (SELECT get_tenant_id()::text));
CREATE POLICY "branding_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'branding' AND (storage.foldername(name))[1] = (SELECT get_tenant_id()::text));
