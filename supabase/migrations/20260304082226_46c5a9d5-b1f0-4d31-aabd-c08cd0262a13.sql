
-- Drop and recreate with explicit key parameter
CREATE OR REPLACE FUNCTION public.encrypt_api_key(p_key text, p_encryption_key text DEFAULT NULL)
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
  RETURN encode(pgp_sym_encrypt(p_key, v_key)::bytea, 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_api_key(p_encrypted text, p_encryption_key text DEFAULT NULL)
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
  RETURN pgp_sym_decrypt(decode(p_encrypted, 'base64')::bytea, v_key);
EXCEPTION
  WHEN OTHERS THEN
    -- If decryption fails, the value might be plaintext (legacy)
    RETURN p_encrypted;
END;
$$;
