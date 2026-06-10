## Roadmap de Inovação — Agentes Posológicos

Foco: produtividade e colaboração para clínicos e professores, com paywall via créditos/planos. Combina quick wins (entrega rápida), features de médio porte e 2 big bets diferenciadores.

---

### Quick Wins (1-2 semanas cada)

#### 1. Comando Universal `/` (Command Palette com IA)
Atalho global (Cmd/Ctrl+K) em qualquer página que abre um command palette com:
- Busca unificada (conversas, agentes, fluxos, bases, reuniões, projetos)
- Ações rápidas ("nova conversa com X", "exportar última conversa", "adicionar ao projeto Y")
- Sugestões inteligentes baseadas no contexto da rota atual
- Atalho `/perguntar` que invoca o último agente usado sem sair da tela

**Custo:** Grátis. **Impacto:** reduz fricção em ~60% das navegações.

#### 2. Snippets/Macros de Saída (Output Actions)
Em cada resposta de chat, novos botões pós-resposta:
- "Transformar em material para paciente" (linguagem leiga + cronograma)
- "Gerar caso clínico a partir disto" (vira input do Simulador)
- "Virar plano de aula" (envia ao Arquiteto de Metodologias)
- "Gerar quiz de 10 questões" (com gabarito)
- "Exportar para WhatsApp" (formato curto, emojis didáticos)

**Custo:** 1-2 créditos por transformação. **Impacto:** aumenta uso de múltiplos agentes por sessão.

#### 3. Workspaces Compartilhados em Tempo Real para Aulas
Extensão das salas virtuais existentes com modo "Aula ao Vivo":
- Professor controla qual prompt vai para a turma (broadcast)
- Alunos veem a resposta sendo gerada em tempo real (streaming sincronizado)
- Quadro lateral de "dúvidas anônimas" agregadas pela IA em tempo real
- Exportação da sessão como apostila em PDF ao final

**Custo:** plano Pro+. **Impacto:** novo caso de uso para faculdades/cursos.

---

### Médio Porte (3-6 semanas cada)

#### 4. Agente Orquestrador (Multi-Agente Autônomo)
Um meta-agente que recebe um objetivo em linguagem natural ("preparar atendimento de paciente com DM2 + HAS + dislipidemia") e:
- Decompõe em subtarefas
- Roteia automaticamente para os agentes especialistas certos (Interações, Educador, Antibiótico, etc.)
- Consolida resultados num dossiê único navegável
- Mostra o "raciocínio de roteamento" de forma transparente

**Custo:** 8-15 créditos por execução. **Diferencial:** transforma o produto de "biblioteca de agentes" em "assistente único".

#### 5. Modo Voz + Briefing Diário
- Botão de microfone em qualquer agente (Web Speech API + Whisper como fallback)
- Resposta em voz natural (TTS) com controle de velocidade
- "Briefing matinal" opt-in: usuário cadastra interesses → recebe áudio de 3-5 min por dia/semana com: novos artigos PubMed, atualizações de protocolos, resumo de suas conversas pendentes
- Entregue por email (Resend) com player web + transcrição

**Custo:** plano Pro+ (briefing) e 1 crédito extra por voz. **Impacto:** uso em deslocamento, acessibilidade.

#### 6. Templates de Fluxos Públicos (Marketplace de Fluxos)
Hoje só existe marketplace de agentes. Adicionar:
- Publicação de fluxos completos (já existe a tabela `agent_flows`)
- Categorias: "Protocolo de alta hospitalar", "Avaliação OSCE", "Revisão sistemática", etc.
- Sistema de fork ("usar como base") + reviews
- Royalties: autor do fluxo ganha 2 créditos por execução de terceiros

**Custo:** 5 créditos para instalar fluxo de terceiros. **Impacto:** crescimento orgânico de conteúdo.

#### 7. Validador Clínico em Tempo Real (sidebar contextual)
Painel lateral que aparece em conversas dos agentes clínicos e, conforme o usuário digita uma prescrição/conduta, faz verificações em background:
- Cruza com OpenFDA (já integrado) para alertas de farmacovigilância
- Detecta interações via base local + LLM
- Sinaliza doses fora de faixa por faixa etária/função renal
- Tudo com badges (verde/amarelo/vermelho) e fontes clicáveis

**Custo:** plano Pro+. **Impacto:** posiciona o produto como ferramenta de segurança, não só geração.

---

### Big Bets (diferenciação de mercado)

#### 8. Simulador OSCE Virtual com Paciente Conversacional
Evolução do "Simulador de Casos" + "Paciente Virtual" existentes:
- Aluno entra numa "estação" cronometrada (5-10 min)
- IA assume o papel de paciente com persona, sintomas, omissões realistas
- IA assume também o papel de examinador silencioso, registrando: empatia, perguntas-chave feitas/omitidas, condutas corretas
- Ao final, rubrica detalhada com nota + feedback personalizado + replay
- Professor pode criar "provas" com várias estações e ver desempenho da turma num dashboard

**Custo:** 10-20 créditos por estação. Plano Educação dedicado para instituições. **Impacto:** abre vertical B2B de faculdades de saúde.

---

### Modelo de Monetização Sugerido

| Camada | Plano Atual | Adições Propostas |
|---|---|---|
| Free | 15 créditos iniciais | Command Palette, 1 transformação/dia |
| Pro | Crédito mensal | Aula ao Vivo, Modo Voz, Validador Clínico, Briefing |
| Educação (novo) | B2B faculdades | OSCE Virtual + dashboard de turma + SSO |
| Marketplace | Já existe | Royalties também em fluxos |

---

### Ordem Sugerida de Entrega

1. **Sprint 1-2:** Command Palette (#1) + Output Actions (#2) — entregas visíveis e baratas
2. **Sprint 3-4:** Aula ao Vivo (#3) + Templates de Fluxos (#6)
3. **Sprint 5-7:** Agente Orquestrador (#4) + Validador Clínico (#7)
4. **Sprint 8-10:** Modo Voz + Briefing (#5)
5. **Sprint 11-14:** OSCE Virtual (#8) — big bet com testes em parceira

---

### Detalhes Técnicos (visão geral)

- **#1 Command Palette:** componente novo `CommandPalette.tsx` + hook global; reusa shadcn `command`. Indexação client-side via React Query.
- **#2 Output Actions:** novas rotas no edge function `agent-chat` (parâmetro `transform_to`); reusa providers existentes.
- **#3 Aula ao Vivo:** estende `room_messages` com flag `broadcast`; usa Supabase Realtime (já em uso).
- **#4 Orquestrador:** novo edge function `agent-orchestrator` que internamente chama `agent-chat` em paralelo, similar ao padrão de `agent-flow-execute`.
- **#5 Voz:** Web Speech API no cliente + fallback Whisper via Lovable AI Gateway; TTS via gateway. Briefing usa pg_cron (padrão `pubmed-weekly-monitor`).
- **#6 Marketplace de Fluxos:** novas colunas em `agent_flows` (`published`, `installs_count`, `rating`); reusa `purchase-agent` como modelo.
- **#7 Validador Clínico:** debounce de 2s no input; chamadas paralelas para OpenFDA + LLM leve (gemini-flash) + base local de doses.
- **#8 OSCE:** nova tabela `osce_stations` + `osce_attempts`; usa streaming SSE para a conversa do paciente; rubrica avaliada por LLM com schema JSON estrito.

Confirme quais itens entram no escopo da primeira fase de implementação.