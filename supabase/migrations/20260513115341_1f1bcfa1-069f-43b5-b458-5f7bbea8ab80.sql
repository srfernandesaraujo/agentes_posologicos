
-- 1. ai_usage_log: drop public read/insert; service_role bypasses RLS
DROP POLICY IF EXISTS "Service role can read" ON public.ai_usage_log;
DROP POLICY IF EXISTS "Service role can insert" ON public.ai_usage_log;

-- 2. meetings: drop public UPDATE-true; service_role bypasses RLS
DROP POLICY IF EXISTS "Service role can update meetings" ON public.meetings;

-- 3. whatsapp_conversations: drop public ALL-true; service_role bypasses RLS
DROP POLICY IF EXISTS "Service role full access on whatsapp_conversations" ON public.whatsapp_conversations;

-- 4. credits_ledger: remove user self-insert (privilege escalation)
DROP POLICY IF EXISTS "Users can insert own credits" ON public.credits_ledger;

-- 5. content_certificates: drop anon SELECT (verification goes through edge function with service role)
DROP POLICY IF EXISTS "Anyone can verify certificates by code" ON public.content_certificates;

-- 6. virtual_rooms: drop anon SELECT (PIN flow uses get_room_by_pin RPC)
DROP POLICY IF EXISTS "Anon can view active rooms" ON public.virtual_rooms;

-- 7. Safe RPC for marketplace listing — never exposes system_prompt
CREATE OR REPLACE FUNCTION public.get_marketplace_agents()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  description text,
  model text,
  provider text,
  temperature numeric,
  restrict_content boolean,
  markdown_response boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, user_id, name, description, model, provider, temperature,
         restrict_content, markdown_response, created_at, updated_at
  FROM public.custom_agents
  WHERE published_to_marketplace = true
    AND status = 'published'
  ORDER BY created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_marketplace_agents() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_marketplace_agents() TO authenticated, anon;

-- Replace the broad marketplace SELECT policy with one that hides system_prompt by routing
-- reads through the RPC above. Direct SELECTs from authenticated users are still allowed for
-- their own agents and admin SELECTs continue to work via existing policies.
DROP POLICY IF EXISTS "Anyone can view marketplace agents" ON public.custom_agents;

-- 8. Harden decrypt_api_key: log on failure and only fall back when value looks like legacy plaintext
CREATE OR REPLACE FUNCTION public.decrypt_api_key(p_encrypted text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_result text;
BEGIN
  IF p_encrypted IS NULL OR p_encrypted = '' THEN
    RETURN p_encrypted;
  END IF;

  v_key := current_setting('app.api_encryption_key', true);
  IF v_key IS NULL OR v_key = '' THEN
    v_key := 'fallback-encryption-key-change-in-production';
  END IF;

  BEGIN
    v_result := convert_from(
      pgp_sym_decrypt_bytea(decode(p_encrypted, 'base64'), v_key),
      'UTF8'
    );
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'decrypt_api_key failed: %', SQLERRM;
    -- Only return original when it clearly is NOT encrypted ciphertext (legacy plaintext).
    -- Encrypted values are base64 and typically > 60 chars; legacy plaintext API keys are
    -- usually shorter or contain non-base64 characters.
    IF p_encrypted ~ '^[A-Za-z0-9+/=]+$' AND length(p_encrypted) > 60 THEN
      RETURN NULL;
    END IF;
    RETURN p_encrypted;
  END;
END;
$$;
