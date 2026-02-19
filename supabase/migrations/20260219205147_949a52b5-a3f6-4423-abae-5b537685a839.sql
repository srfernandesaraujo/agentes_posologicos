
-- Knowledge bases table
CREATE TABLE public.knowledge_bases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_bases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own knowledge bases" ON public.knowledge_bases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own knowledge bases" ON public.knowledge_bases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own knowledge bases" ON public.knowledge_bases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own knowledge bases" ON public.knowledge_bases FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_knowledge_bases_updated_at
  BEFORE UPDATE ON public.knowledge_bases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Knowledge sources table
CREATE TABLE public.knowledge_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  knowledge_base_id UUID NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text', -- text, qa, file, webpage, website
  content TEXT NOT NULL DEFAULT '',
  url TEXT,
  file_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, ready, error
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sources" ON public.knowledge_sources FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sources" ON public.knowledge_sources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sources" ON public.knowledge_sources FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sources" ON public.knowledge_sources FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_knowledge_sources_updated_at
  BEFORE UPDATE ON public.knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link custom agents to knowledge bases
ALTER TABLE public.custom_agents ADD COLUMN knowledge_base_id UUID REFERENCES public.knowledge_bases(id) ON DELETE SET NULL;

-- Storage bucket for knowledge files
INSERT INTO storage.buckets (id, name, public) VALUES ('knowledge-files', 'knowledge-files', false);

CREATE POLICY "Users can upload own knowledge files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'knowledge-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own knowledge files" ON storage.objects FOR SELECT USING (bucket_id = 'knowledge-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own knowledge files" ON storage.objects FOR DELETE USING (bucket_id = 'knowledge-files' AND auth.uid()::text = (storage.foldername(name))[1]);
