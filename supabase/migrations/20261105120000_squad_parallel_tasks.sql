-- Paralelismo nos squads: dependências múltiplas por tarefa e soma atômica de custo da missão.
ALTER TABLE public.squad_tasks ADD COLUMN IF NOT EXISTS depends_on_positions int[] NOT NULL DEFAULT '{}';

-- Preenche as tarefas já existentes a partir da dependência única.
UPDATE public.squad_tasks SET depends_on_positions = ARRAY[depends_on_position]
 WHERE depends_on_position IS NOT NULL AND depends_on_positions = '{}';

-- Tarefas em paralelo terminam ao mesmo tempo: ler-e-somar perderia custo. Esta função soma no banco.
CREATE OR REPLACE FUNCTION public.squad_add_mission_cost(p_mission uuid, p_cost numeric, p_in bigint, p_out bigint)
RETURNS TABLE (cost_usd numeric, cost_cap_usd numeric, warned_80 boolean)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.squad_missions m
     SET cost_usd = m.cost_usd + p_cost,
         tokens_input = m.tokens_input + p_in,
         tokens_output = m.tokens_output + p_out
   WHERE m.id = p_mission
  RETURNING m.cost_usd, m.cost_cap_usd, m.warned_80;
$$;

REVOKE ALL ON FUNCTION public.squad_add_mission_cost(uuid, numeric, bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.squad_add_mission_cost(uuid, numeric, bigint, bigint) TO service_role;
