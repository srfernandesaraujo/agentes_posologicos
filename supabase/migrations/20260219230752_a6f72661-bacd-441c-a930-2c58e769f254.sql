
-- WhatsApp connections for custom agents
CREATE TABLE public.whatsapp_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agent_id UUID NOT NULL REFERENCES public.custom_agents(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL DEFAULT 'official', -- 'official', 'evolution', 'zapi'
  token TEXT,
  phone_number_id TEXT,
  webhook_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'active', 'inactive'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own whatsapp connections"
  ON public.whatsapp_connections FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own whatsapp connections"
  ON public.whatsapp_connections FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own whatsapp connections"
  ON public.whatsapp_connections FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own whatsapp connections"
  ON public.whatsapp_connections FOR DELETE USING (auth.uid() = user_id);

-- Virtual rooms for patient simulation
CREATE TABLE public.virtual_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  pin TEXT NOT NULL,
  agent_id UUID REFERENCES public.custom_agents(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.virtual_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own virtual rooms"
  ON public.virtual_rooms FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own virtual rooms"
  ON public.virtual_rooms FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own virtual rooms"
  ON public.virtual_rooms FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own virtual rooms"
  ON public.virtual_rooms FOR DELETE USING (auth.uid() = user_id);

-- Allow anyone to find a room by PIN (for students accessing)
CREATE POLICY "Anyone can find active rooms by pin"
  ON public.virtual_rooms FOR SELECT USING (is_active = true);

-- Add publish flags to custom_agents
ALTER TABLE public.custom_agents
  ADD COLUMN IF NOT EXISTS publish_whatsapp BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS publish_virtual_patient BOOLEAN NOT NULL DEFAULT false;

-- Unique constraint on pin
CREATE UNIQUE INDEX idx_virtual_rooms_pin ON public.virtual_rooms(pin);

-- Triggers for updated_at
CREATE TRIGGER update_whatsapp_connections_updated_at
  BEFORE UPDATE ON public.whatsapp_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_virtual_rooms_updated_at
  BEFORE UPDATE ON public.virtual_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
