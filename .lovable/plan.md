

## Rede de Agentes (Agent Flow / Pipeline)

### Visão Geral

Criar uma funcionalidade estilo n8n onde o usuário pode montar fluxos visuais conectando agentes em sequência. A saída de um agente alimenta a entrada do próximo. O sistema também aceita uma descrição em linguagem natural e gera automaticamente o fluxo com os agentes adequados, criando agentes personalizados quando necessário.

### Banco de Dados — Novas Tabelas

**`agent_flows`** — armazena cada fluxo criado pelo usuário:
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL)
- `name` (text, NOT NULL)
- `description` (text, default '')
- `status` (text, default 'draft') — draft, ready, running, completed, error
- `created_at`, `updated_at` (timestamptz)

**`agent_flow_nodes`** — cada nó (agente) dentro de um fluxo:
- `id` (uuid, PK)
- `flow_id` (uuid, FK → agent_flows)
- `agent_id` (uuid) — referencia agents OU custom_agents (sem FK rígida, mesmo padrão de chat_sessions)
- `agent_type` (text) — 'native' ou 'custom'
- `position_x`, `position_y` (numeric) — posição no canvas
- `sort_order` (integer) — ordem de execução
- `input_prompt` (text, default '') — instrução extra para este nó sobre como processar a entrada
- `created_at` (timestamptz)

**`agent_flow_edges`** — conexões entre nós:
- `id` (uuid, PK)
- `flow_id` (uuid, FK → agent_flows)
- `source_node_id` (uuid, FK → agent_flow_nodes)
- `target_node_id` (uuid, FK → agent_flow_nodes)

**`agent_flow_executions`** — registro de cada execução de fluxo:
- `id` (uuid, PK)
- `flow_id` (uuid, FK → agent_flows)
- `user_id` (uuid)
- `status` (text) — running, completed, error
- `initial_input` (text)
- `final_output` (text)
- `started_at`, `completed_at` (timestamptz)

**`agent_flow_node_results`** — resultado de cada nó em uma execução:
- `id` (uuid, PK)
- `execution_id` (uuid, FK → agent_flow_executions)
- `node_id` (uuid, FK → agent_flow_nodes)
- `input_text` (text)
- `output_text` (text)
- `status` (text) — pending, running, completed, error
- `started_at`, `completed_at` (timestamptz)

RLS: todas as tabelas filtradas por `auth.uid() = user_id` (ou via join com agent_flows).

### Frontend — Novas Páginas e Componentes

1. **Página `/fluxos`** — lista de fluxos do usuário com botão "Novo Fluxo" e "Criar com IA"
2. **Página `/fluxos/:flowId`** — editor visual do fluxo:
   - Canvas com nós arrastáveis representando agentes (usando posição x/y simples, sem lib pesada)
   - Sidebar para buscar e adicionar agentes (nativos + custom)
   - Conexões visuais entre nós (linhas SVG)
   - Painel de configuração do nó selecionado (instrução extra, ordem)
   - Botão "Play" para executar o fluxo
3. **Modal "Criar com IA"** — campo de texto onde o usuário descreve o que quer. O sistema chama a edge function que analisa os agentes disponíveis, monta o plano, e se necessário cria custom agents automaticamente
4. **Painel de Execução** — mostra progresso em tempo real: cada nó com status (pendente, rodando, concluído), input/output de cada etapa, e resultado final

### Backend — Edge Functions

**`agent-flow-execute`** — nova edge function:
- Recebe `flow_id` e `initial_input`
- Carrega nós e edges, calcula ordem topológica
- Executa sequencialmente: para cada nó, chama a lógica existente do `agent-chat` (reutilizando roteamento de provedores, débito de créditos, etc.)
- A saída de cada nó é passada como entrada do próximo
- Salva resultados intermediários em `agent_flow_node_results`
- Retorna resultado final

**`agent-flow-plan`** — nova edge function para "Criar com IA":
- Recebe a descrição do usuário em linguagem natural
- Consulta catálogo completo de agentes (nativos + custom do usuário)
- Usa IA para gerar um plano JSON: quais agentes usar, em que ordem, com que instruções
- Se um agente necessário não existe, inclui no plano a criação de um custom agent com nome, descrição e prompt sugerido
- Retorna o plano para aprovação do usuário antes de executar

### Navegação

- Adicionar link "Fluxos" no menu lateral/bottom nav com ícone `Workflow` do lucide
- Rota protegida `/fluxos` e `/fluxos/:flowId`

### Etapas de Implementação

1. Criar migração com as 5 tabelas + RLS policies
2. Criar página de listagem de fluxos (`/fluxos`)
3. Criar editor visual de fluxo (`/fluxos/:flowId`) com canvas de nós e conexões
4. Criar edge function `agent-flow-execute` para execução sequencial
5. Criar edge function `agent-flow-plan` para geração de fluxo via IA
6. Integrar modal "Criar com IA" na página de fluxos
7. Adicionar painel de execução com progresso em tempo real
8. Adicionar rotas e navegação

