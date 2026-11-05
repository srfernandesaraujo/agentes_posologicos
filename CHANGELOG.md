# Changelog

Registro cronológico das mudanças relevantes da plataforma **Agentes Posológicos**. Cada entrada é gerada automaticamente pelo workflow `doc-oracle-sync` a cada push relevante para `main` (veja [.github/workflows/doc-oracle-sync.yml](.github/workflows/doc-oracle-sync.yml)), com a data em que a mudança foi detectada.

Este arquivo é o histórico bruto das mudanças. A documentação voltada ao usuário fica em `src/data/docSections.tsx` (renderizada em `/docs` e `/documentacao`); o conhecimento do agente Oráculo fica embutido em `supabase/functions/agent-chat/index.ts`. O mesmo workflow mantém o Oráculo sincronizado com as mudanças registradas aqui.

<!-- Novas entradas são inseridas abaixo desta linha pelo workflow automático. Não edite manualmente o marcador. -->
<!-- ENTRADAS_AUTOMATICAS -->

## 2026-11-05

- **Nova funcionalidade: Mascaramento de Segredos em Squads.** Para squads de desenvolvimento e outros que lidam com código, o sistema agora detecta e mascara automaticamente chaves de API, tokens e senhas nos formulários de entrada, aumentando a segurança. Uma notificação será exibida se segredos forem removidos.
- **Novo template de Squad: Vibe Coding e Full-Stack.** Um squad especializado para gerar arquitetura, código (web/API), scripts de deploy, testes e revisão de segurança, com foco em propostas textuais e segurança aprimorada de segredos.


## 2026-07-26 — Início do changelog automático

- Criado o changelog automático e o workflow `doc-oracle-sync`, que passa a documentar toda mudança relevante enviada para `main` e a manter o prompt do Oráculo (agente de suporte) sincronizado com o estado real do sistema.
