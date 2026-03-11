
-- Drop ALL existing policies on room_messages and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Anyone can insert messages into active rooms" ON public.room_messages;
DROP POLICY IF EXISTS "Participants can read own messages in active rooms" ON public.room_messages;
DROP POLICY IF EXISTS "Room owners can read all messages in their rooms" ON public.room_messages;

-- Recreate as PERMISSIVE (AS PERMISSIVE is the default but being explicit)
CREATE POLICY "Anyone can insert messages into active rooms"
  ON public.room_messages
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.virtual_rooms vr
      WHERE vr.id = room_messages.room_id AND vr.is_active = true
    )
  );

CREATE POLICY "Participants can read own messages in active rooms"
  ON public.room_messages
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.virtual_rooms vr
      WHERE vr.id = room_messages.room_id AND vr.is_active = true
    )
  );

CREATE POLICY "Room owners can read all messages in their rooms"
  ON public.room_messages
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.virtual_rooms vr
      WHERE vr.id = room_messages.room_id AND vr.user_id = auth.uid()
    )
  );
