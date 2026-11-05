-- Memória compartilhada dos squads: um fato por linha, sugerido pelo squad e confirmado pelo dono.
-- O texto livre antigo (squads.memory) continua existindo como "notas do dono".
CREATE TABLE IF NOT EXISTS public.squad_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id uuid REFERENCES public.squad_missions(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'preference' CHECK (kind IN ('preference', 'correction', 'decision', 'fact')),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 300),
  source text NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'manual')),
  status text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'active', 'archived')),
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS squad_memories_squad_idx ON public.squad_memories (squad_id, status, created_at DESC);
ALTER TABLE public.squad_memories ENABLE ROW LEVEL SECURITY;
-- Leitura pelo dono; toda escrita passa pela edge function (service role), que valida e mascara dados pessoais.
CREATE POLICY "squad_memories_owner_select" ON public.squad_memories FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
