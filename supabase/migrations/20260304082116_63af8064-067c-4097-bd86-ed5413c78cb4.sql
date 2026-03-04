
-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create helper function to encrypt API keys
CREATE OR REPLACE FUNCTION public.encrypt_api_key(p_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encryption_key text;
BEGIN
  SELECT current_setting('app.settings.api_encryption_key', true) INTO v_encryption_key;
  IF v_encryption_key IS NULL OR v_encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured';
  END IF;
  RETURN encode(pgp_sym_encrypt(p_key, v_encryption_key)::bytea, 'base64');
END;
$$;

-- Create helper function to decrypt API keys
CREATE OR REPLACE FUNCTION public.decrypt_api_key(p_encrypted text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encryption_key text;
BEGIN
  SELECT current_setting('app.settings.api_encryption_key', true) INTO v_encryption_key;
  IF v_encryption_key IS NULL OR v_encryption_key = '' THEN
    RAISE EXCEPTION 'Encryption key not configured';
  END IF;
  RETURN pgp_sym_decrypt(decode(p_encrypted, 'base64')::bytea, v_encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    -- If decryption fails, the value is likely still plaintext
    RETURN p_encrypted;
END;
$$;

-- Revoke direct INSERT/UPDATE on user_api_keys from anon and authenticated
-- Force all writes through the edge function
REVOKE INSERT, UPDATE ON public.user_api_keys FROM anon;
REVOKE INSERT, UPDATE ON public.user_api_keys FROM authenticated;
