
CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT NULL,
  session_id text NOT NULL,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  page text DEFAULT NULL,
  utm_source text DEFAULT NULL,
  utm_campaign text DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all analytics"
  ON public.analytics_events FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own analytics"
  ON public.analytics_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can insert analytics"
  ON public.analytics_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX idx_analytics_events_session ON public.analytics_events(session_id);
CREATE INDEX idx_analytics_events_type ON public.analytics_events(event_type);
CREATE INDEX idx_analytics_events_created ON public.analytics_events(created_at);
