

# Revisao Completa de UX e Fluxos do Sistema

## Resumo Executivo

Analisei todos os fluxos do sistema de ponta a ponta. A base esta solida com boa identidade visual e arquitetura funcional. Identifiquei **15 problemas de UX** organizados por prioridade, com sugestoes concretas de melhoria.

---

## 1. Onboarding e Primeiro Acesso

### Problema 1.1: Signup nao confirma email automaticamente
- Apos o cadastro, o usuario e redirecionado para `/login` com uma mensagem generica de sucesso
- Nao ha orientacao clara sobre verificacao de email (se habilitada no Supabase)
- **Sugestao**: Mostrar uma tela intermediaria "Verifique seu email" com instrucoes claras antes de redirecionar ao login

### Problema 1.2: Onboarding Tour limitado e fragil
- O tour so aparece em `/agentes` e depende de `prefs === null`, o que pode falhar se o registro de preferencias for criado por outro motivo
- Nao menciona o **Marketplace**, **Dashboard**, **Salas Virtuais** nem **Conteudos (Knowledge Bases)** -- funcionalidades importantes que o usuario pode nao descobrir sozinho
- **Sugestao**: Adicionar passos do tour para Marketplace, Dashboard e Salas Virtuais. Considerar adicionar um botao "Repetir tour" nas configuracoes

### Problema 1.3: Bonus de boas-vindas sem feedback visual
- Os 15 creditos de boas-vindas sao mencionados na tela de signup, mas apos o cadastro nao ha nenhum destaque visual (toast, banner, animacao) confirmando que os creditos foram recebidos
- **Sugestao**: Adicionar uma notificacao ou banner animado no primeiro acesso mostrando "Voce recebeu 15 creditos de boas-vindas!"

---

## 2. Navegacao e Layout

### Problema 2.1: Sidebar oculta no mobile -- sem navegacao alternativa
- A sidebar (`md:block`) fica completamente oculta em telas menores que 768px
- Nao existe hamburger menu, bottom navigation ou qualquer alternativa para mobile
- O usuario mobile so consegue navegar pelo header dropdown (que tem apenas Conta, Dashboard, Creditos, Admin e Logout)
- Paginas como Meus Agentes, Conversas, Conteudos, Salas Virtuais e Marketplace ficam **inacessiveis no mobile**
- **Sugestao**: Implementar um bottom navigation bar para mobile com os itens principais, ou um hamburger menu que abre a sidebar

### Problema 2.2: Dashboard nao esta na sidebar
- O Dashboard (`/dashboard`) so e acessivel pelo dropdown do avatar no header
- Nao aparece na sidebar, tornando-o pouco visivel
- **Sugestao**: Adicionar link do Dashboard na sidebar, idealmente como primeiro item

---

## 3. Fluxo dos Agentes e Chat

### Problema 3.1: Redirecionamento agressivo por falta de creditos
- Se o usuario sem creditos clica num agente nativo, o `useEffect` no Chat redireciona automaticamente para `/creditos` com um toast rapido
- O usuario pode nao entender o que aconteceu, especialmente se for a primeira vez
- **Sugestao**: Em vez de redirecionar automaticamente, mostrar um dialog/modal explicativo dentro do Chat com opcoes "Comprar creditos" ou "Voltar"

### Problema 3.2: Conversas de agentes personalizados nao sao salvas
- Agentes customizados (`isCustom`) usam `localMessages` em vez de salvar no banco (sem `session_id`)
- Isso significa que recarregar a pagina perde toda a conversa
- O usuario perde trabalho sem aviso
- **Sugestao**: Salvar conversas de agentes personalizados no banco tambem, ou ao menos avisar o usuario que as mensagens nao serao persistidas

