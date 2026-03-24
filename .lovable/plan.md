

# Plano: Fluxos de IA Premium — Qualidade, Autonomia e Auto-detecção de Modo

## Problemas Identificados

1. **Prompts fracos**: O `agent-flow-plan` gera `input_prompt` genéricos e superficiais, sem instruções detalhadas para cada agente
2. **Agentes fazem perguntas no meio do fluxo**: Interrompem a execução pedindo esclarecimentos que poderiam ser coletados no início
3. **Modo sequencial/paralelo é manual**: O usuário precisa escolher, mas a IA deveria decidir automaticamente com base na descrição
4. **Agentes sem acesso a ferramentas externas**: Quando o fluxo precisa de pesquisa (PubMed, web), os prompts gerados não incluem instruções para usar as capacidades disponíveis

## Solução

### 1. Reescrever o prompt do `agent-flow-plan` (Edge Function)

O system prompt atual é simples demais. Será substituído por um prompt avançado que:

- **Gera prompts completos** para cada agente (500-1000 palavras cada), com `<OBJETIVO>`, `<INSTRUCOES>`, `<FORMATO_SAIDA>`, `<LIMITACOES>`
- **Injeta instruções de ferramentas**: Quando um agente precisa pesquisar, o prompt gerado incluirá instruções explícitas (ex: "Busque no PubMed usando...", "Consulte fontes acadêmicas...")
- **Força autonomia total**: Cada prompt terá a instrução "NÃO faça perguntas ao usuário. Use as informações fornecidas pelo pipeline e sua expertise para tomar decisões. Se faltar informação, assuma a alternativa mais razoável e justifique sua escolha."
- **Coleta de perguntas upfront**: Se algum agente realmente precisar de informações do usuário, o planner deve compilar TODAS as perguntas de todos os agentes e retorná-las em um campo `preflight_questions` no JSON
- **Auto-detecção de modo**: O planner analisará o pipeline e determinará `execution_mode` automaticamente (`sequential` ou `parallel`) baseado na dependência entre as etapas. Retorna no JSON junto com o plano

Nova estrutura do tool call:
```json
{
  "flow_name": "...",
  "flow_description": "...",
  "execution_mode": "sequential | parallel",
  "preflight_questions": ["Qual o público-alvo?", "Qual o tom desejado?"],
  "nodes": [
    {
      "agent_id": "...",
      "agent_type": "native | custom | new",
      "input_prompt": "Instrução curta de contexto para o nó",
      "new_agent_name": "...",
      "new_agent_description": "...",
      "new_agent_prompt": "<PROMPT COMPLETO E DETALHADO>",
      "is_synthesizer": false
    }
  ]
}
```

Usar modelo `google/gemini-2.5-pro` em vez de `gemini-3-flash-preview` para qualidade superior na geração do plano.

### 2. Atualizar o frontend (`Flows.tsx`) — Preflight Questions

Após o planner retornar, se houver `preflight_questions`:
- Exibir um segundo step no dialog mostrando as perguntas antes de criar o fluxo
- O usuário responde todas de uma vez
- As respostas são injetadas como contexto global no `flow.description` e nos `input_prompt` de cada nó

### 3. Atualizar `agent-flow-plan` — Salvar `execution_mode` automaticamente

Quando o planner decidir o modo, salvar diretamente na tabela `agent_flows`:
```sql
INSERT INTO agent_flows (user_id, name, description, execution_mode) VALUES (...)
```

Além disso, para modo paralelo, posicionar os nós no canvas corretamente (lado a lado no mesmo nível) e marcar o último nó como `is_synthesizer = true`.

### 4. Reforçar autonomia no `agent-flow-execute`

Adicionar ao `FLOW_MODE_INSTRUCTION` (já existente) uma regra extra mais forte:
```
REGRA DE AUTONOMIA MÁXIMA: Você NÃO deve fazer perguntas ao usuário durante a execução do fluxo.
Todas as informações necessárias já foram fornecidas no input inicial e no contexto do pipeline.
Se alguma informação estiver faltando, tome a decisão mais razoável e justifique brevemente.
```

### 5. Remover toggle manual de modo

O toggle "Sequencial / Paralelo" na UI do `FlowEditor.tsx` será removido para fluxos gerados por IA (pois o modo é auto-determinado). Para fluxos manuais, manter o toggle.

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/agent-flow-plan/index.ts` | Prompt premium, auto-detecção de modo, preflight questions, modelo superior |
| `supabase/functions/agent-flow-execute/index.ts` | Regra de autonomia reforçada no FLOW_MODE_INSTRUCTION |
| `src/pages/Flows.tsx` | UI de preflight questions, salvamento de respostas como contexto |

