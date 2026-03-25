
CREATE TABLE public.system_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'feature',
  status text NOT NULL DEFAULT 'released',
  priority text NOT NULL DEFAULT 'medium',
  release_date timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.system_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all system updates"
  ON public.system_updates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view released updates"
  ON public.system_updates FOR SELECT
  TO authenticated
  USING (status = 'released');
