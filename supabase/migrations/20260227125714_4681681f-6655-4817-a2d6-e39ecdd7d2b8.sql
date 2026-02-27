ALTER TABLE public.custom_agents
  DROP CONSTRAINT IF EXISTS custom_agents_knowledge_base_id_fkey;

ALTER TABLE public.custom_agents
  ADD CONSTRAINT custom_agents_knowledge_base_id_fkey
  FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_bases(id) ON DELETE SET NULL;