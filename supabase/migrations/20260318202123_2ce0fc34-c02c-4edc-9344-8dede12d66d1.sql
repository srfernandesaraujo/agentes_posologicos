
ALTER TABLE public.agent_flows ADD COLUMN IF NOT EXISTS execution_mode text NOT NULL DEFAULT 'sequential';
ALTER TABLE public.agent_flow_nodes ADD COLUMN IF NOT EXISTS is_synthesizer boolean NOT NULL DEFAULT false;
