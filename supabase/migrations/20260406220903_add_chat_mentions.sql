-- Add mentions JSONB column to chat_messages for @-mention feature.
-- Each entry: { userId: uuid, displayName: string }
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS mentions jsonb;
