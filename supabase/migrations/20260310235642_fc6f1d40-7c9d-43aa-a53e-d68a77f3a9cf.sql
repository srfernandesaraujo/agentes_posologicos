-- Fix the restrictive SELECT policy for participants too
DROP POLICY IF EXISTS "Participants can read own messages in active rooms" ON public.room_messages;

CREATE POLICY "Participants can read own messages in active rooms"
  ON public.room_messages
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.virtual_rooms vr
      WHERE vr.id = room_messages.room_id AND vr.is_active = true
    )
  );