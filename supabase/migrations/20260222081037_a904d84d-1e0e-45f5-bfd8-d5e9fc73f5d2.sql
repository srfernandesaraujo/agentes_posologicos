
-- Create a security definer function to safely get the current user's email
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid()
$$;

-- Recreate the policy using the function instead of direct auth.users access
DROP POLICY IF EXISTS "Users can check own unlimited status" ON public.unlimited_users;
CREATE POLICY "Users can check own unlimited status"
  ON public.unlimited_users FOR SELECT
  USING (lower(email) = lower(public.get_current_user_email()));
