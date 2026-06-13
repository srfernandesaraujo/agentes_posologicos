
CREATE TABLE IF NOT EXISTS public.briefing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  frequency text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekly')),
  send_hour smallint NOT NULL DEFAULT 7,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.briefing_settings TO authenticated;
GRANT ALL ON public.briefing_settings TO service_role;
ALTER TABLE public.briefing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own briefing settings" ON public.briefing_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_briefing_settings_updated_at
  BEFORE UPDATE ON public.briefing_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  transcript text NOT NULL,
  summary text,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  delivered_email boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_briefings_user_created ON public.briefings(user_id, created_at DESC);
GRANT SELECT ON public.briefings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.briefings TO authenticated;
GRANT ALL ON public.briefings TO service_role;
ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own briefings" ON public.briefings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "anyone can read briefing by id" ON public.briefings
  FOR SELECT TO anon USING (true);
