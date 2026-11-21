// Reunião Viva. Ações (POST JSON, sempre autenticado). Fase 3: o papel de quem pede (anfitrião, participante, observador) é conferido
// em `canDo` (squadMeetingAccess.ts) antes de qualquer ação; convidado só pode view, say e leave, e o custo/chaves são do anfitrião.
//   join     { token }                                                 → convidado entra pelo link (conta obrigatória)
//   view     { meetingId }                                             → leitura segura da reunião (convidado e anfitrião)
//   create_invite { meetingId, role } | revoke_invite { inviteId } | list_members | remove_member { userId }   → só o anfitrião
//   leave    { meetingId }                                             → convidado sai
//   approve_action { meetingId, actionId, edits? } | discard_action { meetingId, actionId }   → só o anfitrião: executa (Gmail/Agenda) ou descarta uma ação proposta por um agente
// Ações do anfitrião (Fase 1):
//   start    { squadId, title, agenda?, participants?, proactivity? }  → abre a reunião com a pauta
//   say      { meetingId, text }                                       → fala do dono; os agentes escolhidos respondem
//   tick     { meetingId }                                             → batimento da tela: se a sala ficou parada, a diretora puxa a conversa
//   control  { meetingId, op, value? }                                 → set_proactivity | silence | unsilence | next_item | dismiss_proposal | raise_cap
//   end      { meetingId }                                             → gera a ata e encerra
// Cada mensagem passa pelo mesmo ciclo curto: chamados por @ respondem sempre; sem @, um avaliador barato decide quem (se alguém) entra,
// os freios em código limitam as falas espontâneas e cada agente ainda pode responder PASS. Nada é executado: os agentes só conversam.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { screenInput, maskSecrets, buildMemoryContext, budgetState, type MemoryItem } from "../_shared/squadCore.ts";
import { getTemplate } from "../_shared/squadTemplates.ts";
import { getOrderedKeysForUser, callWithFallback, estimateCost, logAiUsage } from "../_shared/llmProvider.ts";
import { HttpError } from "../_shared/squadRunner.ts";
import { emitChatEvent, loadMissionContext, type AgentRow } from "../_shared/squadChatRunner.ts";
import { searchPubmed, formatPubmedForPrompt, scrubUnknownPmids } from "../_shared/pubmedSearch.ts";
import { parseUpload } from "../_shared/fileParsers.ts";
import { pickDocExcerpts } from "../_shared/fileText.ts";
import { inferColumns, describeTable, buildPlanPrompt, parsePlan, runPlan, type Plan, type Table } from "../_shared/sheetAnalysis.ts";
import {
  CHAT_RATE_LIMIT_PER_MIN, TEAM_THREAD, buildChatSystemPrompt, capCrossing, chatBudget, cleanChatText,
  meetingModerator, parseMentions, pickMeetingParticipants, monthStartIso, type ChatAgent,
} from "../_shared/squadChatCore.ts";
import {
  MEETING_DEFAULT_CAP_USD, MEETING_HARD_MAX_AGENT_MESSAGES, MEETING_LIVE_RULES, MEETING_LOCK_SECONDS, MEETING_SPEAK_TOKENS, PROACTIVITY_LIMITS,
  applyBrakes, facilitatorDue, isOpenCall, pickByLeastRecent, buildEvaluatorPrompt, buildLiveUserMessage, buildMinutesDocPrompt, parseMinutesDoc, composeMinutesDoc, renderMinutesMarkdown, clampMeetingCap, isPass, isSilenced,
  nextItemMessage, normalizeProactivity, openingMessage, parseAgenda, parseEvaluatorReply, parseMeetingCommand,
  proposalMessage, shouldNudge, transcriptBlock, detectToolIntent, buildPubmedQueryPrompt, parsePubmedQuery, pickToolAgent, shouldUpdateMinutes,
  buildLiveMinutesPrompt, MINUTES_LIVE_MAX_CHARS, detectFileIntent, needsCalc, pickFilesForRequest, buildFileBlock, pickFileAgent, FILE_RULES, MEETING_MAX_FILES, type AgendaItem, type EvaluatorPick, type LiveLine, type Proactivity,
} from "../_shared/squadMeetingCore.ts";
import {
  MEETING_MAX_GUESTS, INVITE_TTL_MS, canDo, resolveRole, normalizeInviteRole, newInviteToken, hashInviteToken, looksLikeInviteToken,
  checkInvite, canAddGuest, guestDisplayName, guestSafeMessage, type MeetingRole,
} from "../_shared/squadMeetingAccess.ts";
import {
  MAX_ACTIONS_PER_MEETING, buildCalendarEvent, buildInviteEmail, buildRawEmail, canDecide, describeAction, detectActionIntent, emailFooter, extractActionProposals,
  hasScope, neededScope, validateCandidate, type ActionPayload, type Extracted,
} from "../_shared/squadMeetingActions.ts";
import { getValidAccessToken, GoogleNotConnectedError, GoogleReauthRequiredError } from "../_shared/googleOAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const APP_URL = Deno.env.get("APP_URL") || "https://agentes-ai.posologia.app";
const FUNCTION_DEADLINE_MS = 80_000;
const MEETING_TOOL_SPEAK_TOKENS = 900;
const EVALUATOR_DEADLINE_MS = 12_000;
// Avaliador barato: onde o provedor tem um modelo pequeno conhecido, usa-o; nos demais vale o modelo padrão.
const EVALUATOR_MODELS: Record<string, string> = { openai: "gpt-4o-mini", anthropic: "claude-3-5-haiku-20241022" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

interface MeetingRow {
  id: string; squad_id: string; owner_id: string; title: string; agenda: AgendaItem[]; current_item: number;
  proactivity: Proactivity; participants: string[]; status: "open" | "ended"; cap_usd: number | string;
  silenced_until: string | null; lock_until: string | null; minutes: string | null; created_at: string;
  minutes_live: string | null; minutes_live_at: string | null; minutes_live_version: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: { user: authUser } } = await userClient.auth.getUser();
    if (!authUser) return json({ error: "Não autenticado" }, 401);
    // `authUser` é quem fez o pedido. `user` é de quem é o contexto (chaves de API, custo, dono das linhas): igual a `authUser` para o
    // anfitrião e trocado pelo anfitrião quando um convidado faz uma ação permitida (ver o controle de papel mais abaixo).
    let user = authUser;

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    // ---------- carregamento comum ----------
    const loadSquad = async (squadId: string) => {
      const { data: squad } = await admin.from("squads").select("*").eq("id", squadId).maybeSingle();
      if (!squad || squad.owner_id !== user.id) throw new HttpError(404, "Squad não encontrado");
      const template = getTemplate(squad.template_slug);
      if (!template) throw new HttpError(400, "Template do squad não existe mais");
      return { squad, template };
    };
    /** Carrega a reunião e o papel de quem pede. Quem não é anfitrião nem membro recebe o mesmo 404 de uma reunião que não existe. */
    const loadMeetingWithRole = async (meetingId: string): Promise<{ meeting: MeetingRow; role: MeetingRole }> => {
      if (!/^[0-9a-f-]{36}$/i.test(meetingId)) throw new HttpError(404, "Reunião não encontrada");
      const { data } = await admin.from("squad_meetings").select("*").eq("id", meetingId).maybeSingle();
      if (!data) throw new HttpError(404, "Reunião não encontrada");
      const { data: members } = await admin.from("squad_meeting_members").select("user_id, role").eq("meeting_id", meetingId);
      const role = resolveRole(authUser.id, data.owner_id, (members || []) as { user_id: string; role: string }[]);
      return { meeting: data as MeetingRow, role };
    };
    /** Nome mostrado na conversa: o perfil, depois os metadados da conta; nunca o e-mail. */
    const displayNameOf = async (): Promise<string> => {
      const { data: prof } = await admin.from("profiles").select("display_name").eq("user_id", authUser.id).maybeSingle();
      const md = (authUser.user_metadata || {}) as Record<string, unknown>;
      return guestDisplayName(prof?.display_name, md.full_name, md.name);
    };
    const loadAgents = async (squadId: string): Promise<AgentRow[]> => {
      const { data } = await admin.from("squad_agents").select("id, slug, name, role, room, system_prompt, sort_order").eq("squad_id", squadId).order("sort_order");
      return (data || []) as AgentRow[];
    };
    const monthSpend = async (squadId: string): Promise<number> => {
      const { data, error } = await admin.rpc("squad_chat_month_spend", { p_squad: squadId, p_since: monthStartIso() });
      if (error) throw error;
      return Number(data || 0);
    };
    const meetingSpend = async (squadId: string, meetingId: string): Promise<number> => {
      const { data, error } = await admin.rpc("squad_meeting_spend", { p_squad: squadId, p_meeting: meetingId });
      if (error) throw error;
      return Number(data || 0);
    };
    const usageOf = (spent: number, cap: number) => ({ spentUsd: Math.round(spent * 1_000_000) / 1_000_000, capUsd: cap, ...chatBudget(spent, cap) });
    const requireOpen = (m: MeetingRow) => { if (m.status !== "open") throw new HttpError(409, "Esta reunião já foi encerrada"); };

    /** Só um ciclo por vez em cada reunião. Devolve false se outro ainda está rodando. */
    const acquireLock = async (meetingId: string): Promise<boolean> => {
      const nowIso = new Date().toISOString();
      const { data } = await admin.from("squad_meetings")
        .update({ lock_until: new Date(Date.now() + MEETING_LOCK_SECONDS * 1000).toISOString() })
        .eq("id", meetingId).eq("owner_id", user.id).or(`lock_until.is.null,lock_until.lt.${nowIso}`).select("id");
      return !!(data && data.length);
    };
    const releaseLock = async (meetingId: string) => { await admin.from("squad_meetings").update({ lock_until: null }).eq("id", meetingId); };

    const makeInsert = (squadId: string, meetingId: string, sink: any[]) => async (row: Record<string, unknown>) => {
      const meta = { ...((row.meta as Record<string, unknown>) || {}) } as Record<string, any>;
      meta.meeting = { id: meetingId, live: true, ...(meta.meeting || {}) };
      const { data, error } = await admin.from("squad_chat_messages").insert({ squad_id: squadId, owner_id: user.id, thread: TEAM_THREAD, ...row, meta }).select().single();
      if (error) throw error;
      sink.push(data);
      return data;
    };

    const checkBudgetAndKeys = async (squad: any) => {
      const cap = Number(squad.chat_monthly_cap_usd);
      const before = await monthSpend(squad.id);
      if (chatBudget(before, cap).state === "exceeded") {
        throw new HttpError(402, "O teto mensal da conversa deste squad foi atingido. Aumente o teto para continuar.", "chat_cap_reached");
      }
      const keys = await getOrderedKeysForUser(admin, user.id);
      if (!keys.length) throw new HttpError(400, "Nenhuma chave de API configurada. Adicione uma em Configurações para conversar com o time.");
      return { cap, before, keys };
    };

    const recentMessages = async (squadId: string, meetingId: string, limit = 40) => {
      const { data } = await admin.from("squad_chat_messages").select("id, author, agent_id, content, meta, created_at")
        .eq("squad_id", squadId).eq("thread", TEAM_THREAD).contains("meta", { meeting: { id: meetingId } })
        .order("created_at", { ascending: false }).limit(limit);
      return ((data || []) as any[]).reverse();
    };

    // ---------- o ciclo de turno ----------
    interface TurnCtx {
      squad: any; template: any; meeting: MeetingRow; agents: AgentRow[]; keys: any[];
      insert: (row: Record<string, unknown>) => Promise<any>;
    }
    /** Resultado de uma ferramenta (hoje, a busca no PubMed) entregue ao agente que vai responder. */
    interface ToolCtx { name: "pubmed" | "file"; query: string; block: string; pmids: string[]; sources: PubmedSource[]; error: string | null; calc?: Record<string, unknown>[]; fileCount?: number }
    interface PubmedSource { pmid: string; title: string; authors: string; journal: string; year: string; url: string }
    const runTurn = async (c: TurnCtx, opts: { quiet: boolean; mentions: string[]; userText?: string; tool?: ToolCtx }): Promise<{ cost: number; spoke: number }> => {
      const { squad, meeting, agents, keys, insert } = c;
      const meetingId = meeting.id;
      const cap = Number(meeting.cap_usd);
      const nameById = new Map(agents.map((a) => [a.id, a.name]));
      const recent = await recentMessages(squad.id, meetingId);
      const visible = recent.filter((m) => !m.meta?.meeting?.hidden);
      const lines: LiveLine[] = visible.map((m) => ({ author: m.author, agentName: m.agent_id ? nameById.get(m.agent_id) : undefined, userName: m.meta?.meeting?.author_name, content: m.content }));

      const spent = await meetingSpend(squad.id, meetingId);
      if (budgetState(spent, cap) === "exceeded") {
        const lastCap = visible.slice(-3).some((m) => m.meta?.cap);
        if (!lastCap) await insert({ author: "system", content: "Teto da reunião atingido. Aumente o teto na reunião para os agentes continuarem.", meta: { cap: "exceeded" } });
        return { cost: 0, spoke: 0 };
      }

      let cost = 0;
      let spoke = 0;
      const moderatorId = meetingModerator(agents, meeting.participants);
      const candidateIds = new Set([...meeting.participants, ...(moderatorId ? [moderatorId] : [])]);
      const candidates = agents.filter((a) => candidateIds.has(a.id));
      const silenced = isSilenced(meeting.silenced_until, Date.now());
      const agenda = meeting.agenda || [];
      const current = meeting.current_item;

      const forced = opts.mentions.length > 0;
      // "Alguém tem ideia?": o dono perguntou ao grupo, então alguém responde, mesmo no modo calmo.
      const openCall = !forced && !!opts.userText && isOpenCall(opts.userText);
      let picks: EvaluatorPick[] = [];
      if (forced) {
        picks = opts.mentions.map((id) => ({ id, why: "chamado por @" }));
      } else if (!silenced && (openCall || meeting.proactivity !== "calm")) {
        const lastAgentMsg = [...visible].reverse().find((m) => m.author === "agent");
        const lastAgentId: string | null = lastAgentMsg?.agent_id ?? null;
        const spontaneousLastMinute = visible.filter((m) => m.author === "agent" && m.meta?.meeting?.spontaneous && Date.now() - new Date(m.created_at).getTime() < 60_000).length;
        const { count: agentCount } = await admin.from("squad_chat_messages").select("id", { count: "exact", head: true })
          .eq("squad_id", squad.id).eq("author", "agent").contains("meta", { meeting: { id: meetingId } });
        const proposedRecently = visible.slice(-8).some((m) => m.meta?.meeting?.propose_next === current);
        const lim = PROACTIVITY_LIMITS[meeting.proactivity];
        const prompt = buildEvaluatorPrompt({
          agents: candidates, agenda, current, transcript: transcriptBlock(lines), maxSpeakers: openCall ? 2 : Math.max(1, lim.perTurn), quiet: opts.quiet,
          allowResolve: !opts.quiet && !proposedRecently && current < agenda.length, proactivity: meeting.proactivity, openCall,
        });
        const ev = await callWithFallback(admin, keys, {
          systemPrompt: prompt.system, messages: [{ role: "user", content: prompt.user }], temperature: 0, mode: "text", maxTokens: 220,
          modelOverridePerProvider: EVALUATOR_MODELS, deadlineAt: Date.now() + EVALUATOR_DEADLINE_MS,
        });
        let evCost = 0;
        let parsed = { speakers: [] as EvaluatorPick[], itemResolved: false, decision: "" };
        if (ev && ev.ok && ev.output) {
          evCost = estimateCost(ev.model!, ev.tokensInput, ev.tokensOutput);
          await logAiUsage(admin, { userId: user.id, provider: ev.provider!, model: ev.model!, tokensInput: ev.tokensInput, tokensOutput: ev.tokensOutput, promptType: "squad_meeting_evaluator" });
          parsed = parseEvaluatorReply(ev.output, candidates);
        }
        cost += evCost;
        // Mensagem oculta: guarda o custo do avaliador no teto e marca que a sala já foi checada (evita checar de novo a cada batimento).
        await insert({
          author: "system", content: "avaliação do turno", cost_usd: evCost,
          meta: { meeting: { hidden: true, kind: "evaluator", picked: parsed.speakers.length, ...(opts.quiet ? { nudge: true } : {}) } },
        });

        if (parsed.itemResolved && !opts.quiet && !proposedRecently && moderatorId && current < agenda.length) {
          await insert({
            author: "agent", agent_id: moderatorId, content: proposalMessage(current, agenda[current].title, parsed.decision),
            meta: { meeting: { propose_next: current, decision: parsed.decision } },
          });
        }

        if (openCall) {
          picks = parsed.speakers.filter((p) => p.id !== lastAgentId).slice(0, 2);
          if (!picks.length) {
            // O avaliador não escolheu ninguém, mas o dono perguntou ao grupo: quem falou há mais tempo responde.
            const spokeOrder = visible.filter((m) => m.author === "agent" && m.agent_id).map((m) => m.agent_id as string);
            const others = candidates.filter((a) => a.id !== moderatorId);
            picks = pickByLeastRecent(others.length ? others : candidates, spokeOrder, lastAgentId ? [lastAgentId] : [], 2);
          }
        } else {
          picks = applyBrakes(parsed.speakers, {
            proactivity: meeting.proactivity, lastAgentId, spontaneousLastMinute, agentMessageCount: agentCount || 0,
          });
          if (opts.quiet) picks = picks.slice(0, 1);
          // A diretora conduz quando já houve conversa demais desde a última fala dela.
          if (!opts.quiet && moderatorId && !picks.some((p) => p.id === moderatorId) && (agentCount || 0) < MEETING_HARD_MAX_AGENT_MESSAGES
            && facilitatorDue(visible.map((m) => ({ author: m.author, agentId: m.agent_id })), moderatorId, meeting.proactivity)) {
            picks.push({ id: moderatorId, why: "conduzir a pauta" });
          }
        }
      }
      if (!picks.length) return { cost, spoke };

      // Pedido de e-mail, agenda ou convite: o agente precisa de espaço para o texto do bloco [[ACAO]] (o corpo do e-mail não cabe em 90 palavras).
      const actionIntent = !!opts.userText && detectActionIntent(opts.userText);
      /** Valida e guarda as propostas de ação da fala de um agente. Nada é executado aqui: o dono aprova depois, num cartão. */
      const saveProposals = async (agent: AgentRow, ex: Extracted): Promise<number> => {
        if (!ex.proposals.length && !ex.incomplete && !ex.dropped) return 0;
        const { count } = await admin.from("squad_meeting_actions").select("id", { count: "exact", head: true }).eq("meeting_id", meetingId).neq("status", "discarded");
        let room = MAX_ACTIONS_PER_MEETING - (count || 0);
        const notes: string[] = [];
        let saved = 0;
        for (const pr of ex.proposals) {
          if (room <= 0) { notes.push(`limite de ${MAX_ACTIONS_PER_MEETING} ações por reunião`); break; }
          const v = validateCandidate(pr.fields, Date.now());
          if (!v.ok) { notes.push(v.reason); continue; }
          // Mesmos filtros das mensagens: dados pessoais conforme a sensibilidade do squad e, nos squads de código, segredos.
          const found = new Map<string, number>();
          const note = (fs: { type: string; count: number }[]) => fs.forEach((f) => found.set(f.type, (found.get(f.type) ?? 0) + f.count));
          const mask = (t: string): string => {
            let out = t;
            if (squad.sensitivity !== "normal" && /[d@]/.test(out)) { const r = screenInput(out, squad.sensitivity); out = r.text; note(r.findings); }
            if (template.maskSecrets && out.length >= 8) { const r = maskSecrets(out); out = r.text; note(r.findings); }
            return out;
          };
          const pl = v.payload;
          const payload: ActionPayload = pl.type === "email" ? { ...pl, subject: mask(pl.subject), body: mask(pl.body) }
            : pl.type === "evento" ? { ...pl, title: mask(pl.title), description: mask(pl.description) }
            : { ...pl, note: mask(pl.note) };
          const { error } = await admin.from("squad_meeting_actions").insert({
            meeting_id: meetingId, squad_id: squad.id, owner_id: user.id, agent_id: agent.id, type: payload.type, payload,
            masked: [...found.entries()].map(([type, n]) => ({ type, count: n })),
          });
          if (error) { notes.push("não consegui guardar a proposta"); continue; }
          saved++; room--;
        }
        if (ex.incomplete) notes.push("a proposta veio cortada");
        if (ex.dropped) notes.push(`só uma ação por fala é registrada (${ex.dropped} ignorada)`);
        if (notes.length) await insert({ author: "system", content: `${agent.name} propôs uma ação que não pôde ser registrada: ${notes.join("; ")}.`, meta: { meeting: { action_rejected: true } } });
        return saved;
      };

      const memRows = (await admin.from("squad_memories").select("id, kind, content, pinned, status, created_at")
        .eq("squad_id", squad.id).eq("owner_id", user.id).eq("status", "active")).data;
      const memoryContext = buildMemoryContext(squad.memory || "", (memRows || []) as MemoryItem[]);
      const contextFor = await loadMissionContext(admin, squad.id, user.id);
      const team = agents.map((a) => ({ name: a.name, role: a.role }));
      const deadlineAt = Date.now() + FUNCTION_DEADLINE_MS;

      // Todo agente da reunião enxerga os arquivos anexados (resumo curto), mesmo quando o pedido não foi dirigido a ele.
      // Sem isso, quem entra por conta própria ou é chamado pela diretora diz que "não consegue acessar planilhas".
      let filesOverview = "";
      {
        const { data: fRows } = await admin.from("squad_meeting_files")
          .select("name, kind, pages, table_data, content_text").eq("meeting_id", meetingId).order("created_at");
        if (fRows && fRows.length) {
          const parts: string[] = [];
          for (const f of fRows as any[]) {
            if (f.kind === "sheet" && f.table_data) {
              const table = f.table_data as Table;
              parts.push(describeTable(String(f.name), table, inferColumns(table), 6));
            } else {
              parts.push(`Documento "${f.name}"${f.pages ? ` (${f.pages} páginas)` : ""}:\n${String(f.content_text || "").slice(0, 2500)}`);
            }
          }
          filesOverview = `${FILE_RULES}\n\nArquivos anexados à reunião (o dono já os enviou; você PODE usá-los):\n\n${parts.join("\n\n---\n\n")}`.slice(0, 9000);
        }
      }

      type Mode = "mention" | "open" | "spontaneous";
      // Uma rodada de falas em paralelo. A conversa que cada agente vê inclui o que as rodadas anteriores acabaram de dizer.
      const speakRound = async (list: EvaluatorPick[], mode: Mode, facilitate: boolean, tool?: ToolCtx): Promise<{ agentId: string; content: string }[]> => {
        if (!list.length) return [];
        const transcript = transcriptBlock(lines);
        await Promise.all(list.map((p) => emitChatEvent(admin, {
          squadId: squad.id, ownerId: user.id, type: "chat_thinking", agentId: p.id, room: agents.find((a) => a.id === p.id)?.room ?? null, text: "Na reunião",
        })));
        const results = await Promise.all(list.map(async (p) => {
          const agent = agents.find((a) => a.id === p.id)!;
          const system = buildChatSystemPrompt({
            agentSystemPrompt: agent.system_prompt, agentName: agent.name, team, memoryContext, missionContext: contextFor(p.id), channel: "team",
          }) + "\n\n" + MEETING_LIVE_RULES;
          const userMessage = buildLiveUserMessage({
            agenda, current, transcript, why: p.why, mentioned: mode === "mention", quiet: opts.quiet && !facilitate, openCall: mode === "open", facilitate,
          }) + (tool ? `\n\n${tool.block}` : filesOverview ? `\n\n${filesOverview}` : "");
          const res = await callWithFallback(admin, keys, {
            systemPrompt: system, messages: [{ role: "user", content: userMessage }], temperature: 0.5, mode: "text",
            maxTokens: tool || actionIntent ? MEETING_TOOL_SPEAK_TOKENS : MEETING_SPEAK_TOKENS, deadlineAt: Math.min(deadlineAt, Date.now() + 45_000),
          });
          return { agent, pick: p, res };
        }));
        const said: { agentId: string; content: string }[] = [];
        for (const { agent, pick, res } of results) {
          if (!res || !res.ok || !res.output) {
            if (mode !== "spontaneous") await insert({ author: "system", agent_id: agent.id, content: `${agent.name} não conseguiu responder agora (provedor de IA indisponível).`, meta: { error: true } });
            await emitChatEvent(admin, { squadId: squad.id, ownerId: user.id, type: "chat_failed", agentId: agent.id, room: agent.room ?? null, text: "Sem resposta" });
            continue;
          }
          const c1 = estimateCost(res.model!, res.tokensInput, res.tokensOutput);
          cost += c1;
          await logAiUsage(admin, { userId: user.id, provider: res.provider!, model: res.model!, tokensInput: res.tokensInput, tokensOutput: res.tokensOutput, promptType: "squad_meeting_live" });
          if (mode === "spontaneous" && isPass(res.output)) {
            // O agente decidiu não falar: some da tela, mas o custo fica registrado.
            await insert({ author: "system", agent_id: agent.id, content: "passou a vez", cost_usd: c1, tokens_input: res.tokensInput, tokens_output: res.tokensOutput, meta: { meeting: { hidden: true, kind: "pass" } } });
            await emitChatEvent(admin, { squadId: squad.id, ownerId: user.id, type: "chat_replied", agentId: agent.id, room: agent.room ?? null, text: "Passou a vez" });
            continue;
          }
          // Blocos [[ACAO]] saem do texto da fala e viram propostas (cartões para o dono aprovar).
          const extracted = extractActionProposals(res.output.trim());
          let content = extracted.text + (res.finishReason === "length" ? " […]" : "");
          if (!extracted.text && (extracted.proposals.length || extracted.incomplete)) content = "Preparei uma ação para você aprovar (veja o cartão da reunião).";
          let removedPmids = 0;
          if (tool && tool.name === "pubmed") {
            // Citação só com o que a busca devolveu: PMID fora da lista é removido do texto.
            const s = scrubUnknownPmids(content, tool.pmids);
            content = s.text;
            removedPmids = s.removed;
          }
          await insert({
            author: "agent", agent_id: agent.id, content, cost_usd: c1,
            tokens_input: res.tokensInput, tokens_output: res.tokensOutput, provider: res.provider, model: res.model,
            meta: {
              meeting: {
                why: pick.why, spontaneous: mode === "spontaneous" && !facilitate, ...(facilitate ? { facilitator: true } : {}), ...(opts.quiet ? { nudge: true } : {}),
                ...(tool ? { tool: { name: tool.name, query: tool.query, count: tool.name === "file" ? (tool.fileCount ?? 0) : tool.sources.length, ...(tool.error ? { error: tool.error } : {}), ...(removedPmids ? { removed_pmids: removedPmids } : {}) } } : {}),
              },
              ...(tool?.name === "pubmed" ? { sources: tool.sources } : {}),
              ...(tool?.calc?.length ? { calc: tool.calc } : {}),
              ...(res.finishReason === "length" ? { truncated: true } : {}),
            },
          });
          await saveProposals(agent, extracted);
          said.push({ agentId: agent.id, content });
          lines.push({ author: "agent", agentName: agent.name, content });
          spoke++;
          await emitChatEvent(admin, { squadId: squad.id, ownerId: user.id, type: "chat_replied", agentId: agent.id, room: agent.room ?? null, text: "Falou na reunião" });
        }
        return said;
      };

      // Rodada 1: quem foi chamado (@), quem respondeu ao grupo ou quem entrou por conta própria. Rodada 2: a diretora conduz, vendo o que acabou de ser dito.
      const first = picks.filter((p) => p.id !== moderatorId || forced);
      const lead = picks.filter((p) => p.id === moderatorId && !forced);
      const said1 = await speakRound(first, forced ? "mention" : openCall ? "open" : "spontaneous", false, opts.tool);
      const said2 = await speakRound(lead, "spontaneous", true);

      // Se a diretora chamou um colega pelo nome (@Bia, ...), o colega responde logo em seguida (um salto só).
      const chain: EvaluatorPick[] = [];
      for (const s of [...said1, ...said2]) {
        if (s.agentId !== moderatorId) continue;
        for (const id of parseMentions(s.content, agents.filter((a) => a.id !== moderatorId) as ChatAgent[])) {
          if (!chain.some((x) => x.id === id)) chain.push({ id, why: "chamado pela coordenação" });
        }
      }
      if (chain.length && budgetState(spent + cost, cap) !== "exceeded") await speakRound(chain.slice(0, 2), "mention", false);

      // Aviso aos 80% do teto da reunião.
      const cross = capCrossing(spent, spent + cost, cap);
      if (cross) await insert({ author: "system", meta: { cap: cross }, content: cross === "exceeded" ? "Teto da reunião atingido. Aumente o teto na reunião para os agentes continuarem." : "A reunião passou de 80% do teto." });
      return { cost, spoke };
    };

    // ---------- ferramenta: busca no PubMed ----------
    /** Monta a busca (modelo barato), consulta o PubMed por código e devolve o bloco que o agente vai usar. O custo da montagem fica registrado. */
    const runPubmedTool = async (c: { squad: any; meeting: MeetingRow; keys: any[]; insert: (row: Record<string, unknown>) => Promise<any> }, request: string, transcript: string): Promise<{ tool: ToolCtx; cost: number }> => {
      const qp = buildPubmedQueryPrompt({ request, transcript });
      const res = await callWithFallback(admin, c.keys, {
        systemPrompt: qp.system, messages: [{ role: "user", content: qp.user }], temperature: 0, mode: "text", maxTokens: 120,
        modelOverridePerProvider: EVALUATOR_MODELS, deadlineAt: Date.now() + EVALUATOR_DEADLINE_MS,
      });
      let cost = 0;
      let query = parsePubmedQuery("", request);
      if (res && res.ok && res.output) {
        cost = estimateCost(res.model!, res.tokensInput, res.tokensOutput);
        await logAiUsage(admin, { userId: user.id, provider: res.provider!, model: res.model!, tokensInput: res.tokensInput, tokensOutput: res.tokensOutput, promptType: "squad_meeting_pubmed_query" });
        query = parsePubmedQuery(res.output, request);
      }
      await c.insert({ author: "system", content: "montagem da busca", cost_usd: cost, meta: { meeting: { hidden: true, kind: "pubmed_query" } } });
      const found = await searchPubmed(query);
      const sources: PubmedSource[] = found.articles.map((a) => ({ pmid: a.pmid, title: a.title, authors: a.authors, journal: a.journal, year: a.year, url: a.url }));
      return {
        cost,
        tool: { name: "pubmed", query: found.query || query, block: formatPubmedForPrompt(found), pmids: found.articles.map((a) => a.pmid), sources, error: found.error },
      };
    };

    // ---------- ata ao vivo ----------
    /** Incorpora à ata a conversa nova (a cada 3 mensagens ou mais). Se você editou a ata no meio do caminho, descarta e refaz na próxima. */
    const updateLiveMinutes = async (squad: any, meetingId: string, keys: any[]): Promise<void> => {
      const { data: fresh } = await admin.from("squad_meetings").select("*").eq("id", meetingId).maybeSingle();
      if (!fresh || fresh.status !== "open") return;
      const m = fresh as MeetingRow;
      let q = admin.from("squad_chat_messages").select("author, agent_id, content, meta, created_at")
        .eq("squad_id", squad.id).eq("thread", TEAM_THREAD).contains("meta", { meeting: { id: meetingId } }).order("created_at");
      if (m.minutes_live_at) q = q.gt("created_at", m.minutes_live_at);
      const { data } = await q.limit(60);
      const msgs = ((data || []) as any[]).filter((x) => !x.meta?.meeting?.hidden && !x.meta?.meeting?.opening && (x.author === "user" || x.author === "agent"));
      if (!shouldUpdateMinutes({ newMessages: msgs.length, lastUpdateAt: null, now: Date.now() })) return;
      const agents = await loadAgents(squad.id);
      const nameById = new Map(agents.map((a) => [a.id, a.name]));
      const newTranscript = transcriptBlock(msgs.map((x) => ({ author: x.author, agentName: x.agent_id ? nameById.get(x.agent_id) : undefined, userName: x.meta?.meeting?.author_name, content: x.content })), 60, 900);
      const prompt = buildLiveMinutesPrompt({ title: m.title, agenda: m.agenda || [], current: m.current_item, minutes: m.minutes_live || "", newTranscript });
      const res = await callWithFallback(admin, keys, {
        systemPrompt: prompt.system, messages: [{ role: "user", content: prompt.user }], temperature: 0.2, mode: "text", maxTokens: 1100,
        modelOverridePerProvider: EVALUATOR_MODELS, deadlineAt: Date.now() + 30_000,
      });
      if (!res || !res.ok || !res.output) return;
      const cost = estimateCost(res.model!, res.tokensInput, res.tokensOutput);
      await logAiUsage(admin, { userId: user.id, provider: res.provider!, model: res.model!, tokensInput: res.tokensInput, tokensOutput: res.tokensOutput, promptType: "squad_meeting_live_minutes" });
      const text = res.output.trim().slice(0, MINUTES_LIVE_MAX_CHARS);
      // O custo conta no teto mesmo que a atualização seja descartada.
      await makeInsert(squad.id, meetingId, [])({ author: "system", content: "atualização da ata", cost_usd: cost, meta: { meeting: { hidden: true, kind: "minutes" } } });
      await admin.from("squad_meetings").update({
        minutes_live: text, minutes_live_at: msgs[msgs.length - 1].created_at, minutes_live_version: (m.minutes_live_version || 0) + 1,
      }).eq("id", meetingId).eq("minutes_live_version", m.minutes_live_version || 0);
    };
    /** Roda a atualização da ata em segundo plano e só então solta a trava da reunião (a resposta ao navegador não espera por isso). */
    const finishInBackground = (meetingId: string, work: Promise<void>) => {
      const bg = work.catch((e) => console.warn("[squad-meeting] ata ao vivo falhou:", (e as Error).message)).finally(() => releaseLock(meetingId));
      const rt = (globalThis as any).EdgeRuntime;
      if (rt?.waitUntil) { rt.waitUntil(bg); return Promise.resolve(); }
      return bg;
    };

    // ---------- start ----------
    if (action === "start") {
      const { squad } = await loadSquad(String(body?.squadId || ""));
      const title = cleanChatText(body?.title).replace(/\s+/g, " ").slice(0, 160);
      if (title.length < 3) throw new HttpError(400, "Dê um tema à reunião");
      const agents = await loadAgents(squad.id);
      await checkBudgetAndKeys(squad);
      const participants = pickMeetingParticipants(body?.participants, agents);
      if (!participants.length) throw new HttpError(400, "Escolha ao menos um agente para a reunião");
      const agenda = parseAgenda(body?.agenda, title);
      const proactivity = normalizeProactivity(body?.proactivity);
      const { data: open } = await admin.from("squad_meetings").select("id").eq("squad_id", squad.id).eq("status", "open").limit(1);
      if (open && open.length) throw new HttpError(409, "Já existe uma reunião aberta neste squad. Encerre-a antes de abrir outra.");

      const { data: row, error } = await admin.from("squad_meetings").insert({
        squad_id: squad.id, owner_id: user.id, title, agenda, proactivity, participants, cap_usd: clampMeetingCap(body?.capUsd ?? MEETING_DEFAULT_CAP_USD),
      }).select().single();
      if (error) throw error;
      const sink: any[] = [];
      const insert = makeInsert(squad.id, row.id, sink);
      const moderatorId = meetingModerator(agents, participants);
      await insert({ author: "agent", agent_id: moderatorId, content: openingMessage(title, agenda), meta: { meeting: { opening: true } } });
      await emitChatEvent(admin, { squadId: squad.id, ownerId: user.id, type: "meeting_started", text: "Reunião aberta" });
      return json({ meeting: row, messages: sink });
    }

    // ---------- join (convidado entra pelo link; basta ter conta) ----------
    if (action === "join") {
      const token = body?.token;
      if (!looksLikeInviteToken(token)) throw new HttpError(404, "Este convite não é válido ou expirou.", "invite_invalid");
      const { data: inv } = await admin.from("squad_meeting_invites").select("meeting_id, role, revoked_at, expires_at, created_by")
        .eq("token_hash", await hashInviteToken(token)).maybeSingle();
      const { data: mt } = inv ? await admin.from("squad_meetings").select("*").eq("id", inv.meeting_id).maybeSingle() : { data: null };
      const check = checkInvite(inv, mt, Date.now());
      if (!check.ok) throw new HttpError(check.status, check.message, check.code);
      const m = mt as MeetingRow;
      // O anfitrião abrindo o próprio link só volta para a reunião.
      if (m.owner_id === authUser.id) return json({ meetingId: m.id, role: "host", title: m.title });

      const { data: members } = await admin.from("squad_meeting_members").select("user_id, role").eq("meeting_id", m.id);
      const existing = (members || []).find((x: any) => x.user_id === authUser.id);
      if (!canAddGuest((members || []).length, !!existing)) throw new HttpError(409, `Esta reunião já tem ${MEETING_MAX_GUESTS} convidados.`, "meeting_full");
      if (existing) return json({ meetingId: m.id, role: existing.role, title: m.title });

      const name = await displayNameOf();
      const { error: insErr } = await admin.from("squad_meeting_members").insert({ meeting_id: m.id, user_id: authUser.id, role: check.role, display_name: name });
      if (insErr) throw insErr;
      user = { ...authUser, id: m.owner_id };
      const sink: any[] = [];
      await makeInsert(m.squad_id, m.id, sink)({ author: "system", content: `${name} entrou na reunião como ${check.role === "participant" ? "participante" : "observador"}.` });
      return json({ meetingId: m.id, role: check.role, title: m.title });
    }

    // Daqui em diante a ação é sobre uma reunião existente, e o papel de quem pede decide se pode.
    const { meeting, role } = await loadMeetingWithRole(String(body?.meetingId || ""));
    if (!canDo(role, action)) {
      if (role === "none") throw new HttpError(404, "Reunião não encontrada");
      throw new HttpError(403, "Você não tem permissão para isso nesta reunião.", "forbidden");
    }
    const isGuest = role !== "host";
    // Convidado: as chaves, o custo e a autoria das linhas são do anfitrião. Só ações da lista de permissão chegam até aqui.
    if (isGuest) user = { ...authUser, id: meeting.owner_id };
    const { squad, template } = await loadSquad(meeting.squad_id);

    // ---------- ver a reunião (única leitura do convidado: só campos seguros) ----------
    if (action === "view") {
      const agents = await loadAgents(squad.id);
      const recent = (await recentMessages(squad.id, meeting.id, 200)).filter((m) => !m.meta?.meeting?.hidden);
      const { data: files } = await admin.from("squad_meeting_files").select("id, name, kind, rows, cols, pages, truncated, created_at").eq("meeting_id", meeting.id).order("created_at");
      const { data: members } = await admin.from("squad_meeting_members").select("display_name, role").eq("meeting_id", meeting.id).order("joined_at");
      const { data: hostProf } = await admin.from("profiles").select("display_name").eq("user_id", meeting.owner_id).maybeSingle();
      return json({
        role,
        meeting: {
          id: meeting.id, title: meeting.title, agenda: meeting.agenda, current_item: meeting.current_item, proactivity: meeting.proactivity,
          status: meeting.status, silenced_until: meeting.silenced_until, minutes_live: meeting.minutes_live, minutes_live_version: meeting.minutes_live_version,
          created_at: meeting.created_at,
        },
        agents: agents.map((a) => ({ id: a.id, name: a.name, role: a.role })),
        messages: recent.map((m) => guestSafeMessage(m, authUser.id)),
        files: files || [],
        people: [{ name: guestDisplayName(hostProf?.display_name, "Anfitrião"), role: "host" }, ...((members || []) as any[]).map((x) => ({ name: x.display_name, role: x.role }))],
      });
    }

    // ---------- convites e membros (só o anfitrião) ----------
    if (action === "create_invite") {
      requireOpen(meeting);
      const { count } = await admin.from("squad_meeting_invites").select("id", { count: "exact", head: true })
        .eq("meeting_id", meeting.id).is("revoked_at", null).gt("expires_at", new Date().toISOString());
      if ((count || 0) >= 10) throw new HttpError(409, "Já existem 10 convites ativos. Revogue algum para criar outro.");
      const token = newInviteToken();
      const role = normalizeInviteRole(body?.role);
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
      const { data: row, error } = await admin.from("squad_meeting_invites").insert({
        meeting_id: meeting.id, token_hash: await hashInviteToken(token), role, created_by: authUser.id, expires_at: expiresAt,
      }).select("id").single();
      if (error) throw error;
      return json({ invite: { id: row.id, token, role, expires_at: expiresAt } });
    }
    if (action === "revoke_invite") {
      const { data: gone } = await admin.from("squad_meeting_invites").update({ revoked_at: new Date().toISOString() })
        .eq("id", String(body?.inviteId || "")).eq("meeting_id", meeting.id).select("id");
      if (!gone || !gone.length) throw new HttpError(404, "Convite não encontrado");
      return json({ ok: true });
    }
    if (action === "list_members") {
      const { data: members } = await admin.from("squad_meeting_members").select("user_id, display_name, role, joined_at").eq("meeting_id", meeting.id).order("joined_at");
      const { data: invites } = await admin.from("squad_meeting_invites").select("id, role, expires_at, created_at")
        .eq("meeting_id", meeting.id).is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false });
      return json({ members: members || [], invites: invites || [] });
    }
    if (action === "remove_member") {
      const { data: gone } = await admin.from("squad_meeting_members").delete().eq("meeting_id", meeting.id).eq("user_id", String(body?.userId || "")).select("display_name");
      if (!gone || !gone.length) throw new HttpError(404, "Convidado não encontrado");
      const sink: any[] = [];
      await makeInsert(squad.id, meeting.id, sink)({ author: "system", content: `${gone[0].display_name} saiu da reunião.` });
      return json({ messages: sink });
    }
    if (action === "leave") {
      const { data: gone } = await admin.from("squad_meeting_members").delete().eq("meeting_id", meeting.id).eq("user_id", authUser.id).select("display_name");
      if (gone && gone.length) await makeInsert(squad.id, meeting.id, [])({ author: "system", content: `${gone[0].display_name} saiu da reunião.` });
      return json({ ok: true });
    }

    // ---------- ações propostas pelos agentes (só o anfitrião decide) ----------
    if (action === "discard_action") {
      const { data: gone } = await admin.from("squad_meeting_actions").update({ status: "discarded", decided_at: new Date().toISOString() })
        .eq("id", String(body?.actionId || "")).eq("meeting_id", meeting.id).in("status", ["proposed", "failed"]).select("id");
      if (!gone || !gone.length) throw new HttpError(409, "Esta ação não pode mais ser descartada.");
      return json({ ok: true });
    }
    if (action === "approve_action") {
      requireOpen(meeting);
      const { data: row } = await admin.from("squad_meeting_actions").select("*").eq("id", String(body?.actionId || "")).eq("meeting_id", meeting.id).maybeSingle();
      if (!row) throw new HttpError(404, "Ação não encontrada");
      if (!canDecide(row.status)) throw new HttpError(409, "Esta ação já foi decidida.", "action_decided");

      // Edições do anfitrião: só os campos conhecidos, e o tipo nunca muda. Tudo passa pela mesma validação das propostas.
      const EDITABLE = ["to", "subject", "body", "title", "start", "durationMin", "attendees", "description", "role", "note"];
      const edits = body?.edits && typeof body.edits === "object" ? body.edits as Record<string, unknown> : {};
      const candidate: Record<string, unknown> = { ...(row.payload as Record<string, unknown>), type: row.type };
      for (const k of EDITABLE) if (k in edits) candidate[k] = edits[k];
      const v = validateCandidate(candidate, Date.now());
      if (!v.ok) throw new HttpError(400, `Não dá para executar: ${v.reason}.`, "action_invalid");
      const payload = v.payload;

      // Conta Google conectada e com a permissão certa; o token é obtido antes de reservar a ação (sem efeito colateral se falhar).
      const { data: conn } = await admin.from("google_connections").select("scopes, status").eq("user_id", user.id).maybeSingle();
      if (!conn) throw new HttpError(409, "Conecte sua conta Google para executar esta ação.", "google_not_connected");
      if (!hasScope(conn.scopes, neededScope(payload.type))) throw new HttpError(409, "Falta a permissão do Google para esta ação. Reconecte sua conta.", "google_scopes_missing");
      let accessToken: string;
      try {
        accessToken = await getValidAccessToken(admin, user.id);
      } catch (e) {
        if (e instanceof GoogleNotConnectedError) throw new HttpError(409, "Conecte sua conta Google para executar esta ação.", "google_not_connected");
        if (e instanceof GoogleReauthRequiredError) throw new HttpError(409, "O acesso ao Google expirou. Reconecte sua conta.", "google_reauth");
        throw e;
      }

      // Reserva atômica: só uma chamada passa de proposed/failed para executing (duplo clique ou duas abas não enviam duas vezes).
      const { data: claimed } = await admin.from("squad_meeting_actions")
        .update({ status: "executing", payload, decided_at: new Date().toISOString(), error: null })
        .eq("id", row.id).in("status", ["proposed", "failed"]).select("id");
      if (!claimed || !claimed.length) throw new HttpError(409, "Esta ação já foi decidida.", "action_decided");

      const hostName = await displayNameOf();
      const gfetch = async (url: string, payloadBody: unknown): Promise<{ ok: boolean; status: number; data: any }> => {
        const r = await fetch(url, {
          method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(payloadBody), signal: AbortSignal.timeout(20_000),
        });
        const data = await r.json().catch(() => ({}));
        return { ok: r.ok, status: r.status, data };
      };
      const sendMail = async (to: string[], subject: string, text: string) => gfetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { raw: buildRawEmail({ to, subject, body: text }) });
      const googleError = (who: string, r: { status: number; data: any }) => who + " recusou (" + r.status + "): " + String(r.data?.error?.message || "erro desconhecido").slice(0, 200);

      let result: Record<string, unknown> | null = null;
      let errorText = "";
      try {
        if (payload.type === "email") {
          const r = await sendMail(payload.to, payload.subject, payload.body + emailFooter(hostName, meeting.title));
          if (r.ok) result = { id: r.data?.id ?? null }; else errorText = googleError("O Gmail", r);
        } else if (payload.type === "evento") {
          const r = await gfetch("https://www.googleapis.com/calendar/v3/calendars/primary/events" + (payload.attendees.length ? "?sendUpdates=all" : ""), buildCalendarEvent(payload, hostName, meeting.title));
          if (r.ok) result = { id: r.data?.id ?? null, link: r.data?.htmlLink ?? null }; else errorText = googleError("A Agenda", r);
        } else {
          const { count: activeInvites } = await admin.from("squad_meeting_invites").select("id", { count: "exact", head: true })
            .eq("meeting_id", meeting.id).is("revoked_at", null).gt("expires_at", new Date().toISOString());
          if ((activeInvites || 0) >= 10) errorText = "Já existem 10 convites ativos. Revogue algum e tente de novo.";
          else {
            const token = newInviteToken();
            const { data: inv, error: invErr } = await admin.from("squad_meeting_invites").insert({
              meeting_id: meeting.id, token_hash: await hashInviteToken(token), role: payload.role, created_by: authUser.id, expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
            }).select("id").single();
            if (invErr) throw invErr;
            const mail = buildInviteEmail({ hostName, meetingTitle: meeting.title, url: APP_URL + "/reuniao-viva/convite/" + token, role: payload.role, note: payload.note });
            const r = await sendMail(payload.to, mail.subject, mail.body);
            if (r.ok) result = { id: r.data?.id ?? null, invite_id: inv.id };
            else {
              await admin.from("squad_meeting_invites").update({ revoked_at: new Date().toISOString() }).eq("id", inv.id); // o link não chegou a ninguém
              errorText = googleError("O Gmail", r);
            }
          }
        }
      } catch (e) {
        // Sem resposta do Google: pode ter saído mesmo assim. Não dá para saber, então o cartão manda conferir antes de tentar de novo.
        console.warn("[squad-meeting] ação sem confirmação:", (e as Error).message);
        errorText = "Não consegui confirmar a resposta do Google. Confira a pasta Enviados ou a Agenda antes de tentar de novo.";
      }

      const sink: any[] = [];
      if (result) {
        await admin.from("squad_meeting_actions").update({ status: "done", result, executed_at: new Date().toISOString(), error: null }).eq("id", row.id);
        await makeInsert(squad.id, meeting.id, sink)({ author: "system", content: "Feito por aprovação do anfitrião: " + describeAction(payload) + ".", meta: { meeting: { action_done: row.id } } });
        return json({ ok: true, result, messages: sink });
      }
      await admin.from("squad_meeting_actions").update({ status: "failed", error: errorText }).eq("id", row.id);
      throw new HttpError(502, errorText, "action_failed");
    }

    // ---------- control (sem chamada ao modelo) ----------
    if (action === "control") {
      requireOpen(meeting);
      const agents = await loadAgents(squad.id);
      const sink: any[] = [];
      const insert = makeInsert(squad.id, meeting.id, sink);
      const moderatorId = meetingModerator(agents, meeting.participants);
      const op = String(body?.op || "");
      const patch: Record<string, unknown> = {};

      if (op === "set_proactivity") patch.proactivity = normalizeProactivity(body?.value);
      else if (op === "silence") {
        const minutes = Math.min(60, Math.max(1, Math.round(Number(body?.value) || 10)));
        patch.silenced_until = new Date(Date.now() + minutes * 60_000).toISOString();
        await insert({ author: "system", content: `Silêncio por ${minutes} minutos. Os agentes só respondem se forem chamados com @nome.` });
      } else if (op === "unsilence") {
        patch.silenced_until = null;
        await insert({ author: "system", content: "Silêncio encerrado. Os agentes voltam a participar." });
      } else if (op === "raise_cap") patch.cap_usd = clampMeetingCap(body?.value);
      else if (op === "edit_minutes") {
        patch.minutes_live = String(body?.value ?? "").slice(0, MINUTES_LIVE_MAX_CHARS);
        patch.minutes_live_version = (meeting.minutes_live_version || 0) + 1;
      } else if (op === "dismiss_proposal") {
        await insert({ author: "system", content: "proposta recusada", meta: { meeting: { hidden: true, dismissed: meeting.current_item } } });
      } else if (op === "next_item") {
        const agenda = (meeting.agenda || []).map((i) => ({ ...i }));
        const cur = meeting.current_item;
        if (cur >= agenda.length) throw new HttpError(409, "A pauta já foi concluída");
        // A decisão vem da última proposta da diretora para este item (se houve).
        const recent = await recentMessages(squad.id, meeting.id);
        const proposal = [...recent].reverse().find((m) => m.meta?.meeting?.propose_next === cur);
        agenda[cur].done = true;
        if (proposal?.meta?.meeting?.decision) agenda[cur].decision = String(proposal.meta.meeting.decision);
        const next = cur + 1;
        const { data: upd } = await admin.from("squad_meetings").update({ agenda, current_item: next }).eq("id", meeting.id).eq("current_item", cur).select("id");
        if (!upd || !upd.length) throw new HttpError(409, "A pauta já avançou");
        const msg = nextItemMessage(agenda, next);
        await insert({ author: "agent", agent_id: moderatorId, content: msg.text, meta: { meeting: { item: next, ...(msg.readyToEnd ? { ready_to_end: true } : {}) } } });
        // Item novo: alguém da equipe já abre a conversa (a reunião não fica parada esperando você).
        if (!msg.readyToEnd && !isSilenced(meeting.silenced_until, Date.now()) && (await acquireLock(meeting.id))) {
          try {
            const { keys } = await checkBudgetAndKeys(squad);
            await runTurn(
              { squad, template, meeting: { ...meeting, agenda, current_item: next }, agents, keys, insert },
              { quiet: false, mentions: [], userText: `Vamos ao item ${next + 1}: ${agenda[next].title}. Alguém começa?` },
            );
          } catch (e) {
            console.warn("[squad-meeting] abertura do item falhou:", (e as Error).message);
          } finally {
            await releaseLock(meeting.id);
          }
        }
        return json({ messages: sink });
      } else throw new HttpError(400, "Comando desconhecido");

      if (Object.keys(patch).length) {
        const { error } = await admin.from("squad_meetings").update(patch).eq("id", meeting.id);
        if (error) throw error;
      }
      return json({ messages: sink });
    }

    // ---------- arquivos da reunião ----------
    if (action === "upload_file") {
      requireOpen(meeting);
      const fileName = String(body?.fileName || "arquivo").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").trim().slice(0, 120) || "arquivo";
      const rawB64 = String(body?.base64 || "");
      if (!rawB64) throw new HttpError(400, "Nenhum arquivo recebido");
      if (rawB64.length > 5_800_000) throw new HttpError(413, "O arquivo passa de 4 MB. Envie uma versão menor.");
      if (squad.sensitivity === "dados_saude" && body?.confirmedAnonymous !== true) {
        throw new HttpError(400, "Confirme que o arquivo não tem dados identificáveis de pacientes.", "needs_anonymous_confirmation");
      }
      const { count: fileCount } = await admin.from("squad_meeting_files").select("id", { count: "exact", head: true }).eq("meeting_id", meeting.id);
      if ((fileCount || 0) >= MEETING_MAX_FILES) throw new HttpError(409, `Limite de ${MEETING_MAX_FILES} arquivos por reunião. Remova um para anexar outro.`);

      let bytes: Uint8Array;
      try {
        const bin = atob(rawB64.includes(",") ? rawB64.split(",")[1] : rawB64);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      } catch {
        throw new HttpError(400, "Não consegui ler o arquivo enviado.");
      }
      let parsed;
      try {
        parsed = await parseUpload(fileName, bytes);
      } catch (e) {
        throw new HttpError(400, (e as Error).message || "Não consegui ler esse arquivo.");
      }

      // Mesmos filtros das mensagens: dados pessoais conforme a sensibilidade do squad e, nos squads de código, segredos.
      const found = new Map<string, number>();
      const note = (fs: { type: string; count: number }[]) => fs.forEach((f) => found.set(f.type, (found.get(f.type) ?? 0) + f.count));
      const maskText = (s: string): string => {
        let t = s;
        if (squad.sensitivity !== "normal" && /[\d@]/.test(t)) { const r = screenInput(t, squad.sensitivity); t = r.text; note(r.findings); }
        if (template.maskSecrets && t.length >= 8) { const r = maskSecrets(t); t = r.text; note(r.findings); }
        return t;
      };

      const row: Record<string, unknown> = {
        meeting_id: meeting.id, squad_id: squad.id, owner_id: user.id, name: fileName, kind: parsed.kind, size_bytes: bytes.length,
      };
      let summary = "";
      if (parsed.kind === "sheet") {
        const table = {
          headers: parsed.table.headers.map((h) => maskText(h)),
          rows: parsed.table.rows.map((r) => r.map((c) => (typeof c === "string" ? maskText(c) : c))),
        };
        const cols = inferColumns(table);
        row.table_data = table; row.sheet_name = parsed.sheetName; row.rows = table.rows.length; row.cols = table.headers.length;
        summary = `Arquivo anexado: ${fileName}. Li ${table.rows.length} linhas e ${table.headers.length} colunas${parsed.sheetCount > 1 ? ` (planilha "${parsed.sheetName}", a maior de ${parsed.sheetCount})` : ""}. ` +
          `Colunas: ${cols.map((c) => `${c.name} (${c.type === "number" ? "número" : c.type === "date" ? "data" : "texto"})`).join(", ")}.`;
      } else {
        row.content_text = maskText(parsed.text); row.pages = parsed.pages; row.truncated = parsed.truncated;
        summary = `Arquivo anexado: ${fileName}. Li ${parsed.text.length.toLocaleString("pt-BR")} caracteres${parsed.pages ? ` de ${parsed.pages} páginas` : ""}${parsed.truncated ? " (só o começo foi guardado, o arquivo é maior que o limite)" : ""}.`;
      }
      row.masked = [...found.entries()].map(([type, count]) => ({ type, count }));
      const { data: saved, error: saveErr } = await admin.from("squad_meeting_files").insert(row).select("id, name, kind, rows, cols, pages, size_bytes, truncated, masked, created_at").single();
      if (saveErr) throw saveErr;
      const sink: any[] = [];
      const insert = makeInsert(squad.id, meeting.id, sink);
      const maskedTotal = [...found.values()].reduce((a, b) => a + b, 0);
      await insert({
        author: "system", content: summary + (maskedTotal ? ` ${maskedTotal} dado(s) pessoal(is) ou segredo(s) foram mascarados na leitura.` : ""),
        meta: { meeting: { file: { id: saved.id, name: saved.name, kind: saved.kind } }, ...(maskedTotal ? { masked_files: row.masked } : {}) },
      });
      return json({ file: saved, messages: sink });
    }

    if (action === "delete_file") {
      requireOpen(meeting);
      const { data: gone } = await admin.from("squad_meeting_files").delete().eq("id", String(body?.fileId || "")).eq("meeting_id", meeting.id).eq("owner_id", user.id).select("name");
      if (!gone || !gone.length) throw new HttpError(404, "Arquivo não encontrado");
      const sink: any[] = [];
      await makeInsert(squad.id, meeting.id, sink)({ author: "system", content: `Arquivo removido da reunião: ${gone[0].name}.` });
      return json({ messages: sink });
    }

    // ---------- tick ----------
    if (action === "tick") {
      if (meeting.status !== "open") return json({ idle: true });
      const recent = await recentMessages(squad.id, meeting.id, 20);
      if (!recent.length) return json({ idle: true });
      // A conta de "puxadas" recomeça quando você fala ou quando a pauta muda de item.
      const lastResetIdx = (() => { for (let i = recent.length - 1; i >= 0; i--) if (recent[i].author === "user" || recent[i].meta?.meeting?.item !== undefined || recent[i].meta?.meeting?.opening) return i; return -1; })();
      const nudgesSinceUser = recent.slice(lastResetIdx + 1).filter((m) => m.meta?.meeting?.nudge).length;
      const lastAt = new Date(recent[recent.length - 1].created_at).getTime();
      if (!shouldNudge({ lastMessageAt: lastAt, now: Date.now(), nudgesSinceUser, silenced: isSilenced(meeting.silenced_until, Date.now()), proactivity: meeting.proactivity })) return json({ idle: true });
      if (meeting.current_item >= (meeting.agenda || []).length) return json({ idle: true });
      if (!(await acquireLock(meeting.id))) return json({ idle: true, busy: true });
      const sink: any[] = [];
      let handoff = false;
      try {
        const { cap, before, keys } = await checkBudgetAndKeys(squad);
        const agents = await loadAgents(squad.id);
        const insert = makeInsert(squad.id, meeting.id, sink);
        const run = await runTurn({ squad, template, meeting, agents, keys, insert }, { quiet: true, mentions: [] });
        // Mesmo que ninguém tenha falado, o avaliador deixou uma marca oculta e a sala não é checada de novo até o dono falar.
        if (!sink.some((m) => m.meta?.meeting?.nudge)) {
          await insert({ author: "system", content: "sala checada", meta: { meeting: { hidden: true, kind: "quiet_check", nudge: true } } });
        }
        const out = json({ messages: sink, spoke: run.spoke, usage: usageOf(before + run.cost, cap) });
        handoff = true;
        await finishInBackground(meeting.id, updateLiveMinutes(squad, meeting.id, keys));
        return out;
      } catch (e) {
        if (e instanceof HttpError) return json({ idle: true, error: e.message });
        throw e;
      } finally {
        if (!handoff) await releaseLock(meeting.id);
      }
    }

    // ---------- say ----------
    if (action === "say") {
      requireOpen(meeting);
      const text = cleanChatText(body?.text);
      if (!text) throw new HttpError(400, "Escreva uma mensagem");
      const { cap, before, keys } = await checkBudgetAndKeys(squad);
      const { count: recentUser } = await admin.from("squad_chat_messages").select("id", { count: "exact", head: true })
        .eq("squad_id", squad.id).eq("author", "user").contains("meta", { meeting: { id: meeting.id, author_id: authUser.id } })
        .gte("created_at", new Date(Date.now() - 60_000).toISOString());
      if ((recentUser || 0) >= CHAT_RATE_LIMIT_PER_MIN) throw new HttpError(429, "Muitas mensagens em pouco tempo. Aguarde um minuto.", "chat_rate_limit");
      if (!(await acquireLock(meeting.id))) throw new HttpError(409, "O time ainda está respondendo à mensagem anterior. Tente de novo em instantes.", "meeting_busy");

      const sink: any[] = [];
      let handoff = false;
      try {
        const agents = await loadAgents(squad.id);
        const insert = makeInsert(squad.id, meeting.id, sink);
        const pii = screenInput(text, squad.sensitivity);
        const sec = template.maskSecrets ? maskSecrets(pii.text) : { text: pii.text, findings: [] as { type: string; count: number }[] };
        const meta: Record<string, unknown> = {};
        if (pii.findings.length) meta.masked_pii = pii.findings;
        if (sec.findings.length) meta.masked_secrets = sec.findings;
        // Autoria: o anfitrião aparece como "Dono" (sem nome); convidado leva nome e papel. `author_id` serve ao limite por pessoa.
        meta.meeting = { author_id: authUser.id, ...(isGuest ? { author_name: await displayNameOf(), author_role: role } : {}) };
        await insert({ author: "user", content: sec.text, meta });

        // Comandos de silêncio ("silêncio 10 min") são controle da reunião: só o anfitrião.
        const cmd = isGuest ? null : parseMeetingCommand(sec.text);
        if (cmd) {
          if (cmd.kind === "silence") {
            await admin.from("squad_meetings").update({ silenced_until: new Date(Date.now() + cmd.minutes * 60_000).toISOString() }).eq("id", meeting.id);
            await insert({ author: "system", content: `Silêncio por ${cmd.minutes} minutos. Os agentes só respondem se forem chamados com @nome.` });
          } else {
            await admin.from("squad_meetings").update({ silenced_until: null }).eq("id", meeting.id);
            await insert({ author: "system", content: "Silêncio encerrado. Os agentes voltam a participar." });
          }
          return json({ messages: sink, usage: usageOf(before, cap) });
        }

        let mentions = parseMentions(sec.text, agents as ChatAgent[]);
        // Pedido de busca em literatura: a busca é feita por código e o agente indicado (ou chamado com @) comenta só o que voltou.
        let tool: ToolCtx | undefined;
        let toolCost = 0;
        if (detectToolIntent(sec.text) === "pubmed") {
          const candidates = agents.filter((a) => meeting.participants.includes(a.id) || a.id === meetingModerator(agents, meeting.participants));
          const target = mentions.length ? mentions : [pickToolAgent(candidates, sec.text)].filter((x): x is string => !!x);
          if (target.length) {
            const nameById = new Map(agents.map((a) => [a.id, a.name]));
            const recent = (await recentMessages(squad.id, meeting.id, 14)).filter((m) => !m.meta?.meeting?.hidden);
            const ctx = transcriptBlock(recent.map((m) => ({ author: m.author, agentName: m.agent_id ? nameById.get(m.agent_id) : undefined, userName: m.meta?.meeting?.author_name, content: m.content })), 10, 400);
            const t = await runPubmedTool({ squad, meeting, keys, insert }, sec.text, ctx);
            tool = t.tool;
            toolCost = t.cost;
            mentions = target;
          }
        }
        // Pergunta sobre os arquivos da reunião: as contas são feitas por código e o agente indicado (ou chamado com @) só interpreta os números.
        if (!tool && detectFileIntent(sec.text)) {
          const { data: fileRows } = await admin.from("squad_meeting_files")
            .select("id, name, kind, sheet_name, rows, cols, pages, table_data, content_text, truncated").eq("meeting_id", meeting.id).order("created_at");
          if (fileRows && fileRows.length) {
            const picked = pickFilesForRequest(fileRows as any[], sec.text);
            const blocks: string[] = [];
            const calcs: Record<string, unknown>[] = [];
            let planned = false;
            for (const f of picked) {
              if (f.kind === "sheet") {
                const table = f.table_data as Table;
                const cols = inferColumns(table);
                let calcText = "";
                // Só uma planilha por pedido gasta a chamada que escolhe o cálculo, e só quando o pedido exige conta.
                if (!planned && needsCalc(sec.text)) {
                  planned = true;
                  const pp = buildPlanPrompt(sec.text, cols);
                  const pr = await callWithFallback(admin, keys, {
                    systemPrompt: pp.system, messages: [{ role: "user", content: pp.user }], temperature: 0, mode: "text", maxTokens: 160,
                    modelOverridePerProvider: EVALUATOR_MODELS, deadlineAt: Date.now() + EVALUATOR_DEADLINE_MS,
                  });
                  let planCost = 0;
                  let plan: Plan = { action: "summary" };
                  if (pr && pr.ok && pr.output) {
                    planCost = estimateCost(pr.model!, pr.tokensInput, pr.tokensOutput);
                    await logAiUsage(admin, { userId: user.id, provider: pr.provider!, model: pr.model!, tokensInput: pr.tokensInput, tokensOutput: pr.tokensOutput, promptType: "squad_meeting_sheet_plan" });
                    plan = parsePlan(pr.output, cols);
                  }
                  toolCost += planCost;
                  await insert({ author: "system", content: "escolha do cálculo", cost_usd: planCost, meta: { meeting: { hidden: true, kind: "sheet_plan" } } });
                  const result = runPlan(table, cols, plan);
                  calcText = result.text;
                  if (result.calc) calcs.push({ file: f.name, ...result.calc });
                }
                blocks.push(buildFileBlock({ kind: "sheet", description: describeTable(f.name, table, cols), calc: calcText }));
              } else {
                const ex = pickDocExcerpts(String(f.content_text || ""), sec.text);
                blocks.push(buildFileBlock({
                  kind: "doc", partial: ex.partial, truncated: !!f.truncated,
                  description: `Documento "${f.name}"${f.pages ? ` (${f.pages} páginas)` : ""}:\n${ex.text}`, calc: "",
                }));
              }
            }
            const candidates = agents.filter((a) => meeting.participants.includes(a.id) || a.id === meetingModerator(agents, meeting.participants));
            const target = mentions.length ? mentions : [pickFileAgent(candidates, sec.text)].filter((x): x is string => !!x);
            if (target.length && blocks.length) {
              tool = { name: "file", query: picked.map((f) => f.name).join(", "), block: blocks.join("\n\n---\n\n").slice(0, 22000), pmids: [], sources: [], error: null, calc: calcs, fileCount: picked.length };
              mentions = target;
            }
          }
        }
        const run = await runTurn({ squad, template, meeting, agents, keys, insert }, { quiet: false, mentions, userText: sec.text, tool });
        run.cost += toolCost;
        const monthAfter = before + run.cost;
        const crossing = capCrossing(before, monthAfter, cap);
        if (crossing) {
          await insert({
            author: "system", meta: { cap: crossing },
            content: crossing === "exceeded" ? "Teto mensal da conversa atingido. Aumente o teto para continuar conversando." : "A conversa deste mês passou de 80% do teto.",
          });
        }
        const out = json({ messages: sink, spoke: run.spoke, usage: usageOf(monthAfter, cap) });
        handoff = true;
        await finishInBackground(meeting.id, updateLiveMinutes(squad, meeting.id, keys));
        return out;
      } finally {
        if (!handoff) await releaseLock(meeting.id);
      }
    }

    // ---------- end ----------
    if (action === "end") {
      requireOpen(meeting);
      if (!(await acquireLock(meeting.id))) throw new HttpError(409, "O time ainda está respondendo. Tente encerrar em instantes.", "meeting_busy");
      const sink: any[] = [];
      try {
        const agents = await loadAgents(squad.id);
        const insert = makeInsert(squad.id, meeting.id, sink);
        const nameById = new Map(agents.map((a) => [a.id, a.name]));
        const recent = await recentMessages(squad.id, meeting.id, 250);
        const visible = recent.filter((m) => !m.meta?.meeting?.hidden && !m.meta?.meeting?.minutes);
        const lines: LiveLine[] = visible.map((m) => ({ author: m.author, agentName: m.agent_id ? nameById.get(m.agent_id) : undefined, userName: m.meta?.meeting?.author_name, content: m.content }));
        const agenda = meeting.agenda || [];
        const moderatorId = meetingModerator(agents, meeting.participants);
        const moderator = agents.find((a) => a.id === moderatorId);

        // Participantes: quem foi convidado e quem de fato falou. Referências: só o que a busca do PubMed devolveu durante a reunião.
        const spoke = new Set(visible.filter((m) => m.author === "agent" && m.agent_id).map((m) => m.agent_id as string));
        const partAgents = agents.filter((a) => meeting.participants.includes(a.id) || a.id === moderatorId || spoke.has(a.id));
        const refMap = new Map<string, { pmid: string; title: string; journal: string; year: string }>();
        for (const m of visible) for (const s of (m.meta?.sources || []) as any[]) {
          if (s?.pmid && !refMap.has(String(s.pmid))) refMap.set(String(s.pmid), { pmid: String(s.pmid), title: String(s.title || ""), journal: String(s.journal || ""), year: String(s.year || "") });
        }
        const references = [...refMap.values()];
        const { data: fileRows } = await admin.from("squad_meeting_files").select("name, kind, rows, cols, pages").eq("meeting_id", meeting.id).order("created_at");
        const files = ((fileRows || []) as any[]).map((f) => ({ name: String(f.name), detail: f.kind === "sheet" ? `planilha com ${f.rows} linhas e ${f.cols} colunas` : `documento${f.pages ? ` de ${f.pages} páginas` : ""}` }));

        let content: ReturnType<typeof parseMinutesDoc> = null;
        let cost = 0;
        let model: string | null = null;
        const { data: liveRow } = await admin.from("squad_meetings").select("minutes_live").eq("id", meeting.id).maybeSingle();
        const draft = liveRow?.minutes_live || "";
        try {
          const { keys } = await checkBudgetAndKeys(squad);
          const prompt = buildMinutesDocPrompt({
            title: meeting.title, agenda, transcript: transcriptBlock(lines, 250, 1400), draft,
            participants: ["Anfitrião (dono do squad)", ...partAgents.map((a) => `${a.name} (${a.role})`)].join("\n"),
            sources: references.map((r) => `PMID ${r.pmid}: ${r.title} (${r.journal}, ${r.year})`).join("\n"),
            files: files.map((f) => `${f.name}: ${f.detail}`).join("\n"),
          });
          const res = await callWithFallback(admin, keys, {
            systemPrompt: prompt.system, messages: [{ role: "user", content: prompt.user }], temperature: 0.2, mode: "text", maxTokens: 6000,
            deadlineAt: Date.now() + 100_000,
          });
          if (res && res.ok && res.output) {
            content = parseMinutesDoc(res.output);
            cost = estimateCost(res.model!, res.tokensInput, res.tokensOutput);
            model = res.model!;
            await logAiUsage(admin, { userId: user.id, provider: res.provider!, model: res.model!, tokensInput: res.tokensInput, tokensOutput: res.tokensOutput, promptType: "squad_meeting_minutes" });
          }
        } catch (e) {
          // Sem chave, teto estourado ou provedor fora do ar: a ata mínima por código garante que a reunião sempre fecha.
          console.warn("[squad-meeting] ata sem modelo:", (e as Error).message);
        }
        const fallback = !content;
        const doc = composeMinutesDoc(content, {
          title: meeting.title, startedAt: meeting.created_at, endedAt: new Date().toISOString(),
          moderator: moderator ? { name: moderator.name, role: moderator.role } : null,
          participants: partAgents.map((a) => ({ name: a.name, role: a.role })), references, files, agenda, draft,
        });
        const markdown = renderMinutesMarkdown(doc);
        await insert({
          author: "agent", agent_id: moderatorId, content: markdown, cost_usd: cost, model,
          meta: { meeting: { minutes: true, doc: true, ...(fallback ? { fallback: true } : {}) }, minutes_doc: doc },
        });
        await admin.from("squad_meetings").update({ status: "ended", ended_at: new Date().toISOString(), minutes: markdown, silenced_until: null }).eq("id", meeting.id);
        await emitChatEvent(admin, { squadId: squad.id, ownerId: user.id, type: "meeting_ended", text: "Reunião encerrada" });
        return json({ messages: sink, fallback });
      } finally {
        await releaseLock(meeting.id);
      }
    }

    throw new HttpError(400, "Ação desconhecida");
  } catch (e: any) {
    if (e instanceof HttpError) return json({ error: e.message, code: e.code }, e.status);
    console.error("[squad-meeting] error:", e);
    return json({ error: e?.message || "Erro interno" }, 500);
  }
});
