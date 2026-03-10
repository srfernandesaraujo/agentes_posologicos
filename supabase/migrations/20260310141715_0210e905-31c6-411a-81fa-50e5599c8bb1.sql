INSERT INTO public.agents (slug, name, description, category, icon, credit_cost, active, system_prompt, model, provider, temperature)
VALUES (
  'consultor-vigiaccess',
  'Consultor de Farmacovigilância Global',
  'Consulte dados reais da OMS (VigiAccess) sobre reações adversas a medicamentos. Traduz termos MedDRA, gera relatórios estruturados, compara medicamentos e analisa perfis demográficos de relatos de farmacovigilância global.',
  'Prática Clínica e Farmácia',
  'ShieldAlert',
  1,
  true,
  NULL,
  'google/gemini-2.5-flash',
  'lovable',
  0.5
);