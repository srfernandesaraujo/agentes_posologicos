## Frente 1 — Workspaces/Projetos

Permite ao usuário agrupar **conversas, fluxos, bases de conhecimento, reuniões e certificados** em projetos com timeline, busca e compartilhamento.

### Escopo do MVP (entregue agora)

1. **Modelo de dados**
   - `projects` (id, user_id, name, description, color, icon, tags[], archived, created_at, updated_at)
   - `project_items` — relação polimórfica (id, project_id, item_type, item_id, added_at, added_by). `item_type` ∈ `conversation | flow | knowledge_base | meeting | certificate`.
   - `project_collaborators` (id, project_id, user_email, role: `viewer|editor`, invited_at) — usa o mesmo padrão de `unlimited_users` (por email, suporta convidados via Resend).
   - Função `has_project_access(project_id, user_id, min_role)` + RLS em todas as tabelas relacionadas para SELECT de itens compartilhados (mantém políticas atuais; adiciona uma cláusula OR via security definer).

2. **UI — nova rota `/projetos`**
   - Lista de projetos em grid (card com cor/ícone/contadores).
   - Botão "Novo projeto" (modal: nome, descrição, cor, ícone, tags).
   - Página de detalhe `/projetos/:id`:
     - Header com nome editável, descrição, tags, ações (arquivar, excluir, compartilhar, exportar).
     - Tabs: **Timeline** (todos os itens em ordem cronológica), **Conversas**, **Fluxos**, **Bases**, **Reuniões**, **Certificados**.
     - Cada item linka para sua tela nativa atual.
   - Componente "Adicionar ao projeto" reutilizável (DropdownMenu) — disponível em:
     - `Conversations.tsx` (ação por item).
     - `Flows.tsx`, `Knowledge.tsx`, `Meetings.tsx`.

3. **Compartilhamento**
   - Modal de Share: lista colaboradores, adicionar por email (viewer/editor), remover.
   - Edge function `invite-project-collaborator` envia email via Resend (mesmo template de `invite-user`) com link para `/projetos/:id`.
   - Acesso validado server-side via `has_project_access`.

4. **Exportação**
   - Botão "Exportar projeto" → Edge function `export-project` gera ZIP em memória (fflate) contendo:
     - `project.json` (metadados + lista de itens)
     - `conversations/<id>.pdf` (reusa `exportConversationPdf`)
     - `flows/<id>.pdf` (reusa `exportFlowPdf`)
     - `meetings/<id>.md` (transcrição + summary)
   - Retorna URL temporária (Storage bucket privado `project-exports` com TTL 24h).

### Fora do MVP (próximas iterações)
- Busca unificada full-text dentro de um projeto.
- Comentários/threads por item.
- Permissões granulares por item (apenas no nível do projeto por enquanto).
- Compartilhamento público via link.

### Detalhes técnicos

- **RLS**: cada tabela de item (`chat_sessions`, `agent_flows`, `knowledge_bases`, `meetings`, `content_certificates`) ganha uma policy `Collaborators can view via project` usando `EXISTS (SELECT 1 FROM project_items pi JOIN project_collaborators pc ... WHERE ...)`. Mantém a policy de dono atual.
- **Edge functions**: `invite-project-collaborator`, `export-project`. Ambas com `verify_jwt = false` + validação manual de JWT (padrão do projeto).
- **Storage**: novo bucket privado `project-exports` (RLS: dono lê seu próprio).
- **Estética**: dark theme atual, gradiente teal/azul, accent laranja. Cards de projeto com a `color` escolhida como borda + glow sutil.
- **i18n**: textos em pt-BR (consistente com sistema).

### Ordem de implementação
1. Migration (tabelas + RLS + função `has_project_access` + bucket).
2. Hooks `useProjects`, `useProjectItems`, `useProjectCollaborators`.
3. Páginas `/projetos` e `/projetos/:id` + rota.
4. Componente `AddToProjectMenu` integrado em Conversations/Flows/Knowledge/Meetings.
5. Edge functions `invite-project-collaborator` + `export-project`.
6. Item de menu no header/sidebar + entrada na onboarding tour.

Confirma o escopo do MVP? Posso seguir direto para implementação.