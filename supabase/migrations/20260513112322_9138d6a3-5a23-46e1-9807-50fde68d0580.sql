
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
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttcHdvd2R2bGppenN3a2h3aHRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzY2MDgsImV4cCI6MjA4NzA1MjYwOH0.9oOanYAZ2d2jb43deVvFkLBmy5A7t4SqfB4EO0RRmvE'
    ),
    body := jsonb_build_object('agentId', s.agent_id, 'agentType', s.agent_type, 'triggeredBy','cron')
  )
  FROM public.agent_optimization_settings s
  WHERE s.auto_optimize_enabled = true;
  $cron$
);
