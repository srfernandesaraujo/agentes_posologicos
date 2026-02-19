
-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Agents table (public read)
CREATE TABLE public.agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'Bot',
  credit_cost INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents are publicly readable" ON public.agents FOR SELECT USING (true);

-- Credits ledger
CREATE TABLE public.credits_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'usage', 'bonus')),
  reference_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.credits_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own credits" ON public.credits_ledger FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own credits" ON public.credits_ledger FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Grant initial bonus on profile creation
CREATE OR REPLACE FUNCTION public.grant_signup_bonus()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.credits_ledger (user_id, amount, type, description)
  VALUES (NEW.user_id, 5, 'bonus', 'Bônus de cadastro');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_profile_created_grant_bonus
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.grant_signup_bonus();

-- Chat sessions
CREATE TABLE public.chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sessions" ON public.chat_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own sessions" ON public.chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.chat_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Messages
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.chat_sessions cs WHERE cs.id = session_id AND cs.user_id = auth.uid()));
CREATE POLICY "Users can insert own messages" ON public.messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.chat_sessions cs WHERE cs.id = session_id AND cs.user_id = auth.uid()));

-- Seed agents
INSERT INTO public.agents (slug, name, description, category, icon) VALUES
  ('interacoes-cardiovascular', 'Analisador de Interações e Risco Cardiovascular', 'Cruza prescrições para alertar sobre interações medicamentosas graves, sugerir ajustes de dose e calcular risco cardiovascular.', 'Prática Clínica e Farmácia', 'HeartPulse'),
  ('educador-cronicas', 'Educador e Tradutor Clínico para Doenças Crônicas', 'Gera material educativo com linguagem acessível sobre tratamentos complexos para pacientes.', 'Prática Clínica e Farmácia', 'BookOpen'),
  ('antibioticoterapia', 'Consultor de Antibioticoterapia', 'Sugere antimicrobianos, posologia e alertas de toxicidade baseado em diretrizes recentes.', 'Prática Clínica e Farmácia', 'Pill'),
  ('metodologias-ativas', 'Arquiteto de Metodologias Ativas e Planos de Aula', 'Estrutura planos de aula com metodologias ativas como PBL e sala de aula invertida.', 'EdTech e Professores 4.0', 'GraduationCap'),
  ('simulador-clinico', 'Simulador de Casos Clínicos Reais', 'Cria casos clínicos complexos e realistas para treinamento de estudantes e residentes.', 'EdTech e Professores 4.0', 'Stethoscope'),
  ('analisador-turma', 'Analisador Adaptativo de Dados de Turma', 'Analisa desempenho dos alunos para identificar lacunas e sugerir agrupamentos.', 'EdTech e Professores 4.0', 'BarChart3'),
  ('editais-fomento', 'Assistente de Estruturação para Editais de Fomento', 'Ajuda a adequar linguagem e estruturar projetos para editais de fomento.', 'Pesquisa Acadêmica e Dados', 'FileText'),
  ('analise-estatistica', 'Consultor de Análise Estatística para Saúde', 'Indica testes estatísticos adequados e como interpretar resultados para publicação.', 'Pesquisa Acadêmica e Dados', 'Calculator'),
  ('seo-youtube', 'Estrategista de Conteúdo e SEO para YouTube', 'Gera títulos, roteiros, tags de SEO e sugestões de thumbnails para educação em saúde.', 'Produção de Conteúdo e Nicho Tech', 'Youtube'),
  ('fact-checker', 'Desmistificador e Fact-Checker de Saúde', 'Constrói argumentos sólidos baseados em evidências contra mitos e fake news de saúde.', 'Produção de Conteúdo e Nicho Tech', 'ShieldCheck');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
