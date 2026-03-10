CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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
  RETURN encode(extensions.pgp_sym_encrypt(p_key, v_encryption_key), 'base64');
END;
$$;

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
  RETURN extensions.pgp_sym_decrypt(decode(p_encrypted, 'base64'), v_encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    RETURN p_encrypted;
END;
$$;

CREATE OR REPLACE FUNCTION public.encrypt_api_key(p_key text, p_encryption_key text DEFAULT NULL::text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := COALESCE(p_encryption_key, current_setting('app.settings.api_encryption_key', true));
  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'Encryption key not provided';
  END IF;
  RETURN encode(extensions.pgp_sym_encrypt(p_key, v_key), 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_api_key(p_encrypted text, p_encryption_key text DEFAULT NULL::text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := COALESCE(p_encryption_key, current_setting('app.settings.api_encryption_key', true));
  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'Encryption key not provided';
  END IF;
  RETURN extensions.pgp_sym_decrypt(decode(p_encrypted, 'base64'), v_key);
EXCEPTION
  WHEN OTHERS THEN
    RETURN p_encrypted;
END;
$$;