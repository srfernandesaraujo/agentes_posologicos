
-- Create saved_templates table for user input templates per agent
CREATE TABLE public.saved_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_templates ENABLE ROW LEVEL SECURITY;

-- Users can view own templates
CREATE POLICY "Users can view own templates"
ON public.saved_templates FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert own templates
CREATE POLICY "Users can insert own templates"
ON public.saved_templates FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update own templates
CREATE POLICY "Users can update own templates"
ON public.saved_templates FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete own templates
CREATE POLICY "Users can delete own templates"
ON public.saved_templates FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_saved_templates_updated_at
BEFORE UPDATE ON public.saved_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookup
CREATE INDEX idx_saved_templates_user_agent ON public.saved_templates (user_id, agent_id);
