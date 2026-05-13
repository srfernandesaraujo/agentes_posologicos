
# Fluxo Complexo com IA — novo modo de criação

## Objetivo

Adicionar, em `/fluxos`, um segundo botão ao lado de **"Criar com IA"** chamado **"Criar fluxo complexo com IA"** (ícone `Network`), que abre um wizard onde o usuário descreve **agente por agente** (papel, entrada, saída, ferramentas, regras de roteamento) e a IA monta um pipeline com:

- ingestão de arquivo (planilha, PDF, etc.) como input inicial
- agentes de **enriquecimento** que escrevem novas colunas/derivam dados
- **agente roteador** que classifica cada item (linha da planilha) em uma de N **esteiras**
- esteiras paralelas, cada uma com sua própria sequência de agentes produzindo documentos
- agregação/handoff final para revisão humana ("gestor")

O fluxo "Criar com IA" atual continua existindo, intocado.

## Escopo desta entrega

Apenas o **planejamento e criação** do fluxo complexo (geração de nós + edges + prompts premium + metadados de roteamento). A execução real das esteiras condicionais entra como ajuste mínimo no `agent-flow-execute` para respeitar o `branch_key` dos nós; processamento item-a-item de planilhas e geração de .docx/.pdf finais ficam fora desta entrega (são mencionados como follow-up).

## UX

### 1. Botão e diálogo

Em `src/pages/Flows.tsx`, ao lado de "Criar com IA":

```
[ Sparkles ] Criar com IA      [ Network ] Criar fluxo complexo com IA
```

O novo diálogo é um wizard em 4 passos:

1. **Visão geral** — nome do fluxo, objetivo final, tipo de input (texto, planilha, PDF, imagem).
2. **Agentes** — lista dinâmica (add/remove/reorder) onde para cada agente o usuário preenche:
   - Nome curto
   - O que faz (descrição livre)
   - O que recebe (de qual agente anterior, ou "input do usuário")
   - O que produz
   - É roteador? (toggle) — se sim, o usuário lista os **rótulos das esteiras** (ex.: "Registro de Preço", "Inexigibilidade", "Pregão")
   - Pertence a qual esteira? (select com os rótulos definidos pelos roteadores anteriores, ou "principal")
3. **Revisão** — preview compacto: lista de agentes, esteiras detectadas, diagrama ASCII simples.
4. **Gerando…** — chama a edge function, mostra progresso, navega para `/fluxos/:id` ao concluir.

Se faltar info crítica, a edge function retorna `needs_preflight` (mesma mecânica do fluxo simples) e o wizard insere o passo de perguntas.

## Backend

### Nova edge function: `agent-flow-plan-complex`

Recebe:

```json
{
  "user_id": "...",
  "flow_name": "...",
  "flow_objective": "...",
  "input_type": "spreadsheet|pdf|text|image",
  "agents": [
    {
      "name": "Analista de Estoque",
      "role": "Lê planilha de estoque e adiciona coluna GAP de aquisição",
      "receives_from": "user_input",
      "produces": "planilha enriquecida com coluna GAP",
      "is_router": false,
      "branch": "main"
    },
    {
      "name": "Roteador de Compras",
      "role": "Classifica cada medicamento em RP, Inexigibilidade ou Pregão",
      "receives_from": "Analista de Estoque",
      "produces": "rota de cada item",
      "is_router": true,
      "branches": ["rp", "inexigibilidade", "pregao"],
      "branch": "main"
    },
    { "name": "Redator RP", "branch": "rp", ... },
    { "name": "Redator Inexigibilidade", "branch": "inexigibilidade", ... },
    { "name": "Redator Pregão", "branch": "pregao", ... },
    { "name": "Consolidador para Gestor", "branch": "main", "receives_from": "all_branches", ... }
  ]
}
```

A função:

