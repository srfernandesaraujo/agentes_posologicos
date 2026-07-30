ALTER TABLE public.osce_stations
  ADD COLUMN certification_status text NOT NULL DEFAULT 'none'
    CHECK (certification_status IN ('none','pending','certified','rejected')),
  ADD COLUMN submitted_at timestamptz,
  ADD COLUMN certified_at timestamptz,
  ADD COLUMN certified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN review_note text;

CREATE INDEX idx_osce_stations_pending ON public.osce_stations(certification_status)
  WHERE certification_status = 'pending';

-- Fecha o gap: institution_id só pode ser setado por professor/admin da própria instituição.
DROP POLICY "manage own stations" ON public.osce_stations;
CREATE POLICY "manage own stations" ON public.osce_stations FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      institution_id IS NULL
      OR public.has_institution_role(auth.uid(), institution_id, 'institution_admin')
      OR public.has_institution_role(auth.uid(), institution_id, 'teacher')
    )
  );

-- Amplia a leitura: estações certificadas são visíveis a qualquer usuário autenticado.
DROP POLICY "view own, public, or institution-shared stations" ON public.osce_stations;
CREATE POLICY "view own, public, institution-shared, or certified stations" ON public.osce_stations
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id
    OR is_public = true
    OR (institution_id IS NOT NULL AND public.is_institution_member(auth.uid(), institution_id))
    OR certification_status = 'certified'
  );

CREATE OR REPLACE FUNCTION public.submit_station_for_certification(p_station_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_institution uuid;
  v_status text;
BEGIN
  SELECT user_id, institution_id, certification_status
    INTO v_owner, v_institution, v_status
    FROM public.osce_stations WHERE id = p_station_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Estação não encontrada';
  END IF;
  IF v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF v_institution IS NULL THEN
    RAISE EXCEPTION 'A estação precisa estar vinculada a uma instituição';
  END IF;
  IF v_status NOT IN ('none', 'rejected') THEN
    RAISE EXCEPTION 'Estação já submetida ou certificada';
  END IF;
  IF NOT (
    public.has_institution_role(auth.uid(), v_institution, 'teacher')
    OR public.has_institution_role(auth.uid(), v_institution, 'institution_admin')
  ) THEN
    RAISE EXCEPTION 'Você não é mais professor/admin desta instituição';
  END IF;

  UPDATE public.osce_stations
    SET certification_status = 'pending', submitted_at = now(), review_note = NULL
    WHERE id = p_station_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_station_certification(p_station_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  UPDATE public.osce_stations
    SET certification_status = CASE WHEN p_approve THEN 'certified' ELSE 'rejected' END,
        certified_at = CASE WHEN p_approve THEN now() ELSE NULL END,
        certified_by = auth.uid(),
        review_note = p_note
    WHERE id = p_station_id AND certification_status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estação não está pendente de revisão';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_station_for_certification(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_station_certification(uuid, boolean, text) TO authenticated;
