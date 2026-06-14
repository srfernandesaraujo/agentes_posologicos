## Visão geral

Transformar uma `osce_exam` (prova) numa **sessão ao vivo**: o professor abre a sala, distribui um PIN, espera os alunos entrarem, clica **Iniciar** e o sistema cronometra a estação 1 para todos ao mesmo tempo. Quando o tempo da estação acaba, o servidor avança todos para a próxima. Ao final, cada aluno recebe seu boletim e o professor vê o ranking da turma em tempo real.

## Modelo de dados (nova migração)

Duas tabelas novas + uma coluna em `osce_attempts`:

- **`osce_exam_sessions`** — cada "aplicação" de uma prova
  - `exam_id`, `owner_id`, `pin` (6 dígitos único), `status` (waiting/running/finished), `current_station_index`, `current_station_started_at`, `started_at`, `finished_at`, `auto_advance` (bool)
- **`osce_session_participants`** — quem entrou na sala
  - `session_id`, `user_id`, `display_name`, `joined_at`, `current_attempt_id`
- **`osce_attempts`**: adicionar `session_id` (nullable, mantém compatibilidade com o fluxo assíncrono atual)

RLS:
- Sessão: dono gerencia; alunos com `participant` row leem dados básicos.
- Participants: aluno só vê os participantes da sessão em que entrou; dono vê todos.
- Realtime habilitado para as três tabelas (sessões, participantes, attempts) → sincroniza timer e ranking sem polling.

Função `start_next_station(session_id)` (security definer) chamada pelo professor ou por um job: incrementa `current_station_index`, fecha attempts em aberto, cria os novos attempts da próxima estação.

## Frontend

```text
/osce
  └─ aba "Provas" → botão "Aplicar ao vivo" cria uma osce_exam_session
/osce/sessao/:sessionId            (painel do professor)
  ├─ PIN grande + QR
  ├─ lista de participantes em tempo real
  ├─ botão Iniciar / Pausar / Próxima estação / Encerrar
  ├─ contador da estação atual
  └─ ranking parcial (nota + status por aluno)
/osce/entrar                       (aluno digita PIN)
/osce/sala/:sessionId              (aluno)
  ├─ tela "Aguardando professor iniciar..."
  ├─ quando status=running: redireciona p/ /osce/atendimento/:attemptId
  ├─ ao finalizar a estação, volta p/ esta tela aguardando próxima
  └─ ao final da sessão: boletim consolidado
```

Tudo via Supabase Realtime escutando `osce_exam_sessions` (timer/status) e `osce_session_participants` (entrada/saída). Sem polling.

## Edge functions

- **`osce-session-control`** — ações do professor: `start`, `pause`, `next`, `finish`. Cria os attempts da próxima estação para todos os participantes, dispara `osce-evaluate` em paralelo para attempts da estação anterior.
- **`osce-session-tick`** (opcional, via `pg_cron` a cada 15s) — auto-avança quando `now() - current_station_started_at > duration` e `auto_advance=true`. Garante que mesmo se o professor sair, a prova continua.

## Créditos

Sessão ao vivo: créditos debitados normalmente por estação avaliada (10/15/20). Professor pode marcar a sessão como "patrocinada" (debita do próprio saldo do professor) — útil para faculdades.

## Compatibilidade

Mantém o fluxo assíncrono atual intacto (`exam_id` sem `session_id`). A nova sessão é opt-in: o professor escolhe "aplicar ao vivo" ou deixa a prova disponível assíncrona.

## Entregáveis

1. Migração: 2 tabelas + coluna + RLS + Realtime + função SQL.
2. Edge function `osce-session-control`.
3. Páginas: `OSCESessionTeacher.tsx`, `OSCESessionStudent.tsx`, `OSCEJoin.tsx`.
4. Ajustes em `OSCE.tsx` (botão "Aplicar ao vivo") e em `OSCEAttendance.tsx` (detectar `session_id` e voltar pra sala ao terminar em vez de ir pro resultado).
5. (Opcional, mas recomendo) cron de auto-advance.

Confirma para eu seguir? Posso começar pela migração.