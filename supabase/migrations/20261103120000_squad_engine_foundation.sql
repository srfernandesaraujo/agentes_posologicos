-- Fase 0 do Escritório de Agentes (squads): fundação do motor.
-- Tabelas: squads, squad_agents, squad_missions, squad_tasks, squad_events, squad_deliverables.
-- Tudo é visível apenas para o dono (owner_id = auth.uid()). Escritas de missão/tarefa/evento/entrega
-- são feitas pela edge function `squad-engine` com a service role; o cliente só lê (e gerencia o
-- próprio squad). O mapa visual lê `squad_events` via Realtime.

CREATE TABLE IF NOT EXISTS public.squads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_slug text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'mission' CHECK (kind IN ('mission', 'continuous')),
  sensitivity text NOT NULL DEFAULT 'normal' CHECK (sensitivity IN ('normal', 'dados_pessoais', 'dados_saude')),
  environment text NOT NULL,
  default_cost_cap_usd numeric(8,2) NOT NULL DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS squads_owner_idx ON public.squads (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.squad_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  role text NOT NULL,
  room text NOT NULL CHECK (room IN ('dir', 'ops', 'lib', 'meet', 'copa')),
  system_prompt text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (squad_id, slug)
);

CREATE TABLE IF NOT EXISTS public.squad_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  briefing text NOT NULL,
  form_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'paused', 'awaiting_approval', 'completed', 'failed', 'cancelled')),
  cost_cap_usd numeric(8,2) NOT NULL,
  cost_usd numeric(10,6) NOT NULL DEFAULT 0,
  tokens_input bigint NOT NULL DEFAULT 0,
  tokens_output bigint NOT NULL DEFAULT 0,
  warned_80 boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS squad_missions_squad_idx ON public.squad_missions (squad_id, created_at DESC);
CREATE INDEX IF NOT EXISTS squad_missions_owner_idx ON public.squad_missions (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.squad_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.squad_missions(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.squad_agents(id) ON DELETE CASCADE,
  position int NOT NULL,
  depends_on_position int,
  title text NOT NULL,
  instructions text NOT NULL,
  deliverable_spec jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed')),
  output text,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  UNIQUE (mission_id, position)
);
CREATE INDEX IF NOT EXISTS squad_tasks_mission_idx ON public.squad_tasks (mission_id, position);

-- Barramento de eventos: tudo o que o escritório visual mostra nasce daqui.
CREATE TABLE IF NOT EXISTS public.squad_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mission_id uuid NOT NULL REFERENCES public.squad_missions(id) ON DELETE CASCADE,
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.squad_agents(id) ON DELETE SET NULL,
  type text NOT NULL,
  text text,
  room text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS squad_events_mission_idx ON public.squad_events (mission_id, id);

CREATE TABLE IF NOT EXISTS public.squad_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.squad_missions(id) ON DELETE CASCADE,
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.squad_agents(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.squad_tasks(id) ON DELETE SET NULL,
  title text NOT NULL,
  kind text NOT NULL,
  version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'done' CHECK (status IN ('done', 'in_review', 'approved', 'changes_requested')),
  content text NOT NULL,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS squad_deliverables_mission_idx ON public.squad_deliverables (mission_id, created_at);

-- ---------- RLS: somente o dono ----------
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_deliverables ENABLE ROW LEVEL SECURITY;

-- Squad: o dono lê e apaga (criar passa pela edge function, que valida o template).
CREATE POLICY "squads_owner_select" ON public.squads FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY "squads_owner_delete" ON public.squads FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY "squad_agents_owner_select" ON public.squad_agents FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY "squad_missions_owner_select" ON public.squad_missions FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY "squad_tasks_owner_select" ON public.squad_tasks FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY "squad_events_owner_select" ON public.squad_events FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY "squad_deliverables_owner_select" ON public.squad_deliverables FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));

-- Tempo real para o escritório visual (RLS filtra por dono também no Realtime).
ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_missions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_deliverables;
