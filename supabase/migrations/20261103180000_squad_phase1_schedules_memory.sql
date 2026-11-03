-- Fase 1 do Escritório de Agentes: memória do squad, contexto por missão e agendamento
-- de squads contínuos.
--
-- O job do pg_cron que chama `squad-cron-tick` NÃO está nesta migração de propósito:
-- ele carrega um segredo (SQUAD_CRON_SECRET) e não deve ir para o repositório.
-- Ele é criado diretamente no banco (ver CHANGELOG da fase / instruções do deploy).

ALTER TABLE public.squads ADD COLUMN IF NOT EXISTS memory text NOT NULL DEFAULT '';

ALTER TABLE public.squad_missions ADD COLUMN IF NOT EXISTS context text NOT NULL DEFAULT '';
ALTER TABLE public.squad_missions ADD COLUMN IF NOT EXISTS trigger text NOT NULL DEFAULT 'manual'
  CHECK (trigger IN ('manual', 'schedule'));

CREATE TABLE IF NOT EXISTS public.squad_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL UNIQUE REFERENCES public.squads(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  frequency text NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly')),
  run_hour int NOT NULL DEFAULT 7 CHECK (run_hour BETWEEN 0 AND 23),      -- horário de Brasília
  run_day_of_week int CHECK (run_day_of_week BETWEEN 0 AND 6),            -- 0 = domingo
  form_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  cost_cap_usd numeric(8,2) NOT NULL DEFAULT 2,                           -- teto por execução
  monthly_cap_usd numeric(8,2) NOT NULL DEFAULT 20,                       -- teto por mês, somando as execuções
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS squad_schedules_due_idx ON public.squad_schedules (enabled, frequency);

ALTER TABLE public.squad_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "squad_schedules_owner_select" ON public.squad_schedules FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
