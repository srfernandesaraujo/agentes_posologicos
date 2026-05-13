
-- Auto Fine-Tuning de Agentes por Feedback
-- Tabela: versões de prompts
CREATE TABLE public.agent_prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  agent_type text NOT NULL CHECK (agent_type IN ('native','custom')),
  version integer NOT NULL,
  system_prompt text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('active','pending','archived','rejected')),
  origin text NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual','auto_feedback')),
  change_summary text,
  feedback_positive integer DEFAULT 0,
  feedback_negative integer DEFAULT 0,
  feedback_window_start timestamptz,
  feedback_window_end timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  UNIQUE(agent_id, agent_type, version)
);
CREATE INDEX idx_apv_agent ON public.agent_prompt_versions(agent_id, agent_type, status);
ALTER TABLE public.agent_prompt_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner or admin can view versions"
ON public.agent_prompt_versions FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR (agent_type='custom' AND EXISTS (SELECT 1 FROM public.custom_agents ca WHERE ca.id=agent_id AND ca.user_id=auth.uid()))
);

CREATE POLICY "Owner or admin can insert versions"
ON public.agent_prompt_versions FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(),'admin'::app_role)
  OR (agent_type='custom' AND EXISTS (SELECT 1 FROM public.custom_agents ca WHERE ca.id=agent_id AND ca.user_id=auth.uid()))
);

CREATE POLICY "Owner or admin can update versions"
ON public.agent_prompt_versions FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR (agent_type='custom' AND EXISTS (SELECT 1 FROM public.custom_agents ca WHERE ca.id=agent_id AND ca.user_id=auth.uid()))
);

CREATE POLICY "Owner or admin can delete versions"
ON public.agent_prompt_versions FOR DELETE TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR (agent_type='custom' AND EXISTS (SELECT 1 FROM public.custom_agents ca WHERE ca.id=agent_id AND ca.user_id=auth.uid()))
);

-- Tabela: execuções do otimizador
CREATE TABLE public.agent_optimization_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  agent_type text NOT NULL CHECK (agent_type IN ('native','custom')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed','skipped')),
  feedback_window_start timestamptz,
  feedback_window_end timestamptz,
  feedback_count integer DEFAULT 0,
  positive_count integer DEFAULT 0,
  negative_count integer DEFAULT 0,
  comments_used integer DEFAULT 0,
  model_used text,
  provider_used text,
  generated_version_id uuid REFERENCES public.agent_prompt_versions(id) ON DELETE SET NULL,
  error_message text,
  triggered_by text NOT NULL DEFAULT 'cron' CHECK (triggered_by IN ('cron','manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX idx_aor_agent ON public.agent_optimization_runs(agent_id, agent_type, created_at DESC);
ALTER TABLE public.agent_optimization_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner or admin can view runs"
ON public.agent_optimization_runs FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR (agent_type='custom' AND EXISTS (SELECT 1 FROM public.custom_agents ca WHERE ca.id=agent_id AND ca.user_id=auth.uid()))
);

-- Tabela: settings por agente
CREATE TABLE public.agent_optimization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  agent_type text NOT NULL CHECK (agent_type IN ('native','custom')),
  auto_optimize_enabled boolean NOT NULL DEFAULT false,
  auto_apply boolean NOT NULL DEFAULT false,
  min_feedbacks integer NOT NULL DEFAULT 10,
  negative_threshold numeric NOT NULL DEFAULT 0.20,
  last_run_at timestamptz,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, agent_type)
);
ALTER TABLE public.agent_optimization_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner or admin can view settings"
ON public.agent_optimization_settings FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR (agent_type='custom' AND EXISTS (SELECT 1 FROM public.custom_agents ca WHERE ca.id=agent_id AND ca.user_id=auth.uid()))
);
CREATE POLICY "Owner or admin can insert settings"
ON public.agent_optimization_settings FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(),'admin'::app_role)
  OR (agent_type='custom' AND EXISTS (SELECT 1 FROM public.custom_agents ca WHERE ca.id=agent_id AND ca.user_id=auth.uid()))
);
CREATE POLICY "Owner or admin can update settings"
ON public.agent_optimization_settings FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR (agent_type='custom' AND EXISTS (SELECT 1 FROM public.custom_agents ca WHERE ca.id=agent_id AND ca.user_id=auth.uid()))
);

CREATE TRIGGER trg_aos_updated_at
BEFORE UPDATE ON public.agent_optimization_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
