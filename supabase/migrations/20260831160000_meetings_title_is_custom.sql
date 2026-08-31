-- Rastreia se o título da reunião foi digitado manualmente pelo usuário, para que
-- meeting-summary só sobrescreva o título automático (genérico, tipo "Reunião
-- 31/08/2026") com um título melhor gerado pela IA quando o usuário não escolheu
-- um título próprio.
ALTER TABLE public.meetings
  ADD COLUMN title_is_custom boolean NOT NULL DEFAULT false;
