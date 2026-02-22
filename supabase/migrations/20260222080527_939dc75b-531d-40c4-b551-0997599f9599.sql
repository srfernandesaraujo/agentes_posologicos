
-- Fix: Make admin policies PERMISSIVE so admins can actually access unlimited_users
DROP POLICY IF EXISTS "Admins can view unlimited users" ON public.unlimited_users;
CREATE POLICY "Admins can view unlimited users"
  ON public.unlimited_users FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert unlimited users" ON public.unlimited_users;
CREATE POLICY "Admins can insert unlimited users"
  ON public.unlimited_users FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update unlimited users" ON public.unlimited_users;
CREATE POLICY "Admins can update unlimited users"
  ON public.unlimited_users FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete unlimited users" ON public.unlimited_users;
CREATE POLICY "Admins can delete unlimited users"
  ON public.unlimited_users FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
