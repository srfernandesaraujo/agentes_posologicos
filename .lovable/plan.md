# Plano: Funcionalidades de Alto Valor para os Usuários

## Contexto

O sistema já é robusto: agentes nativos e custom, fluxos complexos, salas colaborativas, base de conhecimento (RAG), marketplace, créditos, atas de reunião, WhatsApp, PubMed, certificação de conteúdo, etc.

A pergunta agora não é "o que falta tecnicamente?", mas **"qual dor real ainda não está resolvida?"** para os perfis-alvo (farmacêuticos clínicos, professores de saúde, pesquisadores e criadores de conteúdo).

A dor comum e transversal que identifiquei observando o produto:

> **"Eu gero MUITO conteúdo com a IA, mas perco esse conhecimento. Cada conversa morre isolada, eu não consigo reaproveitar, não consigo provar autoria, não consigo transformar em entregável final sem retrabalho enorme — e quando preciso colaborar ou prestar contas (aluno, paciente, banca, cliente), o material da IA parece 'solto demais'."**

A partir disso, proponho 5 frentes priorizadas por **impacto × diferenciação × esforço**.

---

## Frente 1 — Workspaces / Projetos (alta prioridade)

**Dor resolvida:** hoje conversas, fluxos, bases de conhecimento, atas e arquivos vivem soltos. O usuário não consegue agrupar "tudo do meu TCC", "tudo da disciplina de Farmacologia 2026.1", "tudo do paciente X" num só lugar.

**Proposta:**
- Entidade `projects` (workspace) agrupando: conversas, fluxos executados, KBs, atas, certificados, anexos.
- Painel do projeto com timeline, busca unificada e tags.
- Compartilhamento granular do projeto (read/write) com colegas convidados — reaproveita a lógica de unlimited invited users.
- Exportação do projeto inteiro (zip com PDFs + JSON).

**Por que é diferenciador:** transforma o app de "ferramenta de IA" em "ambiente de trabalho do profissional", aumentando retenção e LTV.

---

## Frente 2 — Entregáveis Estruturados ("Artefatos")

**Dor resolvida:** o output do chat é texto. O usuário ainda precisa formatar manualmente em plano de aula, prescrição comentada, material para paciente, roteiro de vídeo, projeto de pesquisa, etc.

**Proposta:**
- Tipo de saída "Artefato" por agente: além do chat livre, o agente pode produzir um documento estruturado editável (campos previsíveis: objetivo, conteúdo, cronograma, referências…).
- Editor lateral com preview e versionamento (v1, v2, v3) — já existe o padrão `_v2` em /mnt/documents, replicar no app.
- Templates de saída por categoria: Plano de Aula, Material para Paciente (PT-BR didático), Caso Clínico, Roteiro YouTube, Resumo Executivo de Projeto.
- Exportação consistente: PDF estilizado, DOCX, e link público com certificado SHA-256 (já existe a infra de content_certificates).

**Por que é diferenciador:** entrega "trabalho pronto", não rascunho. Encurta a distância entre chat e produto final.

---

## Frente 3 — Memória do Usuário ("O agente que me conhece")

**Dor resolvida:** o usuário repete contexto toda hora ("sou professor de farmácia, dou aula para o 5º período, uso metodologia ativa…"). A IA esquece tudo entre sessões.

**Proposta:**
- Perfil profissional estruturado (área, público-alvo, tom de voz preferido, instituições, linhas de pesquisa, restrições éticas).
- Memória vetorial leve de "fatos sobre o usuário" extraídos automaticamente das conversas (com opt-in e painel de revisão/remoção — LGPD).
- Injeção automática como `<USER_CONTEXT>` em todos os agentes, com toggle por conversa.

**Por que é diferenciador:** percepção de "IA personalizada" sem precisar criar agente custom para cada coisa. Vira competitive moat e melhora qualidade percebida com custo marginal mínimo.

---

## Frente 4 — Biblioteca de Evidências Citáveis

**Dor resolvida:** farmacêuticos, pesquisadores e professores precisam **provar a fonte** do que a IA disse. Hoje o PubMed Specialist existe, mas as citações não viram um acervo organizado.

**Proposta:**
- "Minha Estante": toda referência (PubMed, OpenFDA, VigiAccess, KB própria) usada nas conversas é salva, deduplicada e taggeada.
- Botão "Citar nesta resposta" injeta a referência formatada (Vancouver/ABNT/APA — escolha do usuário).
- Exportação BibTeX / RIS para Mendeley / Zotero.
- Alerta semanal de novas evidências em tópicos salvos (reusa pubmed-weekly-monitor + cron).

**Por que é diferenciador:** resolve o ceticismo "IA inventa referência" — virou exigência regulatória/acadêmica.

---

## Frente 5 — Modo "Apresentação ao Vivo" para professores

**Dor resolvida:** professor monta o material com IA mas, em sala, precisa de outra ferramenta (slides) e perde a interatividade.

**Proposta:**
- A partir de um artefato "Plano de Aula", gerar deck navegável (HTML fullscreen) com cronômetro de etapas.
- Modo aluno: link público com QR code, alunos enviam dúvidas que aparecem como overlay.
- Geração automática de quiz pós-aula a partir do conteúdo (reusa agentes existentes).

**Por que é diferenciador:** fecha o loop "preparar → apresentar → avaliar" dentro do mesmo produto. Difícil de copiar.

---

## Detalhes Técnicos

- **Frente 1:** nova tabela `projects` + `project_items` (polimórfico: conversation_id | flow_run_id | knowledge_base_id | meeting_id | artifact_id), RLS por owner + membros, função `has_project_access(_user, _project)` no padrão SECURITY DEFINER já usado.
- **Frente 2:** tabela `artifacts` (project_id, type, content jsonb, version), edge function `artifact-render` para PDF/DOCX (reusa jsPDF + fflate). Integrar com `content_certificates`.
- **Frente 3:** tabela `user_memory_facts` (user_id, fact, source_conversation_id, confidence, active), edge function `extract-user-facts` chamada async pós-conversa via gemini-2.5-flash. Painel em /conta.
- **Frente 4:** tabela `user_references` (user_id, source, identifier, payload jsonb, tags[]), botão no MessageActions.
- **Frente 5:** rota `/aula/:artifactId/apresentar`, canal Realtime para perguntas, edge function `generate-quiz`.

Tudo segue padrões já estabelecidos: pt-BR, Markdown tables, dark theme teal/orange, RLS rigoroso, AI Gateway com fallback Google → OpenAI → Anthropic.

---

## Sugestão de Ordem

1. **Memória do Usuário** (Frente 3) — menor esforço, ganho de qualidade percebida imediato.
2. **Workspaces** (Frente 1) — base estrutural para o resto.
3. **Artefatos** (Frente 2) — depende de Workspaces.
4. **Biblioteca de Evidências** (Frente 4).
5. **Apresentação ao Vivo** (Frente 5) — depende de Artefatos.

---

Quer que eu detalhe alguma frente específica em um plano de implementação executável, ou prefere que comece direto pela Frente 3 (Memória do Usuário)?