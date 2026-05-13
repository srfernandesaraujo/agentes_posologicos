ALTER TABLE public.agent_flows
  ADD COLUMN IF NOT EXISTS input_type text;

ALTER TABLE public.agent_flow_nodes
  ADD COLUMN IF NOT EXISTS branch_key text NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS is_router boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS router_branches jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.agent_flow_edges
  ADD COLUMN IF NOT EXISTS branch_key text;