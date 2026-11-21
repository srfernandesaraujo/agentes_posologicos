-- Reunião Viva (Fase 3): convidados humanos por link, com conta obrigatória.
-- De propósito NÃO há nenhuma política para `authenticated`/`anon`: com RLS ligado e sem política, só a função `squad-meeting`
-- (service role) lê e escreve aqui. As tabelas existentes (squad_meetings, squad_chat_messages, squad_meeting_files) continuam
-- legíveis só pelo dono; o convidado lê a reunião pela ação `view` da função, que devolve apenas campos seguros.

CREATE TABLE IF NOT EXISTS public.squad_meeting_members (
  meeting_id uuid NOT NULL REFERENCES public.squad_meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('participant', 'observer')),
  display_name text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meeting_id, user_id)
);
CREATE INDEX IF NOT EXISTS squad_meeting_members_user_idx ON public.squad_meeting_members (user_id);
ALTER TABLE public.squad_meeting_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.squad_meeting_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.squad_meetings(id) ON DELETE CASCADE,
  -- SHA-256 do token; o token em si só aparece uma vez, para o anfitrião copiar o link.
  token_hash text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('participant', 'observer')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS squad_meeting_invites_meeting_idx ON public.squad_meeting_invites (meeting_id, created_at DESC);
ALTER TABLE public.squad_meeting_invites ENABLE ROW LEVEL SECURITY;
