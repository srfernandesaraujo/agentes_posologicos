-- Conversa com o Time (Fase C): o escritório visual passa a reagir ao chat e às reuniões.
-- Esses eventos não pertencem a nenhuma missão, então squad_events.mission_id passa a aceitar nulo.
-- Eventos de missão continuam iguais; o filtro por mission_id e o índice existente seguem valendo.

ALTER TABLE public.squad_events ALTER COLUMN mission_id DROP NOT NULL;

-- Eventos do chat (sem missão) lidos por squad, do mais novo para o mais antigo.
CREATE INDEX IF NOT EXISTS squad_events_chat_idx ON public.squad_events (squad_id, id DESC) WHERE mission_id IS NULL;
