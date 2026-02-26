
CREATE TABLE public.agent_knowledge_bases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.custom_agents(id) ON DELETE CASCADE,
  knowledge_base_id UUID NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(agent_id, knowledge_base_id)
);

ALTER TABLE public.agent_knowledge_bases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent knowledge bases" ON public.agent_knowledge_bases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own agent knowledge bases" ON public.agent_knowledge_bases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own agent knowledge bases" ON public.agent_knowledge_bases FOR DELETE USING (auth.uid() = user_id);
