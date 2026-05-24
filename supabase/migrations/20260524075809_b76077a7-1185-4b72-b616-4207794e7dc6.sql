
-- Security definer to check project ownership without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_project_owner(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND user_id = _user_id);
$$;

-- Replace recursive ALL policy with per-command policies using the security definer
DROP POLICY IF EXISTS "Owners can manage collaborators" ON public.project_collaborators;

CREATE POLICY "Owners can view collaborators"
  ON public.project_collaborators FOR SELECT
  USING (public.is_project_owner(project_id, auth.uid()));

CREATE POLICY "Owners can insert collaborators"
  ON public.project_collaborators FOR INSERT
  WITH CHECK (public.is_project_owner(project_id, auth.uid()));

CREATE POLICY "Owners can update collaborators"
  ON public.project_collaborators FOR UPDATE
  USING (public.is_project_owner(project_id, auth.uid()))
  WITH CHECK (public.is_project_owner(project_id, auth.uid()));

CREATE POLICY "Owners can delete collaborators"
  ON public.project_collaborators FOR DELETE
  USING (public.is_project_owner(project_id, auth.uid()));
