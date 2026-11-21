-- Reunião Viva (Fase 2a): ata ao vivo. O servidor atualiza a ata durante a conversa; o dono pode editar.
-- minutes_live_at é o instante da última mensagem já incorporada à ata (cursor para pegar só a conversa nova).
ALTER TABLE public.squad_meetings
  ADD COLUMN IF NOT EXISTS minutes_live text,
  ADD COLUMN IF NOT EXISTS minutes_live_at timestamptz,
  ADD COLUMN IF NOT EXISTS minutes_live_version int NOT NULL DEFAULT 0;
