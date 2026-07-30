CREATE TABLE public.agent_flow_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.agent_flows(id) ON DELETE CASCADE,
  trigger_type text NOT NULL CHECK (trigger_type IN ('cron','webhook')),
  enabled boolean NOT NULL DEFAULT false,
  default_input text NOT NULL DEFAULT '',
  frequency text CHECK (frequency IN ('hourly','daily','weekly')),
  run_hour smallint CHECK (run_hour BETWEEN 0 AND 23),
  run_day_of_week smallint CHECK (run_day_of_week BETWEEN 0 AND 6),
  last_run_at timestamptz,
  webhook_token text UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flow_id, trigger_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_flow_triggers TO authenticated;
GRANT ALL ON public.agent_flow_triggers TO service_role;
ALTER TABLE public.agent_flow_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage triggers of own flows" ON public.agent_flow_triggers
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.agent_flows f WHERE f.id = flow_id AND f.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.agent_flows f WHERE f.id = flow_id AND f.user_id = auth.uid()));

CREATE TRIGGER trg_agent_flow_triggers_updated_at
  BEFORE UPDATE ON public.agent_flow_triggers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.regenerate_flow_webhook_token(p_trigger_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_token text;
BEGIN
  UPDATE public.agent_flow_triggers t
  SET webhook_token = encode(extensions.gen_random_bytes(24), 'hex')
  FROM public.agent_flows f
  WHERE t.id = p_trigger_id
    AND t.flow_id = f.id
    AND f.user_id = auth.uid()
    AND t.trigger_type = 'webhook'
  RETURNING t.webhook_token INTO v_new_token;

  IF v_new_token IS NULL THEN
    RAISE EXCEPTION 'Gatilho não encontrado ou sem permissão';
  END IF;

  RETURN v_new_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.regenerate_flow_webhook_token(uuid) TO authenticated;
