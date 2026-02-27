
-- Drop existing FKs and re-create with CASCADE for knowledge_sources -> knowledge_bases
ALTER TABLE public.knowledge_sources
  DROP CONSTRAINT IF EXISTS knowledge_sources_knowledge_base_id_fkey;

ALTER TABLE public.knowledge_sources
  ADD CONSTRAINT knowledge_sources_knowledge_base_id_fkey
  FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_bases(id) ON DELETE CASCADE;

-- Drop existing FK and re-create with CASCADE for agent_knowledge_bases -> knowledge_bases
ALTER TABLE public.agent_knowledge_bases
  DROP CONSTRAINT IF EXISTS agent_knowledge_bases_knowledge_base_id_fkey;

ALTER TABLE public.agent_knowledge_bases
  ADD CONSTRAINT agent_knowledge_bases_knowledge_base_id_fkey
  FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_bases(id) ON DELETE CASCADE;
