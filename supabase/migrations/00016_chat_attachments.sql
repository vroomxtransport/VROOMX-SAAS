-- Add file attachments support to chat messages
-- Attachments stored as JSONB array: [{fileName, storagePath, fileSize, mimeType}]

ALTER TABLE public.chat_messages ADD COLUMN attachments jsonb DEFAULT NULL;

-- Content becomes optional (file-only messages allowed)
ALTER TABLE public.chat_messages ALTER COLUMN content DROP NOT NULL;

-- Create private storage bucket for chat files
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', false)
ON CONFLICT (id) DO NOTHING;
