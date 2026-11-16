-- Buyers of marketplace agents cannot SELECT custom_agents (RLS: owner/admin only), so the chat
-- screen showed "Agente nao encontrado" right after a purchase. This returns only the public,
-- non-sensitive fields (never system_prompt) for the owner, a buyer, or a published agent.
CREATE OR REPLACE FUNCTION public.get_custom_agent_for_chat(p_agent_id uuid)
RETURNS TABLE(id uuid, user_id uuid, name text, description text, voice_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.id, a.user_id, a.name, a.description, a.voice_id
  FROM public.custom_agents a
  WHERE a.id = p_agent_id
    AND auth.uid() IS NOT NULL
    AND (
      a.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.purchased_agents p WHERE p.agent_id = a.id AND p.buyer_id = auth.uid())
      OR (a.published_to_marketplace = true AND a.status = 'published')
    );
$$;
REVOKE ALL ON FUNCTION public.get_custom_agent_for_chat(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_custom_agent_for_chat(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
