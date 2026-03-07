-- Allow users to delete their own chat sessions
CREATE POLICY "Users can delete own sessions"
ON public.chat_sessions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to delete messages from their own sessions
CREATE POLICY "Users can delete own messages"
ON public.messages
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM chat_sessions cs
  WHERE cs.id = messages.session_id AND cs.user_id = auth.uid()
));