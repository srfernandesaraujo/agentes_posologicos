SELECT cron.schedule(
  'expire-virtual-rooms',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://kmpwowdvljizswkhwhtq.supabase.co/functions/v1/expire-rooms',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttcHdvd2R2bGppenN3a2h3aHRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzY2MDgsImV4cCI6MjA4NzA1MjYwOH0.9oOanYAZ2d2jb43deVvFkLBmy5A7t4SqfB4EO0RRmvE"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
)