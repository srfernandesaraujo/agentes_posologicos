

## Plano: Agente Especialista em Adaptação de Aulas para Inclusão

### O que será construído

Um novo agente nativo na categoria "EdTech e Professores 4.0" que guia o professor por 3 fases: receber o material da aula, identificar o público-alvo (neurodivergentes ou com deficiência) e gerar um plano de aula completamente adaptado com estratégias, plataformas e mídias específicas.

---

### Fluxo de interação (3 fases)

1. **Fase 1 — Recebimento do Material**: O agente pede ao professor o conteúdo/plano de aula original (texto, arquivo ou descrição)
2. **Fase 2 — Identificação do Público**: Oferece lista numerada de perfis de alunos para adaptação:
   - TDAH
   - TEA (Transtorno do Espectro Autista)
   - Dislexia
   - Deficiência Auditiva (surdez parcial/total)
   - Deficiência Visual (baixa visão/cegueira)
   - Mudez / Deficiência de Fala
   - Altas Habilidades / Superdotação
   - Deficiência Intelectual
   - Múltiplas (combinação)
3. **Fase 3 — Plano Adaptado**: Gera plano completo com seções para estratégias pedagógicas, tecnologias assistivas, plataformas recomendadas, tipos de mídia, cronograma adaptado e avaliação inclusiva

---

### Implementação técnica

#### 1. Prompt na Edge Function (`supabase/functions/agent-chat/index.ts`)
- Novo slug: `adaptacao-inclusiva`
- Prompt estruturado seguindo o padrão existente (`<OBJETIVO>`, `<LIMITACOES>`, `<ESTILO>`, `<INSTRUCOES>`)
- Fases sequenciais obrigatórias com formatação em tabelas Markdown

#### 2. Migration para inserir o agente na tabela `agents`
- Nome: "Especialista em Adaptação Inclusiva de Aulas"
- Categoria: "EdTech e Professores 4.0"
- Ícone: `UserRound` (já disponível no iconMap)
- Custo: 1 crédito

#### 3. Ícone
- `UserRound` já está registrado em `src/lib/icons.ts`, não precisa editar

---

### Arquivos a criar/editar

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/agent-chat/index.ts` — adicionar prompt do agente |
| Criar | Migration SQL para inserir agente na tabela |

