
UPDATE public.agents SET credit_cost = 3 WHERE slug IN ('interacoes-cardiovascular', 'antibioticoterapia', 'simulador-clinico', 'analisador-turma', 'analise-estatistica');
UPDATE public.agents SET credit_cost = 2 WHERE slug IN ('educador-cronicas', 'metodologias-ativas', 'editais-fomento', 'seo-youtube');
UPDATE public.agents SET credit_cost = 1 WHERE slug = 'fact-checker';
