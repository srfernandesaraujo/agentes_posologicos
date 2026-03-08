

## Plano: Implementar 6 Agentes de Pesquisa Acadêmica

### Agentes a criar

| # | Slug | Nome | Categoria | Ícone | Custo |
|---|------|------|-----------|-------|-------|
| 1 | `revisor-sistematico` | Revisor Sistemático e Assistente de Metanálise | Pesquisa Acadêmica e Dados | `ClipboardList` | 1 |
| 2 | `escrita-cientifica` | Assistente de Escrita Científica e Formatação | Pesquisa Acadêmica e Dados | `FileText` | 1 |
| 3 | `referencial-teorico` | Gerador de Referencial Teórico e Revisão de Literatura | Pesquisa Acadêmica e Dados | `BookOpen` | 1 |
| 4 | `propriedade-intelectual` | Consultor de Propriedade Intelectual e Patentes | Pesquisa Acadêmica e Dados | `ShieldCheck` | 1 |
| 5 | `mentor-carreira` | Mentor de Carreira Acadêmica e Produtividade | Pesquisa Acadêmica e Dados | `UserRound` | 1 |
| 6 | `analista-qualitativo` | Analista de Dados Qualitativos | Pesquisa Acadêmica e Dados | `MessageCircleHeart` | 1 |

Todos os ícones já existem no `iconMap`.

---

### Implementação técnica

#### 1. Edge Function (`supabase/functions/agent-chat/index.ts`)
Adicionar 6 prompts ao `AGENT_PROMPTS` antes do `};` (linha 2978), com padrão `<OBJETIVO>`, `<LIMITACOES>`, `<ESTILO>`, `<INSTRUCOES>`:

- **revisor-sistematico**: 3 fases — estruturação do protocolo PRISMA (PICO, critérios, estratégia de busca, registro PROSPERO) → seleção e extração (fluxograma PRISMA, formulário de extração, avaliação RoB 2/Newcastle-Ottawa com semáforo) → síntese e metanálise (modelo de efeitos, heterogeneidade I²/Tau², GRADE, tabela SoF)
- **escrita-cientifica**: 2 fases — diagnóstico do manuscrito (tabela com notas 1-10 por aspecto: IMRAD, coerência, voz, conectivos) → revisão detalhada com track-changes simulado ([ORIGINAL] → [SUGESTÃO] + justificativa + prioridade 🔴🟡🟢) e checklist por seção. Suporta Vancouver, APA e ABNT
- **referencial-teorico**: 2 fases — mapeamento (mapa conceitual hierárquico, autores seminais sugeridos com aviso de verificação, estratégia de busca por subtema) → estruturação e redação (template por seção com parágrafos de contexto/definição/revisão/crítica/transição, framework conceitual, identificação de gaps)
- **propriedade-intelectual**: 2 fases — avaliação de patenteabilidade (3 requisitos Lei 9.279/96 com semáforo, alerta de grace period BR/EUA/Europa) → estratégia de proteção (tipo de PI, busca de anterioridade INPI/Espacenet/USPTO, estrutura de reivindicações, cronograma depósito→PCT→fase nacional)
- **mentor-carreira**: 2 fases — diagnóstico de carreira (tabela de indicadores vs. metas vs. gaps: publicações, Qualis, h-index, orientações, financiamento) → plano estratégico (seleção de journals, networking, editais CNPq/CAPES/FAPs, preparação para concursos com barema, cronograma 12 meses, gestão de tempo e prevenção de burnout)
- **analista-qualitativo**: 2 fases — configuração (escolha do método: Bardin, Braun & Clarke, Grounded Theory, Análise de Discurso, IPA, Narrativa) → codificação e categorização (tabelas de códigos, agrupamento em categorias, mapa temático textual, matriz de análise cruzada, critérios de rigor: triangulação, member checking, saturação)

#### 2. Database (INSERT via insert tool)
Inserir 6 registros na tabela `public.agents`.

#### 3. Deploy
Redeploy automático da Edge Function `agent-chat`.

---

### Arquivos a editar/criar

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/agent-chat/index.ts` — 6 novos prompts |
| INSERT | `public.agents` — 6 registros via insert tool |

