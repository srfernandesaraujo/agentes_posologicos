ALTER TABLE public.osce_exam_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.osce_session_participants REPLICA IDENTITY FULL;
ALTER TABLE public.osce_attempts REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.osce_exam_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.osce_session_participants;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.osce_attempts;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;