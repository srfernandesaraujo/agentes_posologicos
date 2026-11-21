-- Reunião Viva (Fase 4): ações propostas pelos agentes (e-mail, evento na agenda, convite por e-mail) e aprovadas pelo anfitrião.
-- O agente só propõe; a função `squad-meeting` valida por código, guarda aqui e só executa depois da aprovação do dono.
-- Escritas só pela função (service role). O dono lê (cartões ao vivo, com Realtime); convidado não tem acesso nenhum.

CREATE TABLE IF NOT EXISTS public.squad_meeting_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.squad_meetings(id) ON DELETE CASCADE,
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid,
  type text NOT NULL CHECK (type IN ('email', 'evento', 'aviso_convite')),
  -- Conteúdo já validado: {"to": [...], "subject": "...", "body": "..."} etc. (ver squadMeetingActions.ts)
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'executing', 'done', 'failed', 'discarded')),
  -- Dados pessoais ou segredos mascarados no texto proposto: [{"type": "cpf", "count": 1}]
  masked jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Resultado quando feito: {"id": "...", "link": "..."}; erro curto quando falhou.
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  executed_at timestamptz
);
CREATE INDEX IF NOT EXISTS squad_meeting_actions_meeting_idx ON public.squad_meeting_actions (meeting_id, created_at);

ALTER TABLE public.squad_meeting_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "squad_meeting_actions_owner_select" ON public.squad_meeting_actions FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
REVOKE INSERT, UPDATE, DELETE ON public.squad_meeting_actions FROM anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_meeting_actions;

-- Permissões do Google concedidas pelo usuário (lista do campo `scope` da resposta do OAuth). Conexões antigas ficam sem valor:
-- só têm o Drive, e a tela pede para reconectar quando falta Gmail ou Agenda.
ALTER TABLE public.google_connections ADD COLUMN IF NOT EXISTS scopes text;
