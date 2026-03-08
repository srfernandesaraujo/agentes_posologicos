

## Plano: Implementar 6 Novos Agentes Educacionais

### Agentes a criar

| # | Slug | Nome | Categoria | Ícone | Custo |
|---|------|------|-----------|-------|-------|
| 1 | `gerador-questoes` | Gerador Inteligente de Questões de Prova | EdTech e Professores 4.0 | `ClipboardList` | 1 |
| 2 | `tutor-socratico` | Tutor Socrático Personalizado | EdTech e Professores 4.0 | `GraduationCap` | 1 |
| 3 | `construtor-rubricas` | Construtor de Rubricas de Avaliação | EdTech e Professores 4.0 | `FileSearch` | 1 |
| 4 | `tradutor-abstracts` | Tradutor Acadêmico e Corretor de Abstracts | Pesquisa Acadêmica e Dados | `BookOpen` | 1 |
| 5 | `gerador-mapas-mentais` | Gerador de Mapas Mentais e Resumos Visuais | EdTech e Professores 4.0 | `ScanEye` | 1 |
| 6 | `revisor-apresentacoes` | Revisor e Coach de Apresentações Científicas | Pesquisa Acadêmica e Dados | `Stethoscope` | 1 |

Todos os ícones já existem no `iconMap` — nenhuma alteração necessária em `src/lib/icons.ts`.

---

### Implementação técnica

#### 1. Edge Function (`supabase/functions/agent-chat/index.ts`)
Adicionar 6 novos prompts ao objeto `AGENT_PROMPTS` antes do fechamento `};` (linha 1676), seguindo o padrão existente (`<OBJETIVO>`, `<LIMITACOES>`, `<ESTILO>`, `<INSTRUCOES>`):

- **gerador-questoes**: Fluxo em 3 fases — recebe conteúdo → configura formatos (múltipla escolha, V/F, dissertativa, caso clínico, associação, mista) → gera questões classificadas por Taxonomia de Bloom com gabarito comentado e matriz de cobertura
- **tutor-socratico**: Fluxo contínuo — acolhe e identifica tema → sonda conhecimento prévio → questionamento progressivo em camadas (Bloom) → consolidação. Inclui `REGRA_ANTI_META_SOCRATICA`. NUNCA dá respostas diretas
- **construtor-rubricas**: Fluxo em 3 fases — identifica atividade → escolhe tipo (analítica/holística/híbrida) → gera rubrica com critérios, descritores por nível, alinhamento DCN/Bloom e versão para o aluno
- **tradutor-abstracts**: Fluxo em 2 fases — recebe texto + tipo + journal alvo → entrega tradução + notas terminológicas + análise de conformidade (IMRAD, tempo verbal, keywords/MeSH)
- **gerador-mapas-mentais**: Fluxo em 2 fases — recebe conteúdo → gera mapa mental hierárquico (com indentação visual), resumo esquemático, flashcards e roteiro de revisão espaçada
- **revisor-apresentacoes**: Fluxo em 3 fases — recebe material → diagnóstico com notas por aspecto → roteiro otimizado com sugestões de design e dicas de oratória

#### 2. Migration SQL (dados)
Inserir os 6 registros na tabela `public.agents` via migration.

#### 3. Deploy
Redeploy da Edge Function `agent-chat`.

---

### Arquivos a criar/editar

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/agent-chat/index.ts` — 6 novos prompts |
| Criar | Migration SQL — INSERT de 6 agentes |

