-- Squads: verificações por etapa (medições por código, etapas condicionais) e modelo usado em cada entrega.
ALTER TABLE public.squad_tasks ADD COLUMN IF NOT EXISTS checks jsonb;
ALTER TABLE public.squad_deliverables ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE public.squad_deliverables ADD COLUMN IF NOT EXISTS model text;
