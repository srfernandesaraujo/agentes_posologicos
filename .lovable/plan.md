## Auto-Fine-Tuning de Agentes por Feedback

Sistema que evolui automaticamente os `system_prompt` dos agentes (nativos e customizados) com base nos feedbacks (👍/👎 + comentários) já coletados em `response_feedback`, criando versões melhoradas, validadas e revertíveis.

---

### 1. Conceito

Quando um agente acumula **massa crítica de feedback** (ex.: ≥ 10 avaliações novas desde a última otimização **e** taxa de 👎 ≥ 20% **OU** ≥ 5 comentários textuais novos), um pipeline automático:

1. Coleta feedbacks recentes + trecho da conversa associada (pergunta do usuário + resposta do agente).
2. Envia para um "Agente Otimizador de Prompts" (Gemini 2.5 Pro, seguindo a ordem de provedores Google → ... → Lovable).
3. Gera uma **proposta de novo `system_prompt`** com diff explicado.
4. Salva como **versão pendente** (não aplica direto).
5. Notifica o **dono do agente** (ou admin, p/ agentes nativos) para **aprovar / rejeitar / editar**.
6. Após aprovação, vira a versão ativa; versões antigas ficam no histórico para rollback 1-clique.

Modo opcional **"auto-aplicar"** (toggle por agente) para usuários que confiam no fluxo — ainda assim mantém histórico e rollback.

---

### 2. Novas tabelas

- **`agent_prompt_versions`** — histórico de prompts
  - agente (nativo ou custom), versão (int), prompt, status (`active` | `pending` | `archived` | `rejected`), origem (`manual` | `auto_feedback`), resumo das mudanças, métricas-base (👍/👎 no momento da geração), criado por.

- **`agent_optimization_runs`** — execuções do pipeline
  - agente alvo, janela de feedback analisada (de/até), nº feedbacks positivos/negativos, comentários usados, modelo/provedor utilizado, status (`running`|`success`|`failed`|`skipped`), versão gerada, erro.

- **`agent_optimization_settings`** — configuração por agente
  - auto_optimize_enabled (bool), auto_apply (bool), min_feedbacks (default 10), negative_threshold (default 0.2), última execução.

RLS: dono do agente vê/edita o seu; admin vê todos os agentes nativos.

---

### 3. Edge Functions

- **`agent-prompt-optimizer`** (invocável manual + via cron)
  - Input: `agentId`, `agentType` (`native|custom`), `force?: boolean`.
  - Lê settings → checa thresholds → coleta últimos N feedbacks (com mensagens via `messages`/`session_id`) → monta prompt do otimizador → chama AI Gateway respeitando ordem (Google primeiro) → salva nova versão `pending` (ou `active` se auto_apply) → cria notificação para o dono → registra run.

- **Cron (pg_cron + pg_net)**: roda diariamente às 04:00 e dispara `agent-prompt-optimizer` para cada agente elegível (query de candidatos).

- **`agent-prompt-rollback`** — alterna a versão ativa de volta para uma anterior (apenas dono/admin).

A função **`agent-chat`** passa a ler o `system_prompt` da **versão `active` em `agent_prompt_versions`** quando existir; caso contrário usa o campo legado em `agents`/`custom_agents` (compatibilidade).

---

### 4. UI

- **Editor do agente** (`AgentEditor` e `NativeAgentEditor`) ganha aba **"Otimização Automática"**:
  - Toggle "Habilitar auto-fine-tuning" e "Auto-aplicar sem revisão".
  - Sliders: nº mínimo de feedbacks, % máximo de 👎 tolerado.
  - Lista de **versões** com diff visual (linha-a-linha), métricas, botão **Aprovar / Rejeitar / Reverter**.
  - Botão **"Otimizar agora"** (executa manualmente).

- **`NotificationBell`**: nova notificação tipo `prompt_optimization_pending` linkando para a aba.

- **Admin**: nova aba em `/admin` listando todos os runs e versões pendentes globais.

---

### 5. Fluxo de aprovação

```text
Feedback acumula
   │
   ▼
Cron diário OR botão manual
   │
   ▼
Edge function coleta dados → chama LLM → gera proposta
   │
   ├── auto_apply=false → versão "pending" + notificação → dono aprova → "active"
   │
   └── auto_apply=true  → versão "active" direto (anterior vira "archived")
```

Rollback sempre disponível pela aba de versões.

---

### 6. Detalhes técnicos

- Reaproveita `ai_usage_log` para medir custo do otimizador.
- Otimizador roda com `gemini-2.5-pro` por padrão (memory: model-priority-prompt-generation).
- Limita comentários a 50 por run para caber no contexto.
- Sanitiza PII básico antes de enviar amostras de mensagens.
- Toda escrita usa `SUPABASE_SERVICE_ROLE_KEY` na edge function (bypass RLS controlado).
- Eficácia medida comparando taxa de 👍 nos N feedbacks pós-aplicação vs N pré-aplicação — exibida na UI ("Versão v3 melhorou +12% de aprovação").

---

### 7. Entregáveis

1. Migração: 3 tabelas + RLS + índices + cron job.
2. Edge functions: `agent-prompt-optimizer`, `agent-prompt-rollback`.
3. Ajuste em `agent-chat` para ler versão ativa.
4. UI: aba "Otimização Automática" nos dois editores + admin view.
5. Notificações + tradução pt/en/es.
