-- 20260730120000_add_agent_voice_id was recorded as applied in schema_migrations
-- (migration repair) but never actually ran: neither column existed in production,
-- so saving the model tab in AgentEditor/NativeAgentEditor failed with HTTP 400.
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS voice_id text;
ALTER TABLE public.custom_agents ADD COLUMN IF NOT EXISTS voice_id text;
NOTIFY pgrst, 'reload schema';
