
-- ============ PROJECTS ============
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#14b8a6',
  icon text NOT NULL DEFAULT 'FolderKanban',
  tags text[] NOT NULL DEFAULT '{}',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_projects_user ON public.projects(user_id);

-- ============ PROJECT COLLABORATORS ============
CREATE TABLE public.project_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer','editor')),
  invited_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_email)
);

ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_project_collab_email ON public.project_collaborators(lower(user_email));

-- ============ PROJECT ITEMS ============
CREATE TABLE public.project_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('conversation','flow','knowledge_base','meeting','certificate')),
  item_id uuid NOT NULL,
  added_by uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, item_type, item_id)
);

ALTER TABLE public.project_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_project_items_project ON public.project_items(project_id, item_type);

-- ============ ACCESS HELPER (SECURITY DEFINER) ============
CREATE OR REPLACE FUNCTION public.has_project_access(_project_id uuid, _user_id uuid, _min_role text DEFAULT 'viewer')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id AND p.user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.project_collaborators pc
    WHERE pc.project_id = _project_id
      AND lower(pc.user_email) = lower(public.get_current_user_email())
      AND (_min_role = 'viewer' OR pc.role = 'editor')
  );
$$;

-- ============ POLICIES: projects ============
CREATE POLICY "Owners can view own projects" ON public.projects
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Collaborators can view shared projects" ON public.projects
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_collaborators pc
    WHERE pc.project_id = projects.id
      AND lower(pc.user_email) = lower(public.get_current_user_email())
  ));

CREATE POLICY "Users can insert own projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update own projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete own projects" ON public.projects
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============ POLICIES: project_collaborators ============
CREATE POLICY "Owners can manage collaborators" ON public.project_collaborators
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_collaborators.project_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_collaborators.project_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Collaborators can view own collab record" ON public.project_collaborators
  FOR SELECT TO authenticated
  USING (lower(user_email) = lower(public.get_current_user_email()));

-- ============ POLICIES: project_items ============
CREATE POLICY "Members can view project items" ON public.project_items
  FOR SELECT TO authenticated
  USING (public.has_project_access(project_id, auth.uid(), 'viewer'));

CREATE POLICY "Editors can insert project items" ON public.project_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_project_access(project_id, auth.uid(), 'editor')
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Editors can delete project items" ON public.project_items
  FOR DELETE TO authenticated
  USING (
    public.has_project_access(project_id, auth.uid(), 'editor')
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
  );

-- ============ TRIGGERS ============
CREATE TRIGGER trg_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-exports', 'project-exports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Owners can read own exports" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'project-exports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can upload own exports" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-exports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can delete own exports" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'project-exports' AND auth.uid()::text = (storage.foldername(name))[1]);
