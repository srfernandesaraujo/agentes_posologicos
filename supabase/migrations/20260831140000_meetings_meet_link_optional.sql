
-- Registration is now driven by picking the Gemini notes doc via Google Picker
-- (drive_file_id), not by pasting a Meet link — meet_link becomes optional metadata.
ALTER TABLE public.meetings ALTER COLUMN meet_link DROP NOT NULL;
