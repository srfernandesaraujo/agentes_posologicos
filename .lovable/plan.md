

## Plano: Sistema de Consentimento e Coleta de Cookies

### O que será construído

Um sistema completo de consentimento de cookies (LGPD-compliant) com banner, gerenciamento de preferências e coleta de dados analíticos úteis para o negócio.

---

### Cookies que serão coletados

| Cookie | Categoria | Finalidade | Uso para o negócio |
|--------|-----------|------------|---------------------|
| `cookie_consent` | Necessário | Armazena a escolha do usuário sobre cookies | Compliance LGPD |
| `sidebar:state` | Necessário | Já existe — estado da sidebar | UX |
| `analytics_session` | Analítico | ID de sessão anônimo, páginas visitadas, tempo de permanência | Entender quais agentes atraem mais interesse, otimizar landing page |
| `utm_source` / `utm_campaign` | Marketing | Rastrear origem do tráfego (links de redes sociais, anúncios) | Saber de onde vêm os usuários que convertem em assinantes |
| `preferred_language` | Funcional | Idioma preferido do usuário | Personalização |
| `last_agent_viewed` | Funcional | Último agente visualizado | Sugestões personalizadas e retargeting |

### Como usar os dados a seu favor

1. **Analytics internos (painel Admin)**: Agentes mais visualizados antes do cadastro, taxa de conversão por fonte de tráfego, páginas com maior abandono
2. **Personalização**: Mostrar agentes relevantes baseado no histórico de navegação
3. **Marketing**: Identificar quais campanhas (UTM) geram mais assinantes pagos
4. **Otimização de produto**: Saber quais categorias de agentes têm mais interesse antes mesmo do login

---

### Implementação técnica

#### 1. Componente `CookieConsent` (novo)
- Banner fixo no rodapé com texto explicativo
- 3 botões: "Aceitar todos", "Apenas necessários", "Personalizar"
- Modal de personalização com toggles por categoria (Necessários, Funcionais, Analíticos, Marketing)
- Salva preferência no cookie `cookie_consent` (JSON com categorias aceitas)
- Só aparece se `cookie_consent` não existir

#### 2. Hook `useCookieConsent` (novo)
- Lê/escreve o cookie `cookie_consent`
- Expõe funções: `hasConsent(category)`, `setConsent(preferences)`, `trackEvent(name, data)`
- Só coleta cookies das categorias autorizadas

#### 3. Hook `useAnalytics` (novo)
- Rastreia pageviews, tempo na página, cliques em agentes
- Salva dados no localStorage agrupados por sessão
- Envia batch para o Supabase via tabela `analytics_events` quando o usuário tem conta, ou mantém local para visitantes anônimos

#### 4. Tabela Supabase `analytics_events` (nova)
- Colunas: `id`, `user_id` (nullable), `session_id`, `event_type`, `event_data` (jsonb), `page`, `utm_source`, `utm_campaign`, `created_at`
- RLS: usuários só veem seus próprios eventos; admin vê todos

#### 5. Integração
- `CookieConsent` renderizado no `App.tsx` (fora das rotas, sempre visível)
- `useAnalytics` integrado na Landing, páginas públicas e páginas de agentes
- Painel Admin recebe nova aba "Analytics de Visitantes" com dados dos cookies

#### 6. Página de Política de Cookies
- Nova rota `/cookies` com detalhamento de cada cookie, finalidade e duração
- Link adicionado ao banner de consentimento e ao rodapé

---

### Arquivos a criar/editar

| Ação | Arquivo |
|------|---------|
| Criar | `src/components/cookies/CookieConsent.tsx` |
| Criar | `src/components/cookies/CookiePreferencesModal.tsx` |
| Criar | `src/hooks/useCookieConsent.ts` |
| Criar | `src/hooks/useAnalytics.ts` |
| Criar | `src/pages/CookiePolicy.tsx` |
| Editar | `src/App.tsx` — adicionar CookieConsent e rota `/cookies` |
| Editar | `src/pages/Landing.tsx` — adicionar link de cookies no rodapé |
| Criar | Migration para tabela `analytics_events` |

