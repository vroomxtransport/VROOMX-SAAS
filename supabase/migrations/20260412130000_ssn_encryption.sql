-- ============================================================================
-- Migration: SSN Encryption RPCs via pgcrypto
--
-- N12: driver_applications.ssn_encrypted is always NULL because the encrypt
-- RPC didn't exist. This migration creates:
--
-- 1. pgcrypto extension (enables pgp_sym_encrypt / pgp_sym_decrypt)
-- 2. encrypt_ssn() — SECURITY DEFINER RPC that encrypts and stores
-- 3. decrypt_ssn() — SECURITY DEFINER RPC that decrypts (tenant-scoped)
--
-- Encryption key: stored in the SUPABASE_SSN_KEY environment variable,
-- passed to the RPCs as a parameter from the server action. This avoids
-- the Vault permission issue on managed Supabase (vault.secrets requires
-- superuser for inserts). The key never touches client code — it's read
-- from process.env in the server action and passed via the RPC parameter.
--
-- Alternative considered: Supabase Vault (vault.secrets + decrypted_secrets).
-- Rejected because managed Supabase instances restrict vault.secrets INSERT
-- from the pooled connection role. Vault is the better long-term approach
-- once Supabase exposes a migration-friendly API for secret creation.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Enable pgcrypto (idempotent)
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 2. encrypt_ssn() — called from server action with key from env var
--    Encrypts the full SSN and stores it in ssn_encrypted column.
--    Only operates on applications belonging to the caller's tenant.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.encrypt_ssn(
  p_application_id uuid,
  p_ssn text,
  p_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Get the caller's tenant from JWT app_metadata
  v_tenant_id := public.get_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify the application belongs to this tenant
  IF NOT EXISTS (
    SELECT 1 FROM driver_applications
    WHERE id = p_application_id AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Application not found or access denied';
  END IF;

  -- Encrypt and store
  UPDATE driver_applications
  SET ssn_encrypted = pgp_sym_encrypt(p_ssn, p_key)
  WHERE id = p_application_id AND tenant_id = v_tenant_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. decrypt_ssn() — called by safety/admin users to retrieve full SSN
--    Returns the decrypted SSN as text. Enforces tenant isolation.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.decrypt_ssn(
  p_application_id uuid,
  p_key text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_encrypted bytea;
  v_result text;
BEGIN
  -- Get the caller's tenant from JWT app_metadata
  v_tenant_id := public.get_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Fetch the encrypted value (tenant-scoped)
  SELECT ssn_encrypted INTO v_encrypted
  FROM driver_applications
  WHERE id = p_application_id AND tenant_id = v_tenant_id;

  IF v_encrypted IS NULL THEN
    RETURN NULL; -- No encrypted SSN stored
  END IF;

  -- Decrypt and return
  v_result := pgp_sym_decrypt(v_encrypted, p_key);
  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Grant execute to authenticated users (RPCs enforce tenant isolation)
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.encrypt_ssn(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.encrypt_ssn(uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.decrypt_ssn(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.decrypt_ssn(uuid, text) TO authenticated;

COMMIT;
