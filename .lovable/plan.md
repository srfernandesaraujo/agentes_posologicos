

# Integrar Chat com Agentes n8n

## Objetivo
Substituir a resposta mock do chat por chamadas reais aos webhooks do n8n, roteando automaticamente pelo slug do agente selecionado.

## Como funciona o roteamento

O chat ja carrega o agente completo (incluindo `slug`) pela URL `/chat/:agentId`. Uma Edge Function recebera o `agentId`, consultara o slug no banco e direcionara a chamada para o webhook correto no n8n.

```text
Usuario clica "Gerar"
       |
       v
Chat.tsx envia POST para Edge Function
  { agentId, input }
       |
       v
Edge Function consulta agents.slug
       |
       v
Mapeia slug -> webhook n8n
  ex: "interacoes-cardiovascular" -> /Analisador_Interacoes
       |
       v
POST para http://n8n-casaos.posologia.app/webhook/{path}
  com Bearer token do usuario
       |
       v
Retorna resposta do n8n para o frontend
```

## Etapas

### 1. Criar Edge Function `agent-chat`

Arquivo: `supabase/functions/agent-chat/index.ts`

- Recebe `{ agentId, input }` via POST
- Valida autenticacao do usuario via `getClaims()`
- Consulta a tabela `agents` para obter o `slug`
- Usa um mapa interno para converter slug em caminho do webhook n8n:

| Slug | Webhook |
|------|---------|
| interacoes-cardiovascular | /Analisador_Interacoes |
| analisador-turma | /Analisador_dados_turma |
| antibioticoterapia | /Consultor_antibioticoterapia |
| editais-fomento | /Assistente_editais |
| educador-cronicas | /Tradutor_Clinico |
| analise-estatistica | /Analise_estatistica |
| metodologias-ativas | /Arquiteto_de_metodologias_ativas |
| fact-checker | /Checador_de_fatos |
| simulador-clinico | /Simulador_de_casos_clinicos |
| seo-youtube | /Conteudo_Youtube |

- Faz POST para o webhook correspondente passando `{ input }` e o token do usuario no header Authorization
- Retorna a resposta do n8n ao frontend

### 2. Configurar `config.toml`

Adicionar a funcao com `verify_jwt = false` (validacao sera feita em codigo).

### 3. Atualizar `Chat.tsx`

Substituir o bloco mock (linhas 118-123) por uma chamada real:

```text
Antes:  await new Promise(...) + mockResponse
Depois: const { data } = await supabase.functions.invoke('agent-chat', {
          body: { agentId, input: text }
        })
```

A resposta do n8n sera salva como mensagem do assistente no banco.

### 4. Adicionar suporte a Markdown nas respostas

Instalar `react-markdown` para renderizar as respostas dos agentes com formatacao rica (listas, negrito, titulos, etc.), ja que os agentes do n8n provavelmente retornam texto formatado.

## Seguranca

- As URLs dos webhooks ficam apenas na Edge Function (servidor), nunca expostas ao frontend
- O token do usuario e repassado ao n8n para validacao
- A Edge Function valida autenticacao antes de processar

