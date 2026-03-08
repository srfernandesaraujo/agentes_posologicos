INSERT INTO public.agents (slug, name, description, category, icon, credit_cost, active) VALUES
('calculadora-clinica', 'Calculadora Clínica Inteligente', 'Realize cálculos farmacêuticos e escores clínicos validados: Cockroft-Gault, CKD-EPI, MELD, Child-Pugh, Wells, CHA₂DS₂-VASc, IMC, BSA, doses pediátricas e mais. Com fórmula explícita, interpretação clínica e implicações farmacológicas.', 'Prática Clínica e Farmácia', 'Calculator', 1, true),
('diluicao-iv', 'Consultor de Diluição e Estabilidade IV', 'Consulte fichas técnicas completas de medicamentos injetáveis: reconstituição, diluição, velocidade de infusão, estabilidade após preparo, compatibilidade em Y-site, alertas de vesicantes/irritantes e condições de armazenamento.', 'Prática Clínica e Farmácia', 'Pill', 1, true),
('ajuste-renal-hepatico', 'Orientador de Ajuste Renal e Hepático', 'Obtenha orientações de ajuste posológico para pacientes com insuficiência renal e/ou hepática. Tabelas de ajuste por faixa de TFG e Child-Pugh, metabólitos ativos, alternativas terapêuticas e monitoramento.', 'Prática Clínica e Farmácia', 'HeartPulse', 1, true),
('conciliador-medicamentoso', 'Conciliador Medicamentoso Inteligente', 'Compare a lista de medicamentos domiciliares com a prescrição hospitalar. Identifique discrepâncias por semáforo de risco, alertas de alta vigilância e medicamentos que não devem ser suspensos abruptamente.', 'Prática Clínica e Farmácia', 'GitCompare', 1, true),
('antimicrobianos-especiais', 'Consultor de Antimicrobianos para Populações Especiais', 'Orientações especializadas de antimicrobianos para gestantes, lactantes, neonatos, idosos e imunossuprimidos. Tabelas de segurança por população, teratogenicidade, LactMed e considerações farmacológicas específicas.', 'Prática Clínica e Farmácia', 'ShieldCheck', 1, true);

UPDATE public.agents SET 
  name = 'Assistente de Farmacovigilância e Notificação',
  description = 'Avalie suspeitas de Reações Adversas a Medicamentos com o Algoritmo de Naranjo completo, classificação de gravidade OMS, código MedDRA e geração automática de rascunho de notificação no padrão ANVISA/VigiMed.',
  icon = 'ShieldAlert'
WHERE slug = 'farmacovigilancia';