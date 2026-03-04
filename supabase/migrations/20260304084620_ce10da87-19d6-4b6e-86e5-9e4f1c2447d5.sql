
-- Fix #2: Encrypt WhatsApp tokens
-- Add encrypted column
ALTER TABLE public.whatsapp_connections 
  ADD COLUMN token_encrypted text;

-- Encrypt existing tokens using the 1-arg overload explicitly
UPDATE public.whatsapp_connections
SET token_encrypted = public.encrypt_api_key(token::text, NULL::text)
WHERE token IS NOT NULL AND token != '';

-- Drop plaintext column and rename
ALTER TABLE public.whatsapp_connections DROP COLUMN token;
ALTER TABLE public.whatsapp_connections RENAME COLUMN token_encrypted TO token;
