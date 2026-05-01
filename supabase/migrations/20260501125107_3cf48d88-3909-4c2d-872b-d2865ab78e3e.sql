
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-attachments', 'chat-attachments', false, 104857600)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 104857600;

CREATE POLICY "Users can upload own chat attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read own chat attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own chat attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