1. Carrega catálogo de agentes nativos + custom do usuário (igual `agent-flow-plan`).
2. Manda tudo para `google/gemini-2.5-pro` via tool calling com schema `create_complex_flow_plan` que devolve, para cada agente, `agent_type` (`native|custom|new`), `agent_id` ou `new_agent_*` (com `system_prompt` premium nas seções OBJETIVO/INSTRUCOES/FORMATO_SAIDA/REGRAS/LIMITACOES — reutiliza o template do plan atual), `branch_key`, `is_router`, `router_branches[]`, `is_synthesizer`.
3. Cria o `agent_flows` com `execution_mode = "complex"` (novo valor permitido).
4. Cria os `agent_flow_nodes` salvando os campos novos `branch_key`, `is_router`, `router_branches` (jsonb).
5. Cria os `agent_flow_edges` ligando:
   - cada agente "main" em sequência até o roteador
   - roteador → primeiro agente de cada esteira (edge com `branch_key` = rótulo)
   - sequência interna de cada esteira
   - último de cada esteira → consolidador final

### Migração necessária

```sql
ALTER TABLE public.agent_flows
  -- garantir que execution_mode aceita 'complex' (é text livre, sem CHECK; ok)
  ADD COLUMN IF NOT EXISTS input_type text;

ALTER TABLE public.agent_flow_nodes
  ADD COLUMN IF NOT EXISTS branch_key text DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS is_router boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS router_branches jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.agent_flow_edges
  ADD COLUMN IF NOT EXISTS branch_key text;
```

RLS já existente nas tabelas (escopo por `user_id` via `flow_id`) cobre os campos novos — não precisa de novas policies.

### Ajuste mínimo em `agent-flow-execute`

Quando `flow.execution_mode === "complex"`:

- BFS continua, mas ao processar um nó com `is_router=true`, parsear a saída JSON do roteador (a IA é instruída no prompt a devolver `{ "branch": "<rótulo>" }` ou lista por item) e seguir apenas pelas edges cujo `branch_key` casa.
- Sintetizador final (`is_synthesizer=true`) recebe o output de todas as esteiras concluídas (mesmo padrão do modo `parallel`).

Processamento por linha de planilha (split-map-reduce real) **não** entra agora; o roteador por enquanto recebe o output agregado e escolhe um caminho. Documentar como follow-up.

## Detalhes técnicos

- **Arquivos novos**:
  - `supabase/functions/agent-flow-plan-complex/index.ts`
  - `src/components/flows/ComplexFlowWizard.tsx` (wizard com os 4 passos, usa `Dialog`, `Tabs`/stepper, `Sortable` simples por botões ↑↓)
- **Arquivos editados**:
  - `src/pages/Flows.tsx` — novo botão + estado do wizard
  - `src/hooks/useAgentFlows.ts` — sem mudanças (CRUD já genérico)
  - `supabase/functions/agent-flow-execute/index.ts` — branch routing
  - `src/integrations/supabase/types.ts` — regenerado pela migração
- **Diagrama no FlowEditor**: o editor visual já consome `agent_flow_nodes/edges`; nós com `is_router=true` ganham um badge "Roteador" e edges com `branch_key` mostram o rótulo. Isso é tweak visual pequeno em `FlowEditor.tsx` (badge + label na aresta).
- **Validações**:
  - pelo menos 2 agentes
  - se houver agente em `branch != main`, deve existir um roteador anterior que declare aquela `branch`
  - todo `branch != main` deve eventualmente convergir num agente `main` posterior (consolidador)
- **Limites**: máx. 12 agentes, máx. 5 esteiras (evita estourar contexto do planejador e custo).

## Diagrama do exemplo do usuário

```text
[Planilha estoque] -> [Analista GAP] -> [Roteador RP/Inex/Pregão]
                                          |-- rp -----> [Redator RP] -----+
                                          |-- inex --> [Redator Inex] ----+--> [Consolidador Gestor]
                                          \-- pregao -> [Redator Pregão] -+
```

## Fora de escopo (follow-up)

- Iterar planilha linha-a-linha (split por item) com fan-out real
- Geração de .docx/.pdf nos nós finais
- Aprovação humana embutida ("Humano-in-the-loop") com fila de revisão

