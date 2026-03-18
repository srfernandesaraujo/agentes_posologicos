

# Plano: Execução Paralela de Fluxos de Agentes

## Conceito

Atualmente o fluxo executa etapas uma a uma (sequencial). A proposta é adicionar suporte a **execução paralela**: agentes sem dependência entre si rodam simultaneamente, e um **agente sintetizador** no final consolida todos os resultados em uma entrega única.

```text
Exemplo — Fluxo Paralelo:

         ┌─── Agente A (pesquisa) ───┐
Input ───┤                            ├──→ Sintetizador → Output Final
         └─── Agente B (análise)  ───┘

Exemplo — Misto (paralelo + sequencial):

                ┌─── Agente A ───┐
Input → Prep ───┤                ├──→ Sintetizador → Revisão → Output
                └─── Agente B ───┘
```

## O que muda

### 1. Banco de Dados
- Adicionar coluna `execution_mode` (`sequential` | `parallel`) na tabela `agent_flows` (default: `sequential`)
- Adicionar coluna `is_synthesizer` (boolean, default false) na tabela `agent_flow_nodes` para marcar o nó final que consolida os resultados paralelos

### 2. Edge Function `agent-flow-execute`
- No mode `init`: agrupar nós por **nível de profundidade** (BFS layers) usando as edges — nós sem dependências ficam no mesmo nível e rodam em paralelo
- Retornar `levels` (array de arrays de steps) em vez de um array linear
- Novo mode `parallel-step`: recebe uma lista de steps do mesmo nível, executa todos com `Promise.all`, e retorna todos os resultados
- No nó sintetizador: concatenar todos os outputs paralelos como contexto de entrada

### 3. Frontend `FlowEditor.tsx`
- Adicionar toggle "Sequencial / Paralelo" no editor do fluxo
- Na execução paralela, mostrar os agentes do mesmo nível lado a lado com indicador de progresso simultâneo
- O sintetizador aparece como etapa final, recebendo todos os outputs
- Adaptar a UI de resultados para exibir outputs paralelos em colunas/tabs antes do resultado final

### 4. Instrução de Fluxo para Agentes Paralelos
- Agentes paralelos recebem apenas o input inicial (não há "etapa anterior")
- O sintetizador recebe uma instrução especial: `<RESULTADOS_PARALELOS>` com todos os outputs numerados, e a instrução de consolidar/integrar

## Detalhes Técnicos

**Agrupamento por níveis (BFS)**:
```text
Nível 0: nós sem dependências de entrada (in-degree = 0)
Nível 1: nós cujas dependências estão todas no nível 0
Nível N: nós cujas dependências estão em níveis < N
```

Nós no mesmo nível executam em paralelo via `Promise.all`. Nós em níveis diferentes executam sequencialmente (o nível 1 espera o nível 0 terminar).

**Payload do sintetizador**:
```text
<RESULTADOS_PARALELOS>
[Agente A]: {output_a}
---
[Agente B]: {output_b}
</RESULTADOS_PARALELOS>

Sua tarefa: integrar e consolidar os resultados acima em uma entrega coesa.
```

**Compatibilidade**: fluxos existentes continuam funcionando sem alteração (default `sequential`).

## Arquivos Modificados
- `supabase/migrations/` — nova migration para `execution_mode` e `is_synthesizer`
- `supabase/functions/agent-flow-execute/index.ts` — lógica de níveis e execução paralela
- `src/pages/FlowEditor.tsx` — UI do toggle, execução paralela, exibição de resultados
- `src/hooks/useAgentFlows.ts` — tipos atualizados
- `src/integrations/supabase/types.ts` — será atualizado automaticamente

