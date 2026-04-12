-- Migration: chat unread counts RPC
-- Replaces the N+1 per-channel SELECT count(*) pattern in use-chat-unread.ts
-- with a single aggregation query executed server-side.
--
-- SECURITY INVOKER: the function runs with the permissions of the calling
-- user, so Supabase RLS policies on chat_messages and chat_channels apply
-- exactly as they would for a direct client query. Do NOT change to DEFINER.

CREATE OR REPLACE FUNCTION get_unread_counts(p_user_id uuid)
RETURNS TABLE(channel_id uuid, unread_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT
    cc.id AS channel_id,
    count(cm.id) AS unread_count
  FROM chat_channels cc
  LEFT JOIN chat_channel_reads ccr
    ON ccr.channel_id = cc.id
    AND ccr.user_id = p_user_id
  LEFT JOIN chat_messages cm
    ON cm.channel_id = cc.id
    AND cm.user_id != p_user_id
    AND (ccr.last_read_at IS NULL OR cm.created_at > ccr.last_read_at)
  GROUP BY cc.id
  HAVING count(cm.id) > 0
$$;
