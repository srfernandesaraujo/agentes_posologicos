
-- Table: user research interests for PubMed monitoring
CREATE TABLE public.user_research_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  terms text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_research_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own interests" ON public.user_research_interests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own interests" ON public.user_research_interests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own interests" ON public.user_research_interests
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own interests" ON public.user_research_interests
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Table: PubMed notifications log to avoid duplicates
CREATE TABLE public.pubmed_notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pmid text NOT NULL,
  interest_id uuid REFERENCES public.user_research_interests(id) ON DELETE SET NULL,
  notified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, pmid)
);

ALTER TABLE public.pubmed_notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pubmed log" ON public.pubmed_notifications_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service can insert pubmed log" ON public.pubmed_notifications_log
  FOR INSERT WITH CHECK (true);

-- Insert the PubMed agent
INSERT INTO public.agents (slug, name, description, category, icon, credit_cost, active) VALUES
('especialista-pubmed', 'Especialista PubMed', 'Consulte a base PubMed em tempo real. Faça perguntas sobre artigos científicos e receba sínteses com citações diretas. Cadastre seus interesses e receba notificações semanais de novos estudos relevantes.', 'Pesquisa Acadêmica e Dados', 'BookOpen', 1, true);
