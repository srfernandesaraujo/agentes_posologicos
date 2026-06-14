
-- =====================================
-- OSCE Live Sessions (síncrono via sala)
-- =====================================

CREATE TABLE public.osce_exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.osce_exams(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  pin text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'waiting', -- waiting | running | paused | finished
  current_station_index integer NOT NULL DEFAULT -1, -- -1 = não iniciado
  current_station_started_at timestamptz,
  auto_advance boolean NOT NULL DEFAULT true,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.osce_exam_sessions TO authenticated;
GRANT ALL ON public.osce_exam_sessions TO service_role;

ALTER TABLE public.osce_exam_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.osce_session_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.osce_exam_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text,
  current_attempt_id uuid,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.osce_session_participants TO authenticated;
GRANT ALL ON public.osce_session_participants TO service_role;

ALTER TABLE public.osce_session_participants ENABLE ROW LEVEL SECURITY;

-- Add session_id to osce_attempts
ALTER TABLE public.osce_attempts
  ADD COLUMN session_id uuid REFERENCES public.osce_exam_sessions(id) ON DELETE SET NULL;
CREATE INDEX idx_osce_attempts_session ON public.osce_attempts(session_id);

-- ====== Security definer helpers (avoid recursive RLS) ======

CREATE OR REPLACE FUNCTION public.is_osce_session_owner(_session_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.osce_exam_sessions WHERE id = _session_id AND owner_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_osce_session_participant(_session_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.osce_session_participants WHERE session_id = _session_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.get_osce_session_by_pin(_pin text)
RETURNS TABLE(id uuid, exam_id uuid, owner_id uuid, status text, current_station_index integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, exam_id, owner_id, status, current_station_index
  FROM public.osce_exam_sessions
  WHERE pin = _pin AND status <> 'finished'
  LIMIT 1;
$$;

-- ====== RLS policies ======

-- osce_exam_sessions: owner full; participants can read their session
CREATE POLICY "owner manages sessions" ON public.osce_exam_sessions
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "participants read session" ON public.osce_exam_sessions
  FOR SELECT TO authenticated
  USING (public.is_osce_session_participant(id, auth.uid()));

-- osce_session_participants: user manages their own row; session owner sees all
CREATE POLICY "user joins as self" ON public.osce_session_participants
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user updates own participant row" ON public.osce_session_participants
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user reads own participant row" ON public.osce_session_participants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_osce_session_owner(session_id, auth.uid()));

CREATE POLICY "owner removes participants" ON public.osce_session_participants
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_osce_session_owner(session_id, auth.uid()));

-- updated_at trigger
CREATE TRIGGER osce_exam_sessions_updated_at
  BEFORE UPDATE ON public.osce_exam_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.osce_exam_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.osce_session_participants;
ALTER TABLE public.osce_exam_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.osce_session_participants REPLICA IDENTITY FULL;
