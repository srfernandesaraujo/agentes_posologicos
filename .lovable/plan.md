

## Plano: Painel de Reuniões com Integração Recall.ai

### Visão Geral

Criar um módulo completo de "Reuniões" que permite ao usuário colar um link do Google Meet, enviar um bot para gravar/transcrever a reunião, e ao final gerar uma ata estruturada automaticamente via IA.

### Arquitetura

```text
┌─────────────┐    ┌──────────────────┐    ┌───────────┐
│  Frontend   │───▶│  Edge Functions   │───▶│ Recall.ai │
│  /reunioes  │    │  meeting-bot      │    │   API     │
│             │◀───│  meeting-webhook  │◀───│           │
└─────────────┘    │  meeting-summary  │    └───────────┘
                   └──────────────────┘
```

### 1. Banco de Dados

Nova tabela `meetings`:
- `id`, `user_id`, `meet_link`, `status` (pending/recording/transcribing/summarizing/done/error)
- `bot_id` (ID retornado pelo Recall.ai)
- `transcript` (texto completo da transcrição)
- `summary` (ata gerada pela IA)
- `title`, `created_at`, `updated_at`
- RLS: usuário vê/edita apenas seus próprios registros

### 2. Edge Functions

**`meeting-bot`** (chamada do frontend):
- Recebe `meet_link` do usuário
- Envia para Recall.ai API (`POST /api/v1/bot`) para criar bot que entra na reunião
- Salva o `bot_id` e status na tabela `meetings`

**`meeting-webhook`** (callback do Recall.ai):
- Recebe notificação quando a transcrição está pronta
- Busca a transcrição completa via Recall.ai API
- Salva na tabela `meetings`
- Chama o Lovable AI Gateway para gerar a ata/resumo estruturado
- Atualiza o campo `summary` e status para `done`

**`meeting-summary`** (regenerar ata manualmente):
- Permite ao usuário regenerar a ata com um prompt diferente se necessário

### 3. Frontend

**Nova página `src/pages/Meetings.tsx`**