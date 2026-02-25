

# Usar Chave de API do Usuario nos Agentes Nativos

## Situacao Atual

Os agentes nativos (Interacoes Cardiovascular, Antibioticoterapia, etc.) sempre usam o Lovable AI Gateway com a `LOVABLE_API_KEY`. As chaves de API configuradas pelo usuario em `/settings` so funcionam para agentes personalizados.

## Mudanca Proposta

Adicionar logica na Edge Function `agent-chat` para que, ao processar um agente nativo, o sistema primeiro verifique se o usuario tem uma chave de API configurada para algum provedor. Se tiver, usa a chave do usuario com o provedor/modelo escolhido. Se nao tiver, continua usando o Lovable AI Gateway como fallback.

## Implementacao

### 1. Edge Function `agent-chat` (bloco de agentes nativos, linhas 745-798)

Antes de chamar o Lovable AI Gateway, verificar se o usuario tem uma chave de API configurada:

- Buscar na tabela `user_api_keys` por qualquer chave do usuario
- Se encontrar, usar o provedor e a chave do usuario para fazer a chamada
- Reaproveitar a mesma logica de roteamento que ja existe para agentes personalizados (OpenAI, Anthropic, Groq, OpenRouter, Google)
- Se a chamada com a chave do usuario falhar, fazer fallback automatico para o Lovable AI Gateway (mesmo padrao dos agentes personalizados)

### 2. Preferencia de Provedor

Como o usuario pode ter varias chaves configuradas, sera necessario definir uma ordem de prioridade. A logica sera:

- Usar a chave mais recentemente atualizada (`updated_at` mais recente)
- Isso permite que o usuario controle qual provedor usar simplesmente atualizando/reconfigurando a chave desejada

### 3. Pagina de Configuracoes (opcional, melhoria visual)

Adicionar uma indicacao na pagina de Settings informando que a chave configurada sera usada tambem nos agentes nativos, nao apenas nos personalizados.

## Detalhes Tecnicos

- Arquivo principal: `supabase/functions/agent-chat/index.ts`
- A funcao de roteamento para provedores externos ja existe no codigo (linhas 900+) e sera extraida/reutilizada
- Mapeamento de modelos padrao por provedor (ex: OpenAI -> gpt-4o, Groq -> llama-3.3-70b-versatile) para quando o usuario nao especificar
- Fallback para Lovable AI Gateway em caso de erro, mantendo a mesma resiliencia dos agentes personalizados

