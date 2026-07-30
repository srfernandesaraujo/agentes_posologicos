
-- Inter-rater calibration groundwork: a formal ratings table (one row per rater per
-- attempt) instead of only the single LLM score baked into osce_attempts. The LLM's own
-- grading becomes a rater_type='llm' row; a teacher can add a rater_type='human' row for
-- the same attempt, and the frontend compares them (src/lib/raterAgreement.ts).
CREATE TABLE public.osce_attempt_ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id uuid NOT NULL REFERENCES public.osce_attempts(id) ON DELETE CASCADE,
  rater_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rater_type text NOT NULL CHECK (rater_type IN ('llm', 'human')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  score numeric NOT NULL DEFAULT 0,
  max_score numeric NOT NULL DEFAULT 0,
  feedback text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.osce_attempt_ratings ENABLE ROW LEVEL SECURITY;

-- Writes go exclusively through osce-evaluate/osce-submit-rating (service role, which
-- bypasses RLS) so their own authorization checks are the real gate — this policy only
-- covers direct client-side reads.
CREATE POLICY "Relevant parties view attempt ratings"
  ON public.osce_attempt_ratings FOR SELECT
  USING (
    rater_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.osce_attempts a
      JOIN public.osce_stations s ON s.id = a.station_id
      WHERE a.id = attempt_id AND (a.user_id = auth.uid() OR s.user_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE INDEX idx_osce_attempt_ratings_attempt ON public.osce_attempt_ratings(attempt_id);

-- Case-bank sharing: a station can now also be visible to every member of one institution,
-- as an intermediate tier between "private" and "fully public". Depends on the institutions
-- model added in 20260730140000_add_institution_model.sql.
ALTER TABLE public.osce_stations
  ADD COLUMN institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL;

DROP POLICY "view own or public stations" ON public.osce_stations;
CREATE POLICY "view own, public, or institution-shared stations" ON public.osce_stations FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR is_public = true
    OR (institution_id IS NOT NULL AND public.is_institution_member(auth.uid(), institution_id))
  );
