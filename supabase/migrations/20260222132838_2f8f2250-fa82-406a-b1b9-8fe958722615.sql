
-- Add marketplace flag to custom_agents
ALTER TABLE public.custom_agents ADD COLUMN IF NOT EXISTS published_to_marketplace boolean NOT NULL DEFAULT false;

-- Create agent_reviews table
CREATE TABLE public.agent_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.custom_agents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(agent_id, user_id)
);

ALTER TABLE public.agent_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read reviews for marketplace agents
CREATE POLICY "Anyone can read reviews of marketplace agents"
  ON public.agent_reviews FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.custom_agents ca
    WHERE ca.id = agent_reviews.agent_id AND ca.published_to_marketplace = true
  ));

CREATE POLICY "Users can insert own reviews"
  ON public.agent_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
  ON public.agent_reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews"
  ON public.agent_reviews FOR DELETE
  USING (auth.uid() = user_id);

-- Allow all authenticated users to view marketplace agents
CREATE POLICY "Anyone can view marketplace agents"
  ON public.custom_agents FOR SELECT
  USING (published_to_marketplace = true);

-- Trigger for updated_at
CREATE TRIGGER update_agent_reviews_updated_at
  BEFORE UPDATE ON public.agent_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
