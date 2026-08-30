-- agent_knowledge_bases.agent_id only accepted custom_agents(id), so linking a
-- knowledge base to a NATIVE agent (via the admin "Documentos" tab) failed with a
-- foreign key violation. Native agent ids live in public.agents, a different table.
-- Drop the FK so agent_id can reference either table, matching the pattern already
-- used by agent_prompt_versions/agent_optimization_settings (agent_id uuid with no FK,
-- disambiguated at the application/RLS layer instead of the database layer).
ALTER TABLE public.agent_knowledge_bases
  DROP CONSTRAINT agent_knowledge_bases_agent_id_fkey;
