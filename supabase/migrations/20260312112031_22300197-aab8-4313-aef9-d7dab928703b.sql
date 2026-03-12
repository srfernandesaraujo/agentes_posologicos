
-- Agent Flows
CREATE TABLE public.agent_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own flows" ON public.agent_flows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own flows" ON public.agent_flows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own flows" ON public.agent_flows FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own flows" ON public.agent_flows FOR DELETE USING (auth.uid() = user_id);

-- Agent Flow Nodes
CREATE TABLE public.agent_flow_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.agent_flows(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL,
  agent_type text NOT NULL DEFAULT 'native',
  position_x numeric NOT NULL DEFAULT 0,
  position_y numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  input_prompt text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_flow_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own flow nodes" ON public.agent_flow_nodes FOR SELECT USING (EXISTS (SELECT 1 FROM public.agent_flows f WHERE f.id = flow_id AND f.user_id = auth.uid()));
CREATE POLICY "Users can insert own flow nodes" ON public.agent_flow_nodes FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.agent_flows f WHERE f.id = flow_id AND f.user_id = auth.uid()));
CREATE POLICY "Users can update own flow nodes" ON public.agent_flow_nodes FOR UPDATE USING (EXISTS (SELECT 1 FROM public.agent_flows f WHERE f.id = flow_id AND f.user_id = auth.uid()));
CREATE POLICY "Users can delete own flow nodes" ON public.agent_flow_nodes FOR DELETE USING (EXISTS (SELECT 1 FROM public.agent_flows f WHERE f.id = flow_id AND f.user_id = auth.uid()));

-- Agent Flow Edges
CREATE TABLE public.agent_flow_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.agent_flows(id) ON DELETE CASCADE,
  source_node_id uuid NOT NULL REFERENCES public.agent_flow_nodes(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES public.agent_flow_nodes(id) ON DELETE CASCADE
);
ALTER TABLE public.agent_flow_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own flow edges" ON public.agent_flow_edges FOR SELECT USING (EXISTS (SELECT 1 FROM public.agent_flows f WHERE f.id = flow_id AND f.user_id = auth.uid()));
CREATE POLICY "Users can insert own flow edges" ON public.agent_flow_edges FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.agent_flows f WHERE f.id = flow_id AND f.user_id = auth.uid()));
CREATE POLICY "Users can update own flow edges" ON public.agent_flow_edges FOR UPDATE USING (EXISTS (SELECT 1 FROM public.agent_flows f WHERE f.id = flow_id AND f.user_id = auth.uid()));
CREATE POLICY "Users can delete own flow edges" ON public.agent_flow_edges FOR DELETE USING (EXISTS (SELECT 1 FROM public.agent_flows f WHERE f.id = flow_id AND f.user_id = auth.uid()));

-- Agent Flow Executions
CREATE TABLE public.agent_flow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.agent_flows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'running',
  initial_input text NOT NULL DEFAULT '',
  final_output text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE public.agent_flow_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own executions" ON public.agent_flow_executions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own executions" ON public.agent_flow_executions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own executions" ON public.agent_flow_executions FOR UPDATE USING (auth.uid() = user_id);

-- Agent Flow Node Results
CREATE TABLE public.agent_flow_node_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES public.agent_flow_executions(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES public.agent_flow_nodes(id) ON DELETE CASCADE,
  input_text text NOT NULL DEFAULT '',
  output_text text,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz
);
ALTER TABLE public.agent_flow_node_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own node results" ON public.agent_flow_node_results FOR SELECT USING (EXISTS (SELECT 1 FROM public.agent_flow_executions e WHERE e.id = execution_id AND e.user_id = auth.uid()));
CREATE POLICY "Users can insert own node results" ON public.agent_flow_node_results FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.agent_flow_executions e WHERE e.id = execution_id AND e.user_id = auth.uid()));
CREATE POLICY "Users can update own node results" ON public.agent_flow_node_results FOR UPDATE USING (EXISTS (SELECT 1 FROM public.agent_flow_executions e WHERE e.id = execution_id AND e.user_id = auth.uid()));

-- Trigger for updated_at on agent_flows
CREATE TRIGGER update_agent_flows_updated_at BEFORE UPDATE ON public.agent_flows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
