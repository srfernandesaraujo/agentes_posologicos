

## Plano: Implementar 6 Agentes de Produção de Conteúdo

### Agentes a criar

| # | Slug | Nome | Ícone | Custo |
|---|------|------|-------|-------|
| 1 | `roteirista-reels` | Roteirista de Reels e Shorts Científicos | `Youtube` | 1 |
| 2 | `carrosseis-instagram` | Gerador de Posts e Carrosséis para Instagram | `LayoutGrid`* | 1 |
| 3 | `ebooks-lead-magnets` | Criador de E-books e Lead Magnets Educacionais | `FileText` | 1 |
| 4 | `newsletter-email` | Redator de Newsletters e E-mail Marketing | `Mail`* | 1 |
| 5 | `landing-page-copy` | Construtor de Landing Pages e Copy de Vendas | `Megaphone`* | 1 |
| 6 | `assistente-podcast` | Assistente de Podcast e Multiplicação de Conteúdo | `Mic`* | 1 |

Todos na categoria **Produção de Conteúdo e Nicho Tech**. Ícones marcados com * precisam ser adicionados ao `iconMap`.

---

### Implementação técnica

#### 1. Atualizar `src/lib/icons.ts`
Adicionar imports e entradas no `iconMap` para: `LayoutGrid`, `Mail`, `Megaphone`, `Mic`.

#### 2. Edge Function (`supabase/functions/agent-chat/index.ts`)
Adicionar 6 prompts ao `AGENT_PROMPTS` antes do `};` (linha 3759):

- **roteirista-reels**: 2 fases — briefing (tema, plataforma, duração, tom) → roteiro timestampado com gancho 3s, variações de gancho, hashtags, sugestão de thumbnail, referência científica, dicas de gravação
- **carrosseis-instagram**: 2 fases — briefing (tema, formato, público) → carrossel slide a slide com texto, direção visual, paleta de cores, legenda completa, hashtags por alcance, variação para Stories
- **ebooks-lead-magnets**: 2 fases — briefing (tema, formato, público, produto) → estrutura completa capítulo a capítulo com textos prontos, CTAs internos, infográficos sugeridos, página de captura e sequência de 3 e-mails pós-download
- **newsletter-email**: 2 fases — briefing (tema, frequência, objetivo) → e-mail completo com 3 variações A/B de subject line, preview text, corpo com storytelling, segmentação, métricas-alvo e automação sugerida
- **landing-page-copy**: 2 fases — briefing (produto, público, preço) → landing page completa com 14 seções (hero, PAS, benefícios, módulos, para quem é, prova social, bônus, oferta, garantia, FAQ, urgência, CTA final)
- **assistente-podcast**: 2 fases — briefing (tema, formato, duração) → roteiro timestampado, perguntas para entrevista, show notes SEO, tabela de multiplicação (1 episódio → 10+ peças), 3 audiogramas sugeridos

#### 3. Database
INSERT de 6 registros na tabela `public.agents` via insert tool.

#### 4. Deploy
Redeploy automático da Edge Function `agent-chat`.

---

### Arquivos a editar/criar

| Ação | Arquivo |
|------|---------|
| Editar | `src/lib/icons.ts` — 4 novos ícones |
| Editar | `supabase/functions/agent-chat/index.ts` — 6 novos prompts |
| INSERT | `public.agents` — 6 registros via insert tool |

