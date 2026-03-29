
CREATE TABLE public.content_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  verification_code text NOT NULL UNIQUE,
  content_hash text NOT NULL,
  content_preview text NOT NULL DEFAULT '',
  agent_name text NOT NULL DEFAULT '',
  session_id uuid,
  message_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_certificates_user ON public.content_certificates(user_id);
CREATE INDEX idx_content_certificates_code ON public.content_certificates(verification_code);

ALTER TABLE public.content_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own certificates"
  ON public.content_certificates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own certificates"
  ON public.content_certificates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can verify certificates by code"
  ON public.content_certificates FOR SELECT
  TO anon
  USING (true);
