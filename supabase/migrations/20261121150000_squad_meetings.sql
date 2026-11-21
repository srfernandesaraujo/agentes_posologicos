-- Reunião Viva (Fase 1): reunião com pauta, em que os agentes escutam e entram sozinhos quando têm algo útil a dizer.
-- As mensagens continuam em squad_chat_messages (meta.meeting.id); esta tabela guarda o estado da reunião
-- (pauta, item atual, nível de proatividade, silêncio, teto, trava de execução e a ata final).
-- Escritas só pela edge function `squad-meeting` (service role); o dono só lê (Realtime incluído).

CREATE TABLE IF NOT EXISTS public.squad_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  -- [{ "title": "...", "done": false, "decision": "..." }]
  agenda jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_item int NOT NULL DEFAULT 0 CHECK (current_item >= 0),
  proactivity text NOT NULL DEFAULT 'balanced' CHECK (proactivity IN ('calm', 'balanced', 'active')),
  participants uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'ended')),
  cap_usd numeric(8,2) NOT NULL DEFAULT 1 CHECK (cap_usd > 0 AND cap_usd <= 20),
  silenced_until timestamptz,
  -- Só um ciclo de turno roda por vez em cada reunião; o resto espera ou volta como "ocupado".
  lock_until timestamptz,
  minutes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
CREATE INDEX IF NOT EXISTS squad_meetings_squad_idx ON public.squad_meetings (squad_id, created_at DESC);

ALTER TABLE public.squad_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "squad_meetings_owner_select" ON public.squad_meetings FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_meetings;

-- Gasto da reunião: soma das mensagens dela (inclui as ocultas do avaliador e das falas descartadas).
CREATE OR REPLACE FUNCTION public.squad_meeting_spend(p_squad uuid, p_meeting text)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(cost_usd), 0) FROM public.squad_chat_messages
  WHERE squad_id = p_squad AND meta @> jsonb_build_object('meeting', jsonb_build_object('id', p_meeting));
$$;
REVOKE ALL ON FUNCTION public.squad_meeting_spend(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.squad_meeting_spend(uuid, text) TO service_role;
