
DO $$ BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'pubmed-weekly-monitor';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'pubmed-weekly-monitor',
  '0 8 * * 1',
  $cron$
  SELECT net.http_post(
    url := 'https://kmpwowdvljizswkhwhtq.supabase.co/functions/v1/pubmed-monitor',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret', '6cac1717a40ee3fd04c38985ffea986aaf8c8c51721909aa916660ad44f35bfd'
    ),
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $cron$
);
