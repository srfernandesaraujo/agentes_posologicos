// Partes da Conversa com o Time que usam banco e modelo e que mais de uma ação precisa: contexto da última missão,
// eventos do escritório (sem missão) e as etapas da reunião. A lógica pura fica em squadChatCore.ts (testada).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callWithFallback, estimateCost, logAiUsage, type OrderedKey } from "./llmProvider.ts";
import {
  CHAT_MISSION_CONTEXT_CHARS, MEETING_CAP_USD, TEAM_THREAD, buildChatSystemPrompt, buildMeetingUserMessage, clip, meetingMaxTokens,
  meetingModerator, meetingNextStage, shouldSkipRound2, MEETING_RULES, type ChatAgent, type MeetingPosition, type MeetingStage,
} from "./squadChatCore.ts";

const MISSION_STATUS: Record<string, string> = {
  running: "em andamento", paused: "pausada por custo", awaiting_approval: "aguardando a decisão do dono", awaiting_owner: "aguardando resposta do dono",
  completed: "concluída", failed: "falhou", cancelled: "cancelada",
};

export type AgentRow = ChatAgent & { system_prompt: string; room?: string };

/** Evento do escritório que não pertence a uma missão (o escritório só se mexe por eventos reais). Nunca derruba o chat. */
export async function emitChatEvent(
  admin: SupabaseClient,
  ev: { squadId: string; ownerId: string; type: string; agentId?: string | null; room?: string | null; text?: string },
) {
  try {
    const { error } = await admin.from("squad_events").insert({
      mission_id: null, squad_id: ev.squadId, owner_id: ev.ownerId, agent_id: ev.agentId ?? null, type: ev.type,
      text: ev.text ? ev.text.slice(0, 120) : null, room: ev.room ?? null, payload: {},
    });
    if (error) console.warn("[squad-chat] event failed:", error.message);
  } catch (e) {
    console.warn("[squad-chat] event failed:", (e as Error).message);
  }
}

