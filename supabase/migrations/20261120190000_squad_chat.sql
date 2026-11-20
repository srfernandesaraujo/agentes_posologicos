-- Conversa com o Time (Fase A): o dono conversa com qualquer agente do squad (mensagem direta) ou com o time (#time).
-- Escritas (mensagens, custo, roteamento) são feitas pela edge function `squad-chat` com a service role;
-- o cliente só lê (e apaga a própria conversa). O teto mensal da conversa é por squad e separado do teto das missões.

ALTER TABLE public.squads
  ADD COLUMN IF NOT EXISTS chat_monthly_cap_usd numeric(8,2) NOT NULL DEFAULT 5
  CHECK (chat_monthly_cap_usd >= 0 AND chat_monthly_cap_usd <= 100);

CREATE TABLE IF NOT EXISTS public.squad_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 'team' (canal #time) ou o id do agente (mensagem direta), em texto.
  thread text NOT NULL,
  author text NOT NULL CHECK (author IN ('user', 'agent', 'system')),
  agent_id uuid REFERENCES public.squad_agents(id) ON DELETE SET NULL,
  content text NOT NULL,
  cost_usd numeric(10,6) NOT NULL DEFAULT 0,
  tokens_input int NOT NULL DEFAULT 0,
  tokens_output int NOT NULL DEFAULT 0,
  provider text,
  model text,
  -- Roteamento, avisos de máscara e de teto ficam aqui (ex.: {"router": {"agents": [...], "via": "llm"}}).
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS squad_chat_thread_idx ON public.squad_chat_messages (squad_id, thread, created_at);
CREATE INDEX IF NOT EXISTS squad_chat_month_idx ON public.squad_chat_messages (squad_id, created_at);

ALTER TABLE public.squad_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "squad_chat_owner_select" ON public.squad_chat_messages FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY "squad_chat_owner_delete" ON public.squad_chat_messages FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_chat_messages;

-- Gasto do mês da conversa (soma no banco: evita o limite de linhas por consulta). Só a service role chama.
CREATE OR REPLACE FUNCTION public.squad_chat_month_spend(p_squad uuid, p_since timestamptz)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(cost_usd), 0) FROM public.squad_chat_messages WHERE squad_id = p_squad AND created_at >= p_since;
$$;
REVOKE ALL ON FUNCTION public.squad_chat_month_spend(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.squad_chat_month_spend(uuid, timestamptz) TO service_role;
