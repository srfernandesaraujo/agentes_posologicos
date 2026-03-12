
Diagnóstico objetivo (com base no código + banco):
- Sim, eu sei qual é o problema principal.
- O fluxo falha no 1º nó com `Agent not found` mesmo com `agent_id` válido em `agent_flow_nodes`.
- Causa mais provável: na chamada interna (`agent-flow-execute` -> `agent-chat`), o `agent-chat` entra em modo server-to-server, mas a busca de agente nativo ainda usa client não ideal para esse contexto; quando a busca nativa falha, cai no bloco de custom agent e retorna `Agent not found`.
- Encontrei também um bug secundário: `agent-flow-execute` tenta parsear resposta como SSE, mas `agent-chat` retorna JSON (`{ output }`), o que pode zerar saída dos nós mesmo quando não há erro.

Plano de correção (implementação):
1) Corrigir resolução de agente no `agent-chat`
- Arquivo: `supabase/functions/agent-chat/index.ts`
- Criar flag clara `isServerCall` (token service role + `bodyUserId`).
- Para chamadas internas, usar client de serviço para lookup de agente nativo/custom (não client dependente de contexto de usuário).
- Adicionar fallback robusto de lookup (id -> slug quando aplicável) e `trim` no `agentId`.
- Logar o motivo exato de fallback (sem expor segredo), para facilitar debug futuro.

2) Corrigir integração e parsing no `agent-flow-execute`
- Arquivo: `supabase/functions/agent-flow-execute/index.ts`
- Antes de executar, validar se todos os nós têm agente existente conforme `agent_type` (erro amigável por nó inválido).
- Trocar parsing de resposta do `agent-chat` para JSON padrão (remover fluxo SSE nessa função).
- Melhorar erro por etapa para retornar: `node_id`, `agent_id`, `agent_type` e mensagem clara.

3) Endurecer autenticação da execução (evitar regressão e abuso)
- Arquivo: `supabase/functions/agent-flow-execute/index.ts`
- Exigir autenticação real do usuário na entrada da função.
- Confirmar ownership do `flow_id` com `auth.uid()` antes de iniciar execução.
- Parar de confiar em `user_id` livre no body como fonte primária de autorização.

4) Melhorar feedback no frontend
- Arquivo: `src/pages/FlowEditor.tsx`
- Exibir erro técnico resumido por etapa (ex.: “nó aponta para agente inválido” vs “falha de execução interna”).
- Manter visual atual, apenas com mensagens mais acionáveis para o usuário.

Validação após implementação:
- Teste E2E com o mesmo fluxo da imagem (3 nós nativos) e entrada “Anti-inflamatórios não esteroidais”.
- Confirmar:
  1) não aparece mais `Agent not found`,
  2) etapa 1 gera output real,
  3) output da etapa N vira input da etapa N+1,
  4) execução finaliza com `status=completed`.
- Repetir teste com pelo menos 1 nó custom para garantir compatibilidade.