/** Contexto da última missão (pedido, entregas do próprio agente e pacote final), recortado por agente. */
export async function loadMissionContext(admin: SupabaseClient, squadId: string, ownerId: string): Promise<(agentId: string) => string> {
  const { data: lastMission } = await admin.from("squad_missions").select("id, briefing, status").eq("squad_id", squadId).eq("owner_id", ownerId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  let delivs: any[] = [];
  if (lastMission) {
    const { data } = await admin.from("squad_deliverables").select("title, kind, status, content, agent_id, created_at")
      .eq("mission_id", lastMission.id).order("created_at", { ascending: false }).limit(40);
    delivs = data || [];
  }
  return (agentId: string): string => {
    if (!lastMission) return "";
    const latestPerTitle = new Map<string, any>();
    for (const d of delivs) if (!latestPerTitle.has(d.title)) latestPerTitle.set(d.title, d);
    const all = [...latestPerTitle.values()];
    const final = all.find((d) => d.kind === "Entrega");
    const own = all.filter((d) => d.agent_id === agentId && d.kind !== "Entrega").slice(0, 2);
    const parts = [`Última missão (${MISSION_STATUS[lastMission.status] || lastMission.status}). Pedido: ${clip(String(lastMission.briefing || ""), 400)}`];
    for (const d of own) parts.push(`Entrega sua, "${d.title}":\n${clip(String(d.content || ""), 2500)}`);
    if (final) parts.push(`Pacote final, "${final.title}":\n${clip(String(final.content || ""), 3000)}`);
    return clip(parts.join("\n\n"), CHAT_MISSION_CONTEXT_CHARS);
  };
}

export interface MeetingRun {
  admin: SupabaseClient;
  userId: string;
  squadId: string;
  agents: AgentRow[];
  keys: OrderedKey[];
  memoryContext: string;
  contextFor: (agentId: string) => string;
  meetingId: string;
  question: string;
  participants: string[];
  /** Grava uma mensagem na conversa #time e devolve a linha gravada. */
  insert: (row: Record<string, unknown>) => Promise<any>;
  deadlineAt: number;
}

/** Quanto a reunião já gastou (soma das mensagens dela). */
async function meetingSpent(admin: SupabaseClient, squadId: string, meetingId: string): Promise<number> {
  const { data } = await admin.from("squad_chat_messages").select("cost_usd").eq("squad_id", squadId).contains("meta", { meeting: { id: meetingId } });
  return (data || []).reduce((s: number, r: any) => s + Number(r.cost_usd || 0), 0);
}

/**
 * Roda UMA etapa da reunião (1 posições, 2 reações, 3 resumo) a partir do que já está gravado. Devolve o custo da etapa,
 * a etapa que rodou (null se a reunião já havia terminado) e se agora terminou.
 */
export async function runMeetingNext(run: MeetingRun): Promise<{ stage: MeetingStage | null; cost: number; done: boolean }> {
  const { admin, squadId, userId, agents, meetingId } = run;
  const { data: rows } = await admin.from("squad_chat_messages").select("author, agent_id, content, meta, created_at")
    .eq("squad_id", squadId).eq("thread", TEAM_THREAD).contains("meta", { meeting: { id: meetingId } }).order("created_at");
  const all = (rows || []) as any[];
  const stage = meetingNextStage(all);
  if (!stage) return { stage: null, cost: 0, done: true };

  const nameById = new Map(agents.map((a) => [a.id, a.name]));
  const positions: MeetingPosition[] = all
    .filter((r) => r.author === "agent" && (r.meta?.meeting?.round === 1 || r.meta?.meeting?.round === 2))
    .map((r) => ({ name: nameById.get(r.agent_id) || "Colega", round: r.meta.meeting.round as 1 | 2, content: String(r.content) }));

  // Rodada 2 pulada quando a reunião já gastou boa parte do teto dela: vai direto ao resumo.
  if (stage === 2) {
    const spent = await meetingSpent(admin, squadId, meetingId);
    if (shouldSkipRound2(spent)) {
      await run.insert({
        author: "system", content: "Rodada 2 pulada para respeitar o teto da reunião. Seguindo para o resumo.",
        meta: { meeting: { id: meetingId, round: 2, skipped: true } },
      });
      return { stage, cost: 0, done: false };
    }
  }

  const speakers = stage === 3
    ? [meetingModerator(agents, run.participants)].filter((x): x is string => !!x)
    : run.participants;
  const userMessage = buildMeetingUserMessage(stage, run.question, positions);
  const team = agents.map((a) => ({ name: a.name, role: a.role }));
  const room = (id: string) => agents.find((a) => a.id === id)?.room ?? null;

  await Promise.all(speakers.map((id) => emitChatEvent(admin, { squadId, ownerId: userId, type: "chat_thinking", agentId: id, room: room(id), text: stage === 3 ? "Resumindo a reunião" : "Na reunião" })));
  const results = await Promise.all(speakers.map(async (agentId) => {
    const agent = agents.find((a) => a.id === agentId)!;
    const system = buildChatSystemPrompt({
      agentSystemPrompt: agent.system_prompt, agentName: agent.name, team, memoryContext: run.memoryContext, missionContext: run.contextFor(agentId), channel: "team",
    }) + "\n\n" + MEETING_RULES;
    const res = await callWithFallback(admin, run.keys, {
      systemPrompt: system, messages: [{ role: "user", content: userMessage }], temperature: 0.5, mode: "text",
      maxTokens: meetingMaxTokens(stage), deadlineAt: run.deadlineAt,
    });
    return { agent, res };
  }));

  let cost = 0;
  for (const { agent, res } of results) {
    if (!res || !res.ok || !res.output) {
      await run.insert({
        author: "system", agent_id: agent.id, content: `${agent.name} não conseguiu participar agora (provedor de IA indisponível).`,
        meta: { error: true, meeting: { id: meetingId, round: stage } },
      });
      await emitChatEvent(admin, { squadId, ownerId: userId, type: "chat_failed", agentId: agent.id, room: agent.room ?? null, text: "Sem resposta" });
      continue;
    }
    const c = estimateCost(res.model!, res.tokensInput, res.tokensOutput);
    cost += c;
    await logAiUsage(admin, { userId, provider: res.provider!, model: res.model!, tokensInput: res.tokensInput, tokensOutput: res.tokensOutput, promptType: "squad_chat_meeting" });
    await run.insert({
      author: "agent", agent_id: agent.id, content: res.output.trim() + (res.finishReason === "length" ? " […]" : ""), cost_usd: c,
      tokens_input: res.tokensInput, tokens_output: res.tokensOutput, provider: res.provider, model: res.model,
      meta: { meeting: { id: meetingId, round: stage, ...(stage === 3 ? { summary: true } : {}) }, ...(res.finishReason === "length" ? { truncated: true } : {}) },
    });
    await emitChatEvent(admin, { squadId, ownerId: userId, type: "chat_replied", agentId: agent.id, room: agent.room ?? null, text: stage === 3 ? "Resumo pronto" : "Posição dada" });
  }
  const finished = stage === 3 && results.some(({ res }) => res && res.ok && res.output);
  if (finished) await emitChatEvent(admin, { squadId, ownerId: userId, type: "meeting_ended", text: "Reunião encerrada" });
  return { stage, cost, done: finished };
}

export { MEETING_CAP_USD };
