CREATE OR REPLACE FUNCTION public.is_active_virtual_room(_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.virtual_rooms vr
    WHERE vr.id = _room_id
      AND vr.is_active = true
      AND (vr.room_expires_at IS NULL OR vr.room_expires_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_virtual_room_owner(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.virtual_rooms vr
    WHERE vr.id = _room_id
      AND vr.user_id = _user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_active_virtual_room(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_virtual_room_owner(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Anyone can insert messages into active rooms" ON public.room_messages;
DROP POLICY IF EXISTS "Participants can read own messages in active rooms" ON public.room_messages;
DROP POLICY IF EXISTS "Room owners can read all messages in their rooms" ON public.room_messages;

CREATE POLICY "Anyone can insert messages into active rooms"
ON public.room_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (public.is_active_virtual_room(room_id));

CREATE POLICY "Participants can read active room messages"
ON public.room_messages
FOR SELECT
TO anon, authenticated
USING (public.is_active_virtual_room(room_id));

CREATE POLICY "Room owners can read all messages in their rooms"
ON public.room_messages
FOR SELECT
TO authenticated
USING (public.is_virtual_room_owner(room_id, auth.uid()));