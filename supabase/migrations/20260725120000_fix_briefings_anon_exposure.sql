-- Security fix: the "anyone can read briefing by id" policy used USING (true),
-- which combined with GRANT SELECT ... TO anon let unauthenticated callers
-- SELECT * FROM briefings and dump every user's transcripts/summaries, not
-- just fetch a single briefing by its (unguessable) id as intended.
DROP POLICY IF EXISTS "anyone can read briefing by id" ON public.briefings;
REVOKE SELECT ON public.briefings FROM anon;

CREATE OR REPLACE FUNCTION public.get_briefing_by_id(p_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  transcript text,
  summary text,
  sections jsonb,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, title, transcript, summary, sections, created_at
  FROM public.briefings
  WHERE id = p_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_briefing_by_id(uuid) TO anon, authenticated;
