-- Reunião Viva (Fase 2b): arquivos da reunião (planilhas e documentos). O arquivo original NÃO é guardado: o servidor lê, mascara dados
-- pessoais conforme a sensibilidade do squad e guarda só a tabela lida (planilhas) ou o texto (documentos). Apagar a reunião apaga os arquivos.
-- Escritas só pela edge function `squad-meeting` (service role); o dono só lê.

CREATE TABLE IF NOT EXISTS public.squad_meeting_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.squad_meetings(id) ON DELETE CASCADE,
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('sheet', 'doc')),
  size_bytes int NOT NULL CHECK (size_bytes >= 0),
  sheet_name text,
  rows int,
  cols int,
  pages int,
  -- Planilha: {"headers": [...], "rows": [[...]]}. Documento: texto em content_text.
  table_data jsonb,
  content_text text,
  truncated boolean NOT NULL DEFAULT false,
  -- Dados pessoais ou segredos mascarados na leitura: [{"type": "cpf", "count": 3}]
  masked jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS squad_meeting_files_meeting_idx ON public.squad_meeting_files (meeting_id, created_at);

ALTER TABLE public.squad_meeting_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "squad_meeting_files_owner_select" ON public.squad_meeting_files FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
