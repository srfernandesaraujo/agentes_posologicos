
-- Create table for response feedback/ratings
CREATE TABLE public.response_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.virtual_rooms(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.response_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
ON public.response_feedback
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
ON public.response_feedback
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own feedback
CREATE POLICY "Users can update own feedback"
ON public.response_feedback
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete own feedback
CREATE POLICY "Users can delete own feedback"
ON public.response_feedback
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can view all feedback
CREATE POLICY "Admins can view all feedback"
ON public.response_feedback
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for queries
CREATE INDEX idx_response_feedback_agent ON public.response_feedback(agent_id);
CREATE INDEX idx_response_feedback_user ON public.response_feedback(user_id);
CREATE INDEX idx_response_feedback_message ON public.response_feedback(message_id);
