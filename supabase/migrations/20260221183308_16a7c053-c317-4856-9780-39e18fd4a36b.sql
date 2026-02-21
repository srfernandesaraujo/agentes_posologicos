
-- Table to store collaborative room messages visible to all participants
CREATE TABLE public.room_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.virtual_rooms(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL DEFAULT 'Anônimo',
  role TEXT NOT NULL DEFAULT 'user',
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can read messages from active rooms (participants don't need auth)
CREATE POLICY "Anyone can read room messages from active rooms"
ON public.room_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.virtual_rooms vr
    WHERE vr.id = room_messages.room_id AND vr.is_active = true
  )
);

-- Anyone can insert messages into active rooms (anonymous participants)
CREATE POLICY "Anyone can insert room messages into active rooms"
ON public.room_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.virtual_rooms vr
    WHERE vr.id = room_messages.room_id AND vr.is_active = true
  )
);

-- Index for fast lookup by room
CREATE INDEX idx_room_messages_room_id ON public.room_messages (room_id, created_at);

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
