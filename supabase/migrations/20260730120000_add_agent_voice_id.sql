-- Lets an agent (native or custom) be given its own ElevenLabs voice, so
-- MessageTTS can speak replies in a voice tied to that agent's identity
-- instead of always falling back to the tts-elevenlabs default voice.
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS voice_id text;
ALTER TABLE public.custom_agents ADD COLUMN IF NOT EXISTS voice_id text;
