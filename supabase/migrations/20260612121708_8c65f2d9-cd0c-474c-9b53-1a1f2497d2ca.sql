
ALTER TABLE public.room_messages ADD COLUMN IF NOT EXISTS participant_token text;
ALTER TABLE public.room_messages ALTER COLUMN sender_email DROP NOT NULL;
ALTER TABLE public.room_messages ALTER COLUMN sender_email DROP DEFAULT;
CREATE INDEX IF NOT EXISTS idx_room_messages_room_token ON public.room_messages (room_id, participant_token);

DROP POLICY IF EXISTS "Participants can read active room messages" ON public.room_messages;
DROP POLICY IF EXISTS "Anyone can insert messages into active rooms" ON public.room_messages;

CREATE POLICY "Anon can read broadcast messages in active rooms"
ON public.room_messages FOR SELECT TO anon
USING (is_active_virtual_room(room_id) AND is_broadcast = true);

CREATE POLICY "Authenticated participants read own and broadcast"
ON public.room_messages FOR SELECT TO authenticated
USING (
  is_active_virtual_room(room_id) AND (
    is_broadcast = true
    OR sender_email = get_current_user_email()
    OR is_virtual_room_owner(room_id, auth.uid())
  )
);

CREATE POLICY "Anon insert in active rooms without email"
ON public.room_messages FOR INSERT TO anon
WITH CHECK (
  is_active_virtual_room(room_id)
  AND (sender_email IS NULL OR sender_email = '')
);

CREATE POLICY "Authenticated insert in active rooms with own email"
ON public.room_messages FOR INSERT TO authenticated
WITH CHECK (
  is_active_virtual_room(room_id) AND (
    sender_email IS NULL OR sender_email = '' OR sender_email = get_current_user_email()
  )
);

CREATE OR REPLACE FUNCTION public.get_my_room_messages(_room_id uuid, _token text)
RETURNS TABLE (
  id uuid,
  room_id uuid,
  sender_name text,
  role text,
  content text,
  created_at timestamptz,
  is_broadcast boolean,
  is_question boolean,
  is_anonymous boolean,
  participant_token text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rm.id, rm.room_id, rm.sender_name, rm.role, rm.content, rm.created_at,
         rm.is_broadcast, rm.is_question, rm.is_anonymous, rm.participant_token
  FROM public.room_messages rm
  WHERE rm.room_id = _room_id
    AND public.is_active_virtual_room(rm.room_id)
    AND (rm.is_broadcast = true OR rm.participant_token = _token)
  ORDER BY rm.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_room_messages(uuid, text) TO anon, authenticated;
