
-- Add new columns to whatsapp_connections for Evolution API integration
ALTER TABLE public.whatsapp_connections
  ADD COLUMN IF NOT EXISTS instance_name text,
  ADD COLUMN IF NOT EXISTS evolution_api_url text,
  ADD COLUMN IF NOT EXISTS evolution_api_key_encrypted text;

-- Create whatsapp_conversations table for message history
CREATE TABLE public.whatsapp_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  whatsapp_connection_id uuid NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  remote_jid text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for fast lookups by connection + remote_jid
CREATE INDEX idx_whatsapp_conversations_lookup 
  ON public.whatsapp_conversations(whatsapp_connection_id, remote_jid, created_at DESC);

-- Enable RLS
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

-- RLS: service role can do everything (webhook function uses service role)
CREATE POLICY "Service role full access on whatsapp_conversations"
  ON public.whatsapp_conversations
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS: owners can view conversations of their connections
CREATE POLICY "Users can view own whatsapp conversations"
  ON public.whatsapp_conversations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_connections wc
      WHERE wc.id = whatsapp_conversations.whatsapp_connection_id
        AND wc.user_id = auth.uid()
    )
  );
