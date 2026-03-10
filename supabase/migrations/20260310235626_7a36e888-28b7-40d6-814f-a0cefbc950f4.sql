-- Drop the restrictive policy
DROP POLICY IF EXISTS "Anyone can insert messages into active rooms" ON public.room_messages;

-- Recreate as PERMISSIVE
CREATE POLICY "Anyone can insert messages into active rooms"
  ON public.room_messages
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.virtual_rooms vr
      WHERE vr.id = room_messages.room_id AND vr.is_active = true
    )
  );