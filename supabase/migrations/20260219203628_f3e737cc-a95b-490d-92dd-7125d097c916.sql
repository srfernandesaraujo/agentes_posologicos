
-- Table to store user API keys for external LLMs
CREATE TABLE public.user_api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL, -- 'openai', 'anthropic', 'groq', 'openrouter', 'google'
  api_key_encrypted TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own API keys" ON public.user_api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own API keys" ON public.user_api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own API keys" ON public.user_api_keys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own API keys" ON public.user_api_keys FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_api_keys_updated_at BEFORE UPDATE ON public.user_api_keys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table for custom agents created by users
CREATE TABLE public.custom_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.5,
  provider TEXT NOT NULL DEFAULT 'groq', -- which API key provider to use
  restrict_content BOOLEAN NOT NULL DEFAULT false,
  markdown_response BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'published'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own custom agents" ON public.custom_agents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own custom agents" ON public.custom_agents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own custom agents" ON public.custom_agents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own custom agents" ON public.custom_agents FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_custom_agents_updated_at BEFORE UPDATE ON public.custom_agents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
