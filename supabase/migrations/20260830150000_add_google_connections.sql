
-- Per-user Google OAuth connection, used to read Gemini-generated Meet transcripts
-- from the connecting user's own Google Drive ("Meet Recordings" folder).
CREATE TABLE public.google_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email TEXT,
  refresh_token_encrypted TEXT NOT NULL,
  access_token_encrypted TEXT,
  access_token_expires_at TIMESTAMP WITH TIME ZONE,
  drive_meet_recordings_folder_id TEXT,
  status TEXT NOT NULL DEFAULT 'connected', -- connected | error
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated: tokens are only ever read/written by edge functions
-- using the service role (which bypasses RLS), same trust model as user_api_keys writes.
-- Frontend reads connection status via the meeting-google-status edge function instead of
-- selecting this table directly, so it never needs its own SELECT policy either.
REVOKE ALL ON public.google_connections FROM anon, authenticated;

CREATE TRIGGER update_google_connections_updated_at
  BEFORE UPDATE ON public.google_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
