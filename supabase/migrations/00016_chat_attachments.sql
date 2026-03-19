-- Add file attachments support to chat messages
-- Attachments stored as JSONB array: [{fileName, storagePath, fileSize, mimeType}]

ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT NULL;

-- Content becomes optional (file-only messages allowed)
ALTER TABLE public.chat_messages ALTER COLUMN content DROP NOT NULL;

-- Create private storage bucket for chat files with size/type constraints
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-files', 'chat-files', false, 10485760,
  ARRAY[
    'image/jpeg','image/png','image/gif','image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS policies (required for private buckets)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload to chat-files' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated users can upload to chat-files"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'chat-files');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can read chat-files' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated users can read chat-files"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'chat-files');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can delete chat-files' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated users can delete chat-files"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'chat-files');
  END IF;
END $$;
