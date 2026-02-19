
-- Hierarquia de créditos por complexidade:
-- 3 créditos: Agentes com análise cruzada de dados, cálculos e raciocínio multi-etapa
-- 2 créditos: Agentes com geração estruturada e moderada complexidade
-- 1 crédito: Agentes com geração de texto mais direta

UPDATE public.agents SET credit_cost = 3 WHERE slug = 'analisador-interacoes-risco-cardiovascular';
UPDATE public.agents SET credit_cost = 3 WHERE slug = 'consultor-antibioticoterapia';
UPDATE public.agents SET credit_cost = 3 WHERE slug = 'simulador-casos-clinicos';
UPDATE public.agents SET credit_cost = 3 WHERE slug = 'analisador-adaptativo-dados-turma';
UPDATE public.agents SET credit_cost = 3 WHERE slug = 'consultor-analise-estatistica';

UPDATE public.agents SET credit_cost = 2 WHERE slug = 'educador-tradutor-clinico';
UPDATE public.agents SET credit_cost = 2 WHERE slug = 'arquiteto-metodologias-ativas';
UPDATE public.agents SET credit_cost = 2 WHERE slug = 'assistente-editais-fomento';
UPDATE public.agents SET credit_cost = 2 WHERE slug = 'estrategista-conteudo-seo';

UPDATE public.agents SET credit_cost = 1 WHERE slug = 'desmistificador-fact-checker';
