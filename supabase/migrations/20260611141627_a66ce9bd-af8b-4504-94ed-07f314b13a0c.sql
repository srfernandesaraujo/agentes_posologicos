
-- Aula ao Vivo: extend virtual_rooms and room_messages
ALTER TABLE public.virtual_rooms
  ADD COLUMN IF NOT EXISTS live_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_broadcast_prompt text;

ALTER TABLE public.room_messages
  ADD COLUMN IF NOT EXISTS is_broadcast boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_question boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;

-- Flow Marketplace: extend agent_flows
ALTER TABLE public.agent_flows
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS installs_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forked_from uuid REFERENCES public.agent_flows(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS creator_earnings integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_agent_flows_published ON public.agent_flows(published) WHERE published = true;

-- Allow ANY authenticated user to SELECT flows that are published (for marketplace listing)
DROP POLICY IF EXISTS "Anyone can view published flows" ON public.agent_flows;
CREATE POLICY "Anyone can view published flows"
ON public.agent_flows
FOR SELECT
TO authenticated
USING (published = true);

-- Marketplace flows RPC (avoids exposing extra columns)
CREATE OR REPLACE FUNCTION public.get_marketplace_flows()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  name text,
  description text,
  category text,
  execution_mode text,
  installs_count integer,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, user_id, name, description, category, execution_mode, installs_count, created_at
  FROM public.agent_flows
  WHERE published = true
  ORDER BY installs_count DESC, created_at DESC;
$$;

-- Reviews for flows
CREATE TABLE IF NOT EXISTS public.flow_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.agent_flows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (flow_id, user_id)
);

GRANT SELECT ON public.flow_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flow_reviews TO authenticated;
GRANT ALL ON public.flow_reviews TO service_role;

ALTER TABLE public.flow_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view flow reviews"
ON public.flow_reviews FOR SELECT
USING (true);

CREATE POLICY "Users can write their own flow reviews"
ON public.flow_reviews FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own flow reviews"
ON public.flow_reviews FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own flow reviews"
ON public.flow_reviews FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Installs ledger for flows
CREATE TABLE IF NOT EXISTS public.flow_installs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_flow_id uuid NOT NULL REFERENCES public.agent_flows(id) ON DELETE CASCADE,
  installed_flow_id uuid NOT NULL REFERENCES public.agent_flows(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  credits_spent integer NOT NULL DEFAULT 5,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.flow_installs TO authenticated;
GRANT ALL ON public.flow_installs TO service_role;

ALTER TABLE public.flow_installs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can see their installs"
ON public.flow_installs FOR SELECT
TO authenticated
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- updated_at trigger for flow_reviews
DROP TRIGGER IF EXISTS update_flow_reviews_updated_at ON public.flow_reviews;
CREATE TRIGGER update_flow_reviews_updated_at
BEFORE UPDATE ON public.flow_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
