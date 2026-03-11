-- Allow anonymous users to see active virtual rooms (needed for room_messages RLS subqueries)
CREATE POLICY "Anon can view active rooms"
ON public.virtual_rooms
FOR SELECT
TO anon
USING (is_active = true);
