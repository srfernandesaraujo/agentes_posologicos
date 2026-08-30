
DO $$ BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'meeting-sync-cron';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Every 5 minutes: advance the Google Drive transcript matching/summarizing state machine
-- for every connected user, so meetings progress even with the /reunioes tab closed
-- (the old Recall.ai bot didn't need this because it ran independently of the app).
SELECT cron.schedule(
  'meeting-sync-cron',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://kmpwowdvljizswkhwhtq.supabase.co/functions/v1/meeting-sync-cron',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret','6cac1717a40ee3fd04c38985ffea986aaf8c8c51721909aa916660ad44f35bfd'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
