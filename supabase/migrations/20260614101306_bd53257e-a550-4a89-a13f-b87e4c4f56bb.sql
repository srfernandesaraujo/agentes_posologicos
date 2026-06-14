
-- Allow guest (anonymous) participants in OSCE live sessions
ALTER TABLE public.osce_session_participants
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS guest_token text,
  ADD COLUMN IF NOT EXISTS guest_email text,
  ADD COLUMN IF NOT EXISTS guest_name text;

CREATE UNIQUE INDEX IF NOT EXISTS osce_sp_session_guest_uniq
  ON public.osce_session_participants(session_id, guest_token)
  WHERE guest_token IS NOT NULL;

ALTER TABLE public.osce_attempts
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS guest_token text,
  ADD COLUMN IF NOT EXISTS guest_email text,
  ADD COLUMN IF NOT EXISTS guest_name text;

CREATE INDEX IF NOT EXISTS idx_osce_attempts_guest ON public.osce_attempts(guest_token);
