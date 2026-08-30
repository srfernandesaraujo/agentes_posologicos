
-- Adapt `meetings` for the Google Drive/Gemini transcript sync (replaces Recall.ai bot flow).
ALTER TABLE public.meetings
  ADD COLUMN drive_file_id TEXT,
  ADD COLUMN matched_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN expected_start_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.meetings.bot_id IS 'DEPRECATED (Recall.ai bot id). Not used by new code — see drive_file_id.';

-- status lifecycle is now: pending -> matched -> transcribing -> summarizing -> done | error
-- ('recording' is no longer used; historical rows may still carry it).