### Problema 3.3: Conversas mostra sessoes antigas mas nao carrega a conversa correta
- Na pagina de Conversas, clicar numa sessao navega para `/chat/{agent_id}`, mas nao especifica qual sessao carregar
- O chat abre em branco (nova conversa) em vez de abrir a sessao que o usuario clicou
- **Sugestao**: Passar o `sessionId` como query param ou state para que o Chat carregue a sessao correta

---

## 4. Marketplace

### Problema 4.1: Sem filtros de categoria ou ordenacao
- O Marketplace so tem busca por texto, sem filtros por categoria ou ordenacao (mais recentes, melhor avaliados)
- **Sugestao**: Adicionar filtros de ordenacao (rating, recentes) e eventualmente categorias

### Problema 4.2: Usuario so pode avaliar depois de usar?
- Nao ha verificacao se o usuario realmente usou o agente antes de avaliar
- Qualquer usuario pode avaliar sem ter testado, o que pode prejudicar a confiabilidade das avaliacoes
- **Sugestao**: Considerar permitir avaliacao somente apos pelo menos uma interacao com o agente

---

## 5. Creditos e Monetizacao

### Problema 5.1: Custo de creditos cobrado ANTES da resposta da IA
- No chat, os creditos sao debitados antes de receber a resposta do agente
- Se a edge function falhar, o usuario perde creditos sem receber nenhuma resposta
- **Sugestao**: Debitar creditos apenas apos receber resposta com sucesso, ou implementar sistema de reembolso automatico em caso de erro

### Problema 5.2: Sem indicacao de custo antes de usar agente do Marketplace
- No card do Marketplace nao aparece o custo em creditos (0.5 por uso de agente personalizado)
- O usuario so descobre o custo quando ja esta no chat
- **Sugestao**: Mostrar o custo (0.5 creditos) nos cards do Marketplace

---

## 6. Seguranca e Dados

### Problema 6.1: API keys exibidas em texto plano
- Na pagina de Configuracoes, o campo `api_key_encrypted` e exibido diretamente, sugerindo que a chave esta armazenada em texto plano (ou com criptografia reversivel exibida no client)
- O botao "Mostrar" revela a chave completa
- **Sugestao**: Nunca retornar a chave completa do backend. Mostrar apenas os ultimos 4 caracteres apos salvar

---

## 7. Experiencia Geral

### Problema 7.1: Pagina de Configuracoes limitada
- A pagina de Configuracoes so tem API Keys
- Faltam opcoes como: tema, preferencias de notificacao, idioma (esta no header mas poderia estar aqui tambem), e opcao de repetir o onboarding tour
- **Sugestao**: Expandir a pagina de Configuracoes com mais opcoes de preferencias

### Problema 7.2: Landing page sem prova social real
- Os stats mostram valores fixos hardcoded ("10+", "5", "infinito", "RAG") que nao transmitem credibilidade
- Nao ha depoimentos de usuarios nem contadores reais
- **Sugestao**: Adicionar uma secao de depoimentos/testimonials e, quando possivel, contadores dinamicos reais

---

## Plano de Implementacao Sugerido (por prioridade)

### Alta Prioridade (impacto direto na usabilidade)
1. **Navegacao mobile** -- Implementar bottom nav ou hamburger menu
2. **Salvar conversas de agentes personalizados** ou avisar que nao persistem
3. **Corrigir fluxo de Conversas** para carregar a sessao clicada
4. **Debitar creditos apos sucesso** da resposta da IA

### Media Prioridade (melhorias de experiencia)
5. Expandir tour de onboarding com Marketplace, Dashboard e Salas
6. Feedback visual do bonus de boas-vindas
7. Modal de creditos insuficientes em vez de redirect
8. Mostrar custo nos cards do Marketplace
9. Adicionar Dashboard na sidebar

### Baixa Prioridade (polimento)
10. Filtros e ordenacao no Marketplace
11. Verificacao de uso antes de avaliar
12. Expandir pagina de Configuracoes
13. Melhorar landing page com prova social
14. Mascarar API keys no backend
15. Tela de verificacao de email no signup

