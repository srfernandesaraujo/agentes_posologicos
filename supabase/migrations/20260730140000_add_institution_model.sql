
-- Foundation for "modo institucional/LMS": institutions, per-institution roles (separate
-- from the global app_role admin/user enum), turmas (classes) and enrollments. SSO is
-- explicitly out of scope here — this only lays the RBAC groundwork so it isn't blocked
-- later.

CREATE TYPE public.institution_role AS ENUM ('institution_admin', 'teacher', 'student');

CREATE TABLE public.institutions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.institution_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.institution_role NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (institution_id, user_id)
);

CREATE TABLE public.turmas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.turma_enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrolled_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (turma_id, student_id)
);

-- Same SECURITY DEFINER pattern as public.has_role, scoped to one institution.
CREATE OR REPLACE FUNCTION public.has_institution_role(_user_id uuid, _institution_id uuid, _role public.institution_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.institution_members
    WHERE user_id = _user_id AND institution_id = _institution_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_institution_member(_user_id uuid, _institution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.institution_members
    WHERE user_id = _user_id AND institution_id = _institution_id
  )
$$;

-- Whoever creates an institution becomes its first institution_admin.
CREATE OR REPLACE FUNCTION public.handle_new_institution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.institution_members (institution_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'institution_admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_institution_created
AFTER INSERT ON public.institutions
FOR EACH ROW EXECUTE FUNCTION public.handle_new_institution();

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turma_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own institution"
  ON public.institutions FOR SELECT
  USING (public.is_institution_member(auth.uid(), id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can create an institution"
  ON public.institutions FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Institution admins can update their institution"
  ON public.institutions FOR UPDATE
  USING (public.has_institution_role(auth.uid(), id, 'institution_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can view own institution roster"
  ON public.institution_members FOR SELECT
  USING (public.is_institution_member(auth.uid(), institution_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Institution admins manage members"
  ON public.institution_members FOR ALL
  USING (public.has_institution_role(auth.uid(), institution_id, 'institution_admin') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_institution_role(auth.uid(), institution_id, 'institution_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Institution members can view turmas of own institution"
  ON public.turmas FOR SELECT
  USING (public.is_institution_member(auth.uid(), institution_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers and institution admins manage turmas"
  ON public.turmas FOR ALL
  USING (
    teacher_id = auth.uid()
    OR public.has_institution_role(auth.uid(), institution_id, 'institution_admin')
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.has_institution_role(auth.uid(), institution_id, 'teacher')
    OR public.has_institution_role(auth.uid(), institution_id, 'institution_admin')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Relevant parties view turma enrollments"
  ON public.turma_enrollments FOR SELECT
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.turmas t
      WHERE t.id = turma_id
        AND (t.teacher_id = auth.uid() OR public.has_institution_role(auth.uid(), t.institution_id, 'institution_admin'))
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Teachers and institution admins manage enrollments"
  ON public.turma_enrollments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.turmas t
      WHERE t.id = turma_id
        AND (t.teacher_id = auth.uid() OR public.has_institution_role(auth.uid(), t.institution_id, 'institution_admin'))
    )
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    -- Also requires the enrolled user to already be a 'student' member of the turma's own
    -- institution — otherwise a teacher could enroll an arbitrary user_id (e.g. someone
    -- else's account) into their turma and read that person's OSCE scores via
    -- get_turma_gradebook without any institution relationship or consent.
    EXISTS (
      SELECT 1 FROM public.turmas t
      WHERE t.id = turma_id
        AND (t.teacher_id = auth.uid() OR public.has_institution_role(auth.uid(), t.institution_id, 'institution_admin'))
        AND public.has_institution_role(student_id, t.institution_id, 'student')
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE INDEX idx_institution_members_user ON public.institution_members(user_id);
CREATE INDEX idx_turmas_institution ON public.turmas(institution_id);
CREATE INDEX idx_turma_enrollments_student ON public.turma_enrollments(student_id);

-- Gradebook: returns only the aggregate OSCE result fields (never the full transcript) for
-- students enrolled in a turma, so a teacher can see performance without a blanket RLS
-- policy widening read access to osce_attempts (which holds simulated-patient transcripts).
-- SECURITY DEFINER + an explicit permission check inside, mirroring has_role/has_institution_role.
CREATE OR REPLACE FUNCTION public.get_turma_gradebook(_turma_id uuid)
RETURNS TABLE (
  student_id uuid,
  student_name text,
  station_title text,
  score numeric,
  max_score numeric,
  completed_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.turmas t
    WHERE t.id = _turma_id
      AND (t.teacher_id = auth.uid() OR public.has_institution_role(auth.uid(), t.institution_id, 'institution_admin'))
  ) AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    e.student_id,
    COALESCE(p.display_name, 'Aluno'),
    s.title,
    a.score,
    a.max_score,
    a.ended_at
  FROM public.turma_enrollments e
  LEFT JOIN public.profiles p ON p.user_id = e.student_id
  LEFT JOIN public.osce_attempts a ON a.user_id = e.student_id AND a.status = 'completed'
  LEFT JOIN public.osce_stations s ON s.id = a.station_id
  WHERE e.turma_id = _turma_id
  ORDER BY a.ended_at DESC NULLS LAST;
END;
$$;
