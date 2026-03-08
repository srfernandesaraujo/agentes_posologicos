

## Plano: Implementar 6 Agentes Clínicos

### Agentes a criar

| # | Slug | Nome | Categoria | Ícone | Custo |
|---|------|------|-----------|-------|-------|
| 1 | `calculadora-clinica` | Calculadora Clínica Inteligente | Prática Clínica e Farmácia | `Calculator` | 1 |
| 2 | `diluicao-iv` | Consultor de Diluição e Estabilidade IV | Prática Clínica e Farmácia | `Pill` | 1 |
| 3 | `farmacovigilancia` | Assistente de Farmacovigilância e Notificação | Prática Clínica e Farmácia | `ShieldAlert` | 1 |
| 4 | `ajuste-renal-hepatico` | Orientador de Ajuste Renal e Hepático | Prática Clínica e Farmácia | `HeartPulse` | 1 |
| 5 | `conciliador-medicamentoso` | Conciliador Medicamentoso Inteligente | Prática Clínica e Farmácia | `GitCompare` | 1 |
| 6 | `antimicrobianos-especiais` | Consultor de Antimicrobianos para Populações Especiais | Prática Clínica e Farmácia | `ShieldCheck` | 1 |

Todos os ícones já existem no `iconMap` de `src/lib/icons.ts`.

---

### Implementação técnica

#### 1. Edge Function (`supabase/functions/agent-chat/index.ts`)
Adicionar 6 novos prompts ao `AGENT_PROMPTS` antes do `};` (linha 2257), cada um com o padrão `<OBJETIVO>`, `<LIMITACOES>`, `<ESTILO>`, `<INSTRUCOES>`:

- **calculadora-clinica**: 2 fases — oferece 15+ calculadoras (Cockroft-Gault, CKD-EPI, MELD, Child-Pugh, Wells, CHA₂DS₂-VASc, BSA, IMC, doses pediátricas, etc.) → calcula com fórmula explícita + interpretação clínica + implicações farmacológicas
- **diluicao-iv**: 2 fases — identifica medicamento → gera ficha completa (reconstituição, diluição, administração, estabilidade, compatibilidade Y-site, alertas vesicante/irritante)
- **farmacovigilancia**: 3 fases — coleta dados da suspeita de RAM → aplica algoritmo de Naranjo (10 perguntas) + classificação OMS + código MedDRA → gera rascunho de notificação padrão ANVISA/VigiMed
- **ajuste-renal-hepatico**: 2 fases — coleta medicamento + função renal/hepática → tabelas de ajuste por faixa TFG e Child-Pugh, metabólitos ativos, alternativas, monitoramento
- **conciliador-medicamentoso**: 3 fases — recebe lista domiciliar + prescrição hospitalar → quadro comparativo com semáforo de risco (🔴🟡🟢) → resumo com alertas de medicamentos de alta vigilância
- **antimicrobianos-especiais**: 2 fases — identifica população (gestante/lactante/neonato/idoso/imunossuprimido) + infecção → recomendações com tabela de segurança, contraindicados, e considerações especiais por população (teratogenicidade, LactMed, kernicterus, C. difficile)

#### 2. Migration SQL
INSERT de 6 registros na tabela `agents`.

#### 3. Deploy
Redeploy da Edge Function `agent-chat`.

---

### Arquivos a criar/editar

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/agent-chat/index.ts` — 6 novos prompts |
| Criar | Migration SQL — INSERT de 6 agentes |

