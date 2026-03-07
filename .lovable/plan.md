

## Plan: Redesign the "Arquiteto de Metodologias Ativas" Agent to Support Multiple Methodologies via Guided Interaction

### Problem
The agent currently assumes PBL + Sala de Aula Invertida for every plan. The user wants it to:
1. Ask diagnostic questions first to understand context
2. Propose suitable active methodologies (not limited to PBL/Flipped)
3. Let the user choose — or bring their own methodology
4. Generate the full lesson plan using whichever methodology was selected

### Changes

**Single file edit: `supabase/functions/agent-chat/index.ts`** — Rewrite the `metodologias-ativas` prompt.

Key prompt changes:

1. **New Phase 0 — Diagnostic Interaction**: Instead of jumping to plan generation, the agent first asks 4-5 targeted questions:
   - Subject/topic, grade level, class duration
   - Learning objectives and student profile
   - Available resources (physical space, tech, materials)
   - Whether the user already has a preferred methodology

2. **Expanded Methodology Repertoire**: The agent will know and propose from a broad catalog:
   - PBL (Problem-Based Learning)
   - Sala de Aula Invertida (Flipped Classroom)
   - TBL (Team-Based Learning)
   - Gamificação Pedagógica
   - Design Thinking Educacional
   - Rotação por Estações
   - Peer Instruction (Instrução por Pares)
   - Estudo de Caso
   - Aprendizagem Baseada em Projetos (ABP)
   - Jigsaw (Quebra-Cabeça Cooperativo)
   - World Café
   - Simulação / Role-Playing

3. **Recommendation Logic**: After gathering answers, the agent proposes 2-3 best-fit methodologies with brief justification, then waits for the user's choice.

4. **User Override**: If the user states a preferred methodology upfront, the agent skips the recommendation step and proceeds directly to plan generation using that methodology.

5. **Plan Structure Preserved**: The existing output format (Roteiro Pedagógico Executável with cronograma minuto a minuto, rubrica, etc.) remains the same — only the methodology driving each phase adapts.

### Deployment
Redeploy the `agent-chat` Edge Function after the prompt update.

