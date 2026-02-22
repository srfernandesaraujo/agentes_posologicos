-- Drop the restrictive SELECT policy for users
DROP POLICY IF EXISTS "Users can check own unlimited status" ON public.unlimited_users;

-- Recreate as PERMISSIVE so users can actually read their own unlimited status
CREATE POLICY "Users can check own unlimited status"
ON public.unlimited_users
FOR SELECT
USING (
  lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())::text)
);
