

## Plano: Renderização Visual para Módulos de Validação da Prescrição e Farmácia Hospitalar

### Problema
Os módulos de Validação da Prescrição (Auditor de Prescrição) e Farmácia Hospitalar (Conciliador Medicamentoso e outros) exibem seus resultados como markdown puro, sem a riqueza visual que o Simulador de Farmácia Comunitária possui. O objetivo é criar componentes visuais ricos que renderizem os dados estruturados desses agentes como cards interativos, mantendo a identidade visual da plataforma.

### Proposta Visual

**Módulo 1 — Validação da Prescrição (Auditor de Prescrição)**

```text
┌─────────────────────────────────────────────┐
│ 📋 RELATÓRIO DE AUDITORIA DE PRESCRIÇÃO     │
│─────────────────────────────────────────────│
│ ┌──────────────────────────────────────────┐│
│ │ 👤 Card do Paciente                      ││
│ │ Avatar · Nome · Idade · Peso             ││
│ │ Alergias: badge vermelho                 ││
│ │ Função Renal: badge · Comorbidades: tags ││
│ └──────────────────────────────────────────┘│
│                                             │
│ ┌──────────────────────────────────────────┐│
│ │ 💊 Prescrição Analisada                  ││
│ │ Tabela estilizada com cada medicamento   ││
│ │ Dose | Via | Frequência                  ││
│ └──────────────────────────────────────────┘│
│                                             │
│ ┌──────────────────────────────────────────┐│
│ │ ⚠️ Alertas de Segurança                  ││
│ │ 🔴 Card vermelho: Alerta crítico        ││
│ │ 🟡 Card amarelo: Monitoramento          ││
│ │ 🟢 Card verde: Informativo              ││
│ └──────────────────────────────────────────┘│
│                                             │
│ 📊 Score de Segurança: ████████░░ 78%       │
│ 📝 Plano de Intervenção (lista numerada)    │
└─────────────────────────────────────────────┘
```

**Módulo 2 — Farmácia Hospitalar (Conciliador Medicamentoso)**

```text
┌─────────────────────────────────────────────┐
│ 🔄 CONCILIAÇÃO MEDICAMENTOSA               │
│─────────────────────────────────────────────│
│ ┌──────────────────────────────────────────┐│
│ │ 👤 Card do Paciente                      ││
│ │ Avatar · Nome · Idade · Motivo Internação││
│ │ Alergias · Função Renal/Hepática         ││
│ └──────────────────────────────────────────┘│
│                                             │
│ ┌─────────────┐  ↔  ┌─────────────────────┐│
│ │ 🏠 Uso      │     │ 🏥 Prescrição       ││
│ │ Domiciliar  │     │ Hospitalar           ││
│ │ - Med A 10mg│     │ - Med A 20mg ⚠️     ││
│ │ - Med B 5mg │     │ - Med C 100mg ➕    ││
│ │ - Med D 25mg│     │ (Med D omitido) ❌  ││
│ └─────────────┘     └─────────────────────┘│
│                                             │
│ ┌──────────────────────────────────────────┐│
│ │ 📊 Resumo Visual                         ││
│ │ 🟢 Conciliados: 5  │ 🟡 Atenção: 2     ││
│ │ 🔴 Alto Risco: 1   │ Total: 8           ││
│ └──────────────────────────────────────────┘│
│                                             │
│ ⚠️ Alertas de Alta Vigilância              │
│ 💡 Recomendações ao Prescritor             │
└─────────────────────────────────────────────┘
```

### Implementação Técnica

**1. Componentes visuais** (`src/components/chat/`)
- `PrescriptionAuditCard.tsx` — Detecta e renderiza o "RELATÓRIO DE AUDITORIA DE PRESCRIÇÃO" com:
  - Card do paciente com avatar gerado (iniciais), dados demográficos e badges de alergias
  - Tabela de medicamentos estilizada com ícones por via de administração
  - Cards coloridos de alertas (vermelho/amarelo/verde) com bordas e backgrounds distintos
  - Barra de score de segurança visual
  - Seção de intervenção com checklist visual

- `MedicationReconciliationCard.tsx` — Detecta e renderiza a "CONCILIAÇÃO MEDICAMENTOSA" com:
  - Card do paciente com avatar e dados de internação
  - Layout lado a lado (desktop) / empilhado (mobile) comparando listas domiciliar vs hospitalar
  - Badges visuais de discrepância (❌ Omissão, ➕ Adição, 📊 Dose diferente, 🔄 Substituição)
  - Dashboard de resumo com contadores coloridos
  - Cards de alta vigilância com destaque vermelho

**2. Parser de detecção** (`src/lib/chatParsers.ts`)
- Funções que detectam padrões no markdown: `isPrescriptionAudit(content)`, `isMedicationReconciliation(content)`
- Parsers que extraem dados estruturados do texto: paciente, medicamentos, alertas, resumo

**3. Integração no Chat** (`src/pages/Chat.tsx`)
- Atualizar `ChatMessageContent` para verificar se o conteúdo corresponde a um dos formatos visuais antes de renderizar como markdown puro
- Manter fallback para markdown caso o parser não consiga extrair os dados

**4. Ajuste nos prompts dos agentes** (`supabase/functions/agent-chat/index.ts`)
- Adicionar marcadores estruturais nos prompts do `auditor-prescricao` e `conciliador-medicamentoso` para facilitar o parsing (ex: `[PACIENTE]Nome|Idade|Peso[/PACIENTE]`)
- Garantir que os dados do paciente sempre sejam emitidos em formato parseável

### Elementos Visuais Compartilhados
- Avatar do paciente gerado por iniciais (círculo colorido com letras)
- Badges de risco com cores do semáforo (vermelho/amarelo/verde) usando os tokens CSS existentes
- Cards com `glass-card` e bordas temáticas
- Gradients consistentes com o design system (teal/blue)
- Responsivo: cards empilham em mobile

### Arquivos Modificados/Criados
1. **Criar** `src/components/chat/PrescriptionAuditCard.tsx`
2. **Criar** `src/components/chat/MedicationReconciliationCard.tsx`
3. **Criar** `src/lib/chatParsers.ts`
4. **Editar** `src/pages/Chat.tsx` — integrar os novos renderers no `ChatMessageContent`
5. **Editar** `supabase/functions/agent-chat/index.ts` — adicionar marcadores estruturais nos prompts

