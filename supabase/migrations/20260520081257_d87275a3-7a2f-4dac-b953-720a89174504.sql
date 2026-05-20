-- Tabela de contexto profissional do usuário (1 linha por usuário)
CREATE TABLE public.user_profile_context (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  area_atuacao text NOT NULL DEFAULT '',
  public_target text NOT NULL DEFAULT '',
  tone_preference text NOT NULL DEFAULT '',
  institution text NOT NULL DEFAULT '',
  research_lines text NOT NULL DEFAULT '',
  restrictions text NOT NULL DEFAULT '',
  memory_enabled boolean NOT NULL DEFAULT true,
  auto_extract_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profile_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile context"
  ON public.user_profile_context FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile context"
  ON public.user_profile_context FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile context"
  ON public.user_profile_context FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile context"
  ON public.user_profile_context FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profile contexts"
  ON public.user_profile_context FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_user_profile_context_updated
  BEFORE UPDATE ON public.user_profile_context
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de fatos extraídos sobre o usuário
CREATE TABLE public.user_memory_facts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  fact text NOT NULL,
  source_session_id uuid,
  confidence numeric NOT NULL DEFAULT 0.7,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_memory_facts_user_active ON public.user_memory_facts(user_id, active);

ALTER TABLE public.user_memory_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own facts"
  ON public.user_memory_facts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own facts"
  ON public.user_memory_facts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own facts"
  ON public.user_memory_facts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own facts"
  ON public.user_memory_facts FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all facts"
  ON public.user_memory_facts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));