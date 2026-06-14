
CREATE TABLE public.osce_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  specialty text,
  duration_minutes int NOT NULL DEFAULT 8,
  difficulty text NOT NULL DEFAULT 'medio',
  scenario_brief text NOT NULL,
  patient_persona text NOT NULL,
  patient_symptoms text NOT NULL,
  patient_omissions text,
  expected_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_conducts jsonb NOT NULL DEFAULT '[]'::jsonb,
  rubric jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.osce_stations TO authenticated;
GRANT ALL ON public.osce_stations TO service_role;
ALTER TABLE public.osce_stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own or public stations" ON public.osce_stations FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_public = true);
CREATE POLICY "manage own stations" ON public.osce_stations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER osce_stations_updated_at BEFORE UPDATE ON public.osce_stations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.osce_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  access_code text UNIQUE,
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.osce_exams TO authenticated;
GRANT ALL ON public.osce_exams TO service_role;
ALTER TABLE public.osce_exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view exams (owner or open)" ON public.osce_exams FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_open = true);
CREATE POLICY "manage own exams" ON public.osce_exams FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER osce_exams_updated_at BEFORE UPDATE ON public.osce_exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.osce_exam_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.osce_exams(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES public.osce_stations(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(exam_id, station_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.osce_exam_stations TO authenticated;
GRANT ALL ON public.osce_exam_stations TO service_role;
ALTER TABLE public.osce_exam_stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view exam stations" ON public.osce_exam_stations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.osce_exams e WHERE e.id = exam_id AND (e.user_id = auth.uid() OR e.is_open = true)));
CREATE POLICY "manage exam stations (owner)" ON public.osce_exam_stations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.osce_exams e WHERE e.id = exam_id AND e.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.osce_exams e WHERE e.id = exam_id AND e.user_id = auth.uid()));

CREATE TABLE public.osce_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  station_id uuid NOT NULL REFERENCES public.osce_stations(id) ON DELETE CASCADE,
  exam_id uuid REFERENCES public.osce_exams(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds int,
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  rubric_result jsonb,
  score numeric,
  max_score numeric,
  feedback text,
  credits_charged int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.osce_attempts TO authenticated;
GRANT ALL ON public.osce_attempts TO service_role;
ALTER TABLE public.osce_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own attempts or exam owner" ON public.osce_attempts FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.osce_stations s WHERE s.id = station_id AND s.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.osce_exams e WHERE e.id = exam_id AND e.user_id = auth.uid())
  );
CREATE POLICY "insert own attempts" ON public.osce_attempts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own attempts" ON public.osce_attempts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER osce_attempts_updated_at BEFORE UPDATE ON public.osce_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_osce_attempts_user ON public.osce_attempts(user_id);
CREATE INDEX idx_osce_attempts_station ON public.osce_attempts(station_id);
CREATE INDEX idx_osce_attempts_exam ON public.osce_attempts(exam_id);
CREATE INDEX idx_osce_exam_stations_exam ON public.osce_exam_stations(exam_id);
