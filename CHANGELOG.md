# Changelog

Registro cronológico das mudanças relevantes da plataforma **Agentes Posológicos**. Cada entrada é gerada automaticamente pelo workflow `doc-oracle-sync` a cada push relevante para `main` (veja [.github/workflows/doc-oracle-sync.yml](.github/workflows/doc-oracle-sync.yml)), com a data em que a mudança foi detectada.

Este arquivo é o histórico bruto das mudanças. A documentação voltada ao usuário fica em `src/data/docSections.tsx` (renderizada em `/docs` e `/documentacao`); o conhecimento do agente Oráculo fica embutido em `supabase/functions/agent-chat/index.ts`. O mesmo workflow mantém o Oráculo sincronizado com as mudanças registradas aqui.

<!-- Novas entradas são inseridas abaixo desta linha pelo workflow automático. Não edite manualmente o marcador. -->
<!-- ENTRADAS_AUTOMATICAS -->

## 2026-08-08

**Novo Agente Nativo: Arquiteto de PRD Premium** — Um novo agente foi adicionado para auxiliar na criação de Product Requirements Documents (PRDs) completos, seguindo padrões de Big Techs. Ele ajuda a transformar ideias em documentos de requisitos rigorosos, cobrindo problema, métricas de sucesso, personas, requisitos priorizados e planos de rollout. Ideal para founders, PMs e times de tecnologia.


## 2026-07-26 — Início do changelog automático

- Criado o changelog automático e o workflow `doc-oracle-sync`, que passa a documentar toda mudança relevante enviada para `main` e a manter o prompt do Oráculo (agente de suporte) sincronizado com o estado real do sistema.
