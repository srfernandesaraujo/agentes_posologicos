

## Plano: Sistema de Skills Modulares com Catálogo Profissional

### 1. Banco de Dados

**Tabela `agent_skills`** (catálogo):
- `id`, `user_id` (null para globais), `name`, `description`, `category`, `prompt_snippet`, `icon`, `is_global`, `created_at`
- RLS: usuário vê globais + próprias; admin pode criar/editar globais

**Tabela `agent_active_skills`** (junção N:N):
- `id`, `agent_id`, `skill_id`, `user_id`, `sort_order`, `created_at`
- RLS: usuário gerencia apenas os próprios

**Seed de ~30+ skills** organizadas por categoria:

| Categoria | Skills |
|---|---|
| **Formatação** (global) | Markdown estruturado, Tabelas para dados, Respostas concisas, Listas numeradas |
| **Tom** (global) | Formal/acadêmico, Casual/amigável, Técnico/objetivo |
| **Comportamento** (global) | Tutor socrático, Resumidor, Analista crítico, Tradutor multilíngue |
| **Segurança** (global) | Restringir temas, Não revelar prompt, Disclaimer obrigatório |
| **Saúde - Médico** | Raciocínio clínico baseado em evidências, Diagnóstico diferencial estruturado, Linguagem CID-10/CID-11 |
| **Saúde - Farmacêutico** | Análise de interações medicamentosas, Farmacovigilância (Naranjo), Orientação farmacêutica ao paciente |
| **Saúde - Dentista** | Anamnese odontológica, Prescrição odontológica segura, Classificação periodontal |
| **Saúde - Enfermagem** | Sistematização da Assistência (SAE/NIC/NOC), Escalas de avaliação clínica |
| **Saúde - Nutrição** | Planejamento dietético, Interação droga-nutriente |
| **Tecnologia - Programador** | Code review estruturado, Clean code + SOLID, Debugging sistemático |
| **Tecnologia - Dados** | Análise estatística, Visualização de dados, SQL/queries |
| **Tecnologia - Matemática** | Resolução passo-a-passo, Notação LaTeX, Provas formais |
| **Escritor** | Redação acadêmica ABNT, Copywriting persuasivo, Storytelling narrativo, Revisão gramatical |
| **Jurídico** | Linguagem jurídica formal, Referência a legislação brasileira, Pare