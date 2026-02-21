
-- Table to track admin-invited users with unlimited access
CREATE TABLE public.unlimited_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  invited_by uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.unlimited_users ENABLE ROW LEVEL SECURITY;

-- Only admins can manage
CREATE POLICY "Admins can view unlimited users"
ON public.unlimited_users FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert unlimited users"
ON public.unlimited_users FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update unlimited users"
ON public.unlimited_users FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete unlimited users"
ON public.unlimited_users FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Users can check if their own email is in the list
CREATE POLICY "Users can check own unlimited status"
ON public.unlimited_users FOR SELECT
USING (lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())));
