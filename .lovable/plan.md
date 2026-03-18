

## Plan: Integração WhatsApp via Evolution API

### Problema Atual
O `agent-chat` espera um payload `{ agentId, input, isCustomAgent }` com header `Authorization: Bearer <token>`. A Evolution API envia um payload completamente diferente (formato próprio com `event`, `data.key.remoteJid`, `data.message.conversation`, etc.) e sem nenhum header de autenticação Supabase. Além disso, não existe lógica para enviar a resposta de volta ao WhatsApp.

### Solução
Criar uma nova Edge Function dedicada (`whatsapp-webhook`) que atua como ponte entre a Evolution API e o `agent-chat`.

### Arquitetura

```text
WhatsApp → Evolution API → whatsapp-webhook → agent-chat → whatsapp-webhook → Evolution API → WhatsApp
```

### Implementação

**1. Nova Edge Function `supabase/functions/whatsapp-webhook/index.ts`**

- Recebe o payload da Evolution API (sem auth)
- Detecta o evento `messages.upsert` e extrai:
  - `data.key.remoteJid` (número do remetente)
  - `data.message.conversation` ou `data.message.extendedTextMessage.text` (texto da mensagem)
  - `data.pushName` (nome do contato)
- Ignora mensagens enviadas pelo próprio bot (`data.key.fromMe === true`) e mensagens de grupo
- Busca na tabela `whatsapp_connections` qual `agent_id` está vinculado ao webhook, usando o campo `webhook_url` ou um novo campo `instance_name`
- Chama o `agent-chat` internamente via `fetch` usando a `SUPABASE_SERVICE_ROLE_KEY` como Authorization (já suportado pelo agent-chat como "server call") e passando o `user_id` do dono do agente no body
- Mantém histórico de conversa por `remoteJid` em uma nova tabela `whatsapp_conversations`
- Envia a resposta de volta ao WhatsApp via Evolution API usando o endpoint `POST /message/sendText/{instance}`

**2. Nova tabela `whatsapp_conversations`**

Armazena o histórico de mensagens por número do WhatsApp para manter contexto:
- `id`, `whatsapp_connection_id`, `remote_jid` (número), `role` (user/assistant), `content`, `created_at`
- Limita a 20 mensagens por conversa (as mais recentes) ao enviar para o agent-chat

**3. Campos adicionais em `whatsapp_connections`**

- `instance_name` — nome da instância na Evolution API (necessário para enviar respostas)
- `evolution_api_url` — URL base da Evolution API do usuário (ex: `https://api.evolution.com`)
- `api_key` (encrypted) — API key da Evolution API para autenticar as chamadas de envio

**4. Atualizar `WhatsAppConnect.tsx`**

Adicionar campos para o usuário informar:
- URL da Evolution API
- Nome da instância
- API Key da Evolution API
- Instruções claras de configuração

**5. Configuração em `supabase/config.toml`**

```toml
[functions.whatsapp-webhook]
verify_jwt = false
```

### Seção Técnica — Payload Evolution API

O webhook da Evolution API envia eventos assim:
```json
{
  "event": "messages.upsert",
  "instance": "minha-instancia",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "..."
    },
    "pushName": "João",
    "message": {
      "conversation": "Qual o mecanismo de ação do omeprazol?"
    }
  }
}
```

A resposta é enviada via:
```
POST {evolution_api_url}/message/sendText/{instance_name}
Headers: { "apikey": "...", "Content-Type": "application/json" }
Body: { "number": "5511999999999", "text": "Resposta do agente..." }
```

### Fluxo Resumido

1. Aluno manda mensagem no WhatsApp
2. Evolution API dispara webhook para `whatsapp-webhook`
3. A função identifica o agente vinculado, carrega últimas 20 mensagens do histórico
4. Chama `agent-chat` com o contexto completo
5. Salva pergunta e resposta no histórico
6. Envia resposta de volta ao WhatsApp via Evolution API

