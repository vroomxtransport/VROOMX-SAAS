-- ============================================================================
-- Add get_auth_user_id_by_email RPC
-- ============================================================================
-- Used by signUpAction (src/app/actions/auth.ts) to look up an existing
-- auth.users row by email WITHOUT loading the entire user list. Replaces
-- admin.auth.admin.listUsers() which leaks the full user directory and is
-- a DoS vector at scale. Fixes finding C3.
--
-- Security model:
--   - SECURITY DEFINER so it can read auth.users
--   - REVOKE ALL FROM PUBLIC
--   - GRANT EXECUTE only to service_role (server-side, never the anon key)
--   - Returns ONLY the id, never the email/metadata of other users
--   - search_path is locked to public, auth, pg_temp to prevent hijack
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM auth.users
  WHERE email = lower(p_email)
  LIMIT 1;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_auth_user_id_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_user_id_by_email(TEXT) TO service_role;
