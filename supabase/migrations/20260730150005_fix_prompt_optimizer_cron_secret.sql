
DO $$ BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'auto-fine-tune-agents';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'auto-fine-tune-agents',
  '0 4 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://kmpwowdvljizswkhwhtq.supabase.co/functions/v1/agent-prompt-optimizer',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret','6cac1717a40ee3fd04c38985ffea986aaf8c8c51721909aa916660ad44f35bfd'
    ),
    body := jsonb_build_object('agentId', s.agent_id, 'agentType', s.agent_type, 'triggeredBy','cron')
  )
  FROM public.agent_optimization_settings s
  WHERE s.auto_optimize_enabled = true;
  $cron$
);
