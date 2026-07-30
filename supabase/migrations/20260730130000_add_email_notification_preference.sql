
-- Lets a user opt in to receiving their in-app notifications (pubmed-monitor digests,
-- and future notification types) by e-mail as well as via the notification bell.
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT false;
