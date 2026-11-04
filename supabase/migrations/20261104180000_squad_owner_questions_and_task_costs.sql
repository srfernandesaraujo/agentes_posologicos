-- Squads: perguntas bloqueantes ao dono no meio da missão + custo, modelo e duração por etapa.

-- 1) Novo status de missão: aguardando resposta do dono
ALTER TABLE public.squad_missions DROP CONSTRAINT IF EXISTS squad_missions_status_check;
ALTER TABLE public.squad_missions ADD CONSTRAINT squad_missions_status_check
  CHECK (status IN ('running', 'paused', 'awaiting_owner', 'awaiting_approval', 'completed', 'failed', 'cancelled'));

-- 2) Perguntas do squad ao dono
CREATE TABLE IF NOT EXISTS public.squad_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.squad_missions(id) ON DELETE CASCADE,
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.squad_tasks(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.squad_agents(id) ON DELETE SET NULL,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  why text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered')),
  answer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz
);
CREATE INDEX IF NOT EXISTS squad_questions_mission_idx ON public.squad_questions (mission_id, created_at);
ALTER TABLE public.squad_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "squad_questions_owner_select" ON public.squad_questions FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));

-- 3) Custo, modelo e duração por etapa
ALTER TABLE public.squad_tasks ADD COLUMN IF NOT EXISTS cost_usd numeric(10,6) NOT NULL DEFAULT 0;
ALTER TABLE public.squad_tasks ADD COLUMN IF NOT EXISTS tokens_input integer NOT NULL DEFAULT 0;
ALTER TABLE public.squad_tasks ADD COLUMN IF NOT EXISTS tokens_output integer NOT NULL DEFAULT 0;
ALTER TABLE public.squad_tasks ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE public.squad_tasks ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE public.squad_tasks ADD COLUMN IF NOT EXISTS duration_ms integer;
