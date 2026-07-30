
DO $$ BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'flow-triggers-scan';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'flow-triggers-scan',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://kmpwowdvljizswkhwhtq.supabase.co/functions/v1/flow-cron-trigger',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer sb_publishable_J8JQxZE5bTRaZ5qunWj1Hg_0ix7XN_I'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
