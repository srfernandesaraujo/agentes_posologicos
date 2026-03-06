

# Plano: Implementar 7 Novos Agentes de IA de Alto Impacto

## Agentes a Implementar

1. **Auditor de Prescrição por Imagem** (slug: `auditor-prescricao`) — Categoria: Prática Clínica e Farmácia
2. **Revisor de Artigo Científico** (slug: `revisor-artigo`) — Categoria: Pesquisa Acadêmica e Dados
3. **Simulador de Paciente Virtual com Voz** (slug: `paciente-virtual-voz`) — Categoria: EdTech e Professores 4.0
4. **Gerador de POP/SOP** (slug: `gerador-pop-sop`) — Categoria: Prática Clínica e Farmácia
5. **Monitor de Farmacovigilância** (slug: `farmacovigilancia`) — Categoria: Prática Clínica e Farmácia
6. **Construtor de Narrativa Lattes** (slug: `narrativa-lattes`) — Categoria: Pesquisa Acadêmica e Dados
7. **Comparador de Medicamentos** (slug: `comparador-medicamentos`) — Categoria: Prática Clínica e Farmácia

## Etapas Técnicas

### 1. Migration SQL — Inserir os 7 agentes na tabela `agents`

Inserir 7 registros na tabela `agents` com nome, descrição, categoria, ícone (Lucide), slug e `credit_cost` (1 crédito padrão). Os agentes serão inseridos com `active = true`.

### 2. Prompts no Edge Function `agent-chat/index.ts`

Adicionar 7 entradas no objeto `AGENT_PROMPTS` com prompts estruturados no mesmo padrão dos existentes (seções `<OBJETIVO>`, `<LIMITACOES>`, `<ESTILO>`, `<INSTRUCOES>`). Cada prompt será especializado:

- **auditor-prescricao**: Instrução para aceitar texto descrevendo prescrição (imagem será suportada futuramente via multimodal), cruzar interações, alertar sobre doses incorretas, gerar relatório estruturado.
- **revisor-artigo**: Análise IMRAD, score de publicabilidade, sugestão de revistas, checklist metodológico.
- **paciente-virtual-voz**: Gerar casos clínicos interativos onde o agente interpreta um paciente, respondendo perguntas do aluno com sintomas, exames e respostas emocionais realistas (texto por ora, voz como evolução futura via ElevenLabs).
- **gerador-pop-sop**: Gerar POPs/SOPs seguindo normas ANVISA, ONA, Joint Commission, com estrutura de documento pronto para impressão.
- **farmacovigilancia**: Monitorar/alertar sobre notificações de segurança recentes, analisar eventos adversos relatados, gerar relatório de farmacovigilância.
- **narrativa-lattes**: Receber dados acadêmicos em texto e transformar em bio narrativa para editais, LinkedIn, memoriais.
- **comparador-medicamentos**: Comparar 2+ medicamentos em eficácia, segurança, custo, disponibilidade SUS, contraindicações.

### 3. Atualizar categorias (se necessário)

A categoria "Prática Clínica e Farmácia" receberá 4 novos agentes. As constantes `CATEGORIES` em `useAgents.ts` já cobrem todas as categorias necessárias — nenhuma mudança no frontend.

### 4. Ícones

Mapear ícones Lucide existentes para cada agente: `ScanEye`, `FileSearch`, `UserRound`, `ClipboardList`, `ShieldAlert`, `GraduationCap`, `GitCompare` (ou similares disponíveis no projeto).

## Resumo de Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| Migration SQL | INSERT de 7 agentes na tabela `agents` |
| `supabase/functions/agent-chat/index.ts` | 7 novos prompts no `AGENT_PROMPTS` |

Nenhuma mudança de frontend necessária — os agentes aparecem automaticamente na biblioteca via query à tabela `agents`.

