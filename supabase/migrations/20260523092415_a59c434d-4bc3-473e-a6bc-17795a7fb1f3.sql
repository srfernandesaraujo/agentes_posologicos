
-- 1) Restrict native agents SELECT to authenticated users (system_prompt was exposed to anon)
DROP POLICY IF EXISTS "Agents are publicly readable" ON public.agents;
CREATE POLICY "Authenticated users can read agents"
  ON public.agents
  FOR SELECT
  TO authenticated
  USING (true);

-- 2) Restrict pubmed_notifications_log INSERT to authenticated (was open to anon)
DROP POLICY IF EXISTS "Service can insert pubmed log" ON public.pubmed_notifications_log;
CREATE POLICY "Authenticated can insert own pubmed log"
  ON public.pubmed_notifications_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3) Remove user-facing INSERT policy on purchased_agents; only service_role (Edge Functions) should insert
DROP POLICY IF EXISTS "Users can insert own purchases" ON public.purchased_agents;
