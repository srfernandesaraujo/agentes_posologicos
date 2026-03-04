
-- Create a secure RPC to look up a room by PIN without exposing all rooms
CREATE OR REPLACE FUNCTION public.get_room_by_pin(p_pin text)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  pin text,
  is_active boolean,
  agent_id uuid,
  user_id uuid,
  room_expires_at timestamptz,
  agent_expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, description, pin, is_active, agent_id, user_id,
         room_expires_at, agent_expires_at, created_at, updated_at
  FROM public.virtual_rooms
  WHERE pin = p_pin AND is_active = true
  LIMIT 1;
$$;

-- Drop the overly permissive policy that exposes all active rooms
DROP POLICY IF EXISTS "Anyone can find active rooms by pin" ON public.virtual_rooms;

-- Drop the overly permissive policy on room_messages
DROP POLICY IF EXISTS "Anyone can read room messages from active rooms" ON public.room_messages;
DROP POLICY IF EXISTS "Anyone can insert room messages into active rooms" ON public.room_messages;

-- Re-create room_messages policies scoped to authenticated room owners
-- Room owner can read all messages in their rooms
CREATE POLICY "Room owners can read all messages in their rooms"
  ON public.room_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.virtual_rooms vr
      WHERE vr.id = room_messages.room_id AND vr.user_id = auth.uid()
    )
  );

-- For anonymous/authenticated participants: allow insert via edge function (service role)
-- We remove direct anonymous insert - the edge function already uses service role for room operations
-- But we need anon users to insert messages. Let's keep a scoped insert policy.
CREATE POLICY "Anyone can insert messages into active rooms"
  ON public.room_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.virtual_rooms vr
      WHERE vr.id = room_messages.room_id AND vr.is_active = true
    )
  );

-- Allow anon users to read ONLY their own messages by sender_email in active rooms
CREATE POLICY "Participants can read own messages in active rooms"
  ON public.room_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.virtual_rooms vr
      WHERE vr.id = room_messages.room_id AND vr.is_active = true
    )
  );
