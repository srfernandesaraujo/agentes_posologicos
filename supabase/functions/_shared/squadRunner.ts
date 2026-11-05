// Núcleo de execução do motor de squads, compartilhado entre `squad-engine` (chamado pelo dono)
// e `squad-cron-tick` (chamado pelo agendador). Toda gravação usa a service role; quem chama é
// responsável por provar que o usuário é o dono (aqui, loadOwnedMission confere owner_id).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrderedKeysForUser, callWithFallback, estimateCost, logAiUsage } from "./llmProvider.ts";
import {
  planTasks, pickReadyTasks, budgetState, buildTaskUserMessage, formDisplay, buildRevisionInstructions,
  measureScript, parseDurationRange, durationNote, reviewRequestsAdjustments, extractOwnerQuestion, MAX_OWNER_QUESTIONS,
  countTextWords, parseWordRange, wordsNote,
  buildMemoryContext, buildMemoryExtractionPrompt, parseMemoryExtraction, type MemoryItem,
  type PreviousOutput, type SquadTemplate, type StepChecks,
} from "./squadCore.ts";
import { getTemplate } from "./squadTemplates.ts";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

const STALE_TASK_MS = 5 * 60 * 1000;
const SQUAD_MAX_TOKENS = 16000;
const MAX_CONTINUATIONS = 2;
const PREVIOUS_RUN_CHARS = 4000;

export async function emit(
  admin: SupabaseClient,
  mission: { id: string; squad_id: string; owner_id: string },
  ev: { type: string; text?: string; agentId?: string | null; room?: string | null; payload?: Record<string, unknown> },
) {
  const { error } = await admin.from("squad_events").insert({
    mission_id: mission.id, squad_id: mission.squad_id, owner_id: mission.owner_id,
    agent_id: ev.agentId ?? null, type: ev.type, text: ev.text ?? null, room: ev.room ?? null, payload: ev.payload ?? {},
  });
  if (error) console.warn("[squad] emit failed:", error.message);
}

export async function loadOwnedMission(admin: SupabaseClient, missionId: string, userId: string) {
  const { data: mission } = await admin.from("squad_missions").select("*").eq("id", missionId).maybeSingle();
  if (!mission || mission.owner_id !== userId) throw new HttpError(404, "Missão não encontrada");
  return mission;
}

async function failMission(admin: SupabaseClient, mission: any, message: string) {
  // Com tarefas em paralelo, mais de uma pode falhar: registra a falha da missão só uma vez.
  const { data: changed } = await admin.from("squad_missions")
    .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
    .eq("id", mission.id).neq("status", "failed").select("id");
  if (changed && changed.length) await emit(admin, mission, { type: "mission_failed", text: message });
}

// ---------- Criar missão ----------

export async function createMission(
  admin: SupabaseClient,
  p: {
    squad: any; template: SquadTemplate; userId: string; briefing: string;
    formData: Record<string, unknown>; capUsd: number; trigger: "manual" | "schedule";
  },
) {
  // Contexto: memória do squad + (squads contínuos) a entrega final da última execução.
  // Memória: notas livres do dono + itens aprendidos e confirmados (status ativo).
  // Squad persistente de missão: a versão mais recente de uma entrega-chave (ex.: bíblia do livro) segue como contexto.
  let carried = "";
  if (p.template.carryDeliverable) {
    const cd = p.template.carryDeliverable;
    const { data: prevCarry } = await admin.from("squad_deliverables").select("content")
      .eq("squad_id", p.squad.id).eq("owner_id", p.userId).eq("title", cd.title).in("status", ["done", "in_review", "approved"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (prevCarry?.content) {
      const max = cd.maxChars ?? 10000;
      const body = prevCarry.content.length > max ? prevCarry.content.slice(0, max) + "\n[... cortado ...]" : prevCarry.content;
      carried = `## ${cd.heading}\n${body}`;
    }
  }
  const { data: memRows } = await admin.from("squad_memories").select("id, kind, content, pinned, status, created_at")
    .eq("squad_id", p.squad.id).eq("owner_id", p.userId).eq("status", "active");
  let context = buildMemoryContext(p.squad.memory || "", (memRows || []) as MemoryItem[]);
  if (carried) context += `${context ? "\n\n" : ""}${carried}`;
  if (p.template.kind === "continuous") {
    const { data: prev } = await admin
      .from("squad_deliverables").select("title, content, created_at")
      .eq("squad_id", p.squad.id).eq("owner_id", p.userId).in("status", ["in_review", "approved"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (prev) {
      const body = prev.content.length > PREVIOUS_RUN_CHARS ? prev.content.slice(0, PREVIOUS_RUN_CHARS) + "\n[... cortado ...]" : prev.content;
      context += `${context ? "\n\n" : ""}## Resultado da execução anterior (${prev.title})\n${body}`;
    }
  }

  const { data: mission, error } = await admin.from("squad_missions").insert({
    squad_id: p.squad.id, owner_id: p.userId, briefing: p.briefing, form_data: p.formData,
    cost_cap_usd: p.capUsd, status: "running", context, trigger: p.trigger,
  }).select().single();
  if (error) throw error;

  const { data: agents } = await admin.from("squad_agents").select("id, slug").eq("squad_id", p.squad.id);
  const idBySlug = new Map((agents || []).map((a: any) => [a.slug, a.id]));
  const planned = planTasks(p.template);
  const { error: tErr } = await admin.from("squad_tasks").insert(
    planned.map((t) => ({
      mission_id: mission.id, owner_id: p.userId, agent_id: idBySlug.get(t.agentSlug), position: t.position,
      depends_on_position: t.dependsOnPosition, depends_on_positions: t.dependsOnPositions, title: t.title, instructions: t.instructions, deliverable_spec: t.deliverable,
      checks: t.checks,
    })),
  );
  if (tErr) { await admin.from("squad_missions").delete().eq("id", mission.id); throw tErr; }

  await emit(admin, mission, {
    type: "mission_started", text: p.trigger === "schedule" ? "Execução agendada iniciada" : "Missão iniciada",
    payload: { cost_cap_usd: p.capUsd, tasks: planned.length, trigger: p.trigger },
  });
  return mission;
}

// ---------- Executar UMA tarefa ----------

export type StepState = "task_done" | "awaiting_approval" | "awaiting_owner" | "paused" | "failed" | "busy" | "closed";

export async function runNext(admin: SupabaseClient, missionId: string, userId: string): Promise<{ state: StepState; taskId?: string; message?: string }> {
  const mission = await loadOwnedMission(admin, missionId, userId);
  if (mission.status === "paused") return { state: "paused" };
  if (mission.status === "awaiting_owner") return { state: "awaiting_owner" };
  if (mission.status !== "running") return { state: mission.status === "awaiting_approval" ? "awaiting_approval" : "closed" };

  // Teto de custo: checado ANTES de gastar mais.
  if (budgetState(Number(mission.cost_usd), Number(mission.cost_cap_usd)) === "exceeded") {
    await admin.from("squad_missions").update({ status: "paused" }).eq("id", mission.id);
    await emit(admin, mission, {
      type: "budget_paused",
      text: `Teto de US$ ${Number(mission.cost_cap_usd).toFixed(2)} atingido. Aumente o teto para continuar.`,
      payload: { cost_usd: Number(mission.cost_usd), cap_usd: Number(mission.cost_cap_usd) },
    });
    return { state: "paused" };
  }

  const { data: tasks } = await admin
    .from("squad_tasks").select("id, position, status, depends_on_position, depends_on_positions, started_at")
    .eq("mission_id", mission.id).order("position");
  const next = pickReadyTasks((tasks || []) as any[]);

  if (next.kind === "failed") { await failMission(admin, mission, "Uma tarefa falhou."); return { state: "failed" }; }
  if (next.kind === "busy") {
    // Tarefa "running" há muito tempo = a execução anterior morreu no meio. Falha explícita em vez de travar.
    const stale = (tasks || []).find((t: any) => t.status === "running" && t.started_at && Date.now() - new Date(t.started_at).getTime() > STALE_TASK_MS);
    if (stale) {
      await admin.from("squad_tasks").update({ status: "failed", error: "Tempo esgotado", completed_at: new Date().toISOString() }).eq("id", stale.id);
      await failMission(admin, mission, "Uma tarefa ficou sem resposta e foi marcada como falha.");
      return { state: "failed" };
    }
    return { state: "busy" };
  }
  if (next.kind === "finished") {
    await admin.from("squad_missions").update({ status: "awaiting_approval" }).eq("id", mission.id);
    await emit(admin, mission, { type: "mission_ready", text: "Entrega final pronta. Aguardando a sua decisão." });
    return { state: "awaiting_approval" };
  }

  // Reserva todas as tarefas prontas (só uma chamada concorrente consegue virar pending → running)
  // e roda em paralelo. Tarefas de um mesmo grupo terminam independentemente.
  const claimedRows: any[] = [];
  for (const t of next.tasks) {
    const { data: claimed } = await admin
      .from("squad_tasks").update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", t.id).eq("status", "pending").select("*").maybeSingle();
    if (claimed) claimedRows.push(claimed);
  }
  if (!claimedRows.length) return { state: "busy" };

  const results = await Promise.all(claimedRows.map((claimed) =>
    runTask(admin, mission, claimed, userId).catch(async (e) => {
      // Erro inesperado numa tarefa não pode deixá-la "running" para sempre nem derrubar as irmãs.
      const msg = e instanceof Error ? e.message : "Erro inesperado";
      await admin.from("squad_tasks").update({ status: "failed", error: msg, completed_at: new Date().toISOString() }).eq("id", claimed.id);
      await failMission(admin, mission, msg);
      return { state: "failed" as StepState, taskId: claimed.id, message: msg };
    })
  ));
  const pick = (st: StepState) => results.find((r) => r.state === st);
  return pick("failed") || pick("awaiting_owner") || pick("paused") || results[0];
}

// ---------- Executar UMA tarefa já reservada ----------

async function runTask(admin: SupabaseClient, mission: any, claimed: any, userId: string): Promise<{ state: StepState; taskId?: string; message?: string }> {
  const { data: agent } = await admin.from("squad_agents").select("*").eq("id", claimed.agent_id).single();
  await emit(admin, mission, { type: "task_started", agentId: agent.id, room: agent.room, text: claimed.title, payload: { task_id: claimed.id, position: claimed.position } });

  const failTask = async (msg: string) => {
    await admin.from("squad_tasks").update({ status: "failed", error: msg, completed_at: new Date().toISOString() }).eq("id", claimed.id);
    await emit(admin, mission, { type: "task_failed", agentId: agent.id, room: agent.room, text: msg });
    await failMission(admin, mission, msg);
    return { state: "failed" as StepState, taskId: claimed.id, message: msg };
  };

  const { data: doneTasks } = await admin
    .from("squad_tasks").select("title, output, agent_id, position")
    .eq("mission_id", mission.id).eq("status", "done").order("position");
  const checks = (claimed.checks || {}) as StepChecks;

  // Etapa de correção condicional: só roda se o parecer da revisora pediu ajustes.
  if (checks.onlyIfAdjusts) {
    const review = [...(doneTasks || [])].reverse().find((t: any) => /parecer/i.test(t.title));
    if (!review || !reviewRequestsAdjustments(review.output || "")) {
      await admin.from("squad_tasks").update({
        status: "done", output: "Não necessário: o parecer não pediu ajustes.", completed_at: new Date().toISOString(),
      }).eq("id", claimed.id);
      await emit(admin, mission, { type: "task_skipped", agentId: agent.id, room: agent.room, text: claimed.title });
      return { state: "task_done", taskId: claimed.id };
    }
  }

  const { data: allAgents } = await admin.from("squad_agents").select("id, name, role").eq("squad_id", mission.squad_id).order("sort_order");
  const nameById = new Map((allAgents || []).map((a: any) => [a.id, a.name]));
  const previous: PreviousOutput[] = (doneTasks || []).map((t: any) => ({
    agentName: nameById.get(t.agent_id) || "Colega", title: t.title, output: t.output || "",
  }));

  const { data: squad } = await admin.from("squads").select("template_slug").eq("id", mission.squad_id).single();
  const template = squad ? getTemplate(squad.template_slug) : null;
  const formForPrompt = template ? formDisplay(template.formFields, mission.form_data || {}) : (mission.form_data || {});

  const { data: askedRows } = await admin.from("squad_questions").select("question, answer, status").eq("mission_id", mission.id).order("created_at");
  const asked = askedRows || [];
  const ownerCtx = {
    canAsk: mission.trigger !== "schedule" && asked.length < MAX_OWNER_QUESTIONS,
    remaining: Math.max(0, MAX_OWNER_QUESTIONS - asked.length),
    qa: asked.filter((q: any) => q.status === "answered" && q.answer).map((q: any) => ({ question: q.question, answer: q.answer })),
  };

  const keys = await getOrderedKeysForUser(admin, userId);
  if (!keys.length) return await failTask("Nenhuma chave de API configurada. Adicione uma em Configurações para o squad trabalhar.");

  // Medição de duração por código: o modelo recebe o número, não precisa estimar.
  const notes: string[] = [];
  if (checks.measureDuration) {
    const src = [...(doneTasks || [])].reverse().find((t: any) => checks.measureDuration!.sourceTitles.includes(t.title) && !/^Não necessário/.test(t.output || ""));
    const limit = parseDurationRange((mission.form_data || {})[checks.measureDuration.formKey]);
    if (src && limit) notes.push(durationNote(measureScript(src.output || ""), limit, src.title));
  }

  if (checks.measureWords) {
    const src = [...(doneTasks || [])].reverse().find((t: any) => checks.measureWords!.sourceTitles.includes(t.title) && !/^(Não necessário|SEM AJUSTES)/.test(t.output || ""));
    const range = parseWordRange((mission.form_data || {})[checks.measureWords.formKey]);
    if (src && range) notes.push(wordsNote(countTextWords(src.output || ""), range, src.title));
  }

  const userMessage = buildTaskUserMessage({
    briefing: mission.briefing, formData: formForPrompt, context: mission.context,
    step: { title: claimed.title, instructions: claimed.instructions }, previous,
    team: (allAgents || []).map((a: any) => ({ name: a.name, role: a.role })), notes, owner: ownerCtx,
  });
  const startedMs = Date.now();

  // Teto alto de tokens: modelos com raciocínio gastam parte do teto "pensando" e cortavam a resposta no meio.
  const baseMessages = [{ role: "user", content: userMessage }];
  const first = await callWithFallback(admin, keys, {
    systemPrompt: agent.system_prompt, messages: baseMessages, temperature: 0.6, mode: "text", maxTokens: SQUAD_MAX_TOKENS,
  });
  if (!first || !first.ok || !first.output) return await failTask("Nenhum provedor de IA respondeu. Tente novamente em instantes.");

  // Resposta cortada por tamanho: pede continuação em vez de entregar texto pela metade.
  let output = first.output;
  let finish = first.finishReason;
  let tokensIn = first.tokensInput;
  let tokensOut = first.tokensOutput;
  let cost = estimateCost(first.model!, first.tokensInput, first.tokensOutput);
  for (let i = 0; i < MAX_CONTINUATIONS && finish === "length"; i++) {
    const more = await callWithFallback(admin, keys, {
      systemPrompt: agent.system_prompt, temperature: 0.6, mode: "text", maxTokens: SQUAD_MAX_TOKENS,
      messages: [...baseMessages, { role: "assistant", content: output }, { role: "user", content: "Sua resposta foi cortada. Continue EXATAMENTE de onde parou, sem repetir nada e sem comentários." }],
    });
    if (!more || !more.ok || !more.output) break;
    output += more.output;
    finish = more.finishReason;
    tokensIn += more.tokensInput;
    tokensOut += more.tokensOutput;
    cost += estimateCost(more.model!, more.tokensInput, more.tokensOutput);
  }
  if (finish === "length") {
    return await failTask("A resposta do modelo ficou grande demais e foi cortada. Tente de novo com um escopo menor.");
  }
  // Custo desta etapa (acumula chamadas anteriores se a tarefa foi interrompida por uma pergunta ao dono)
  const taskCost = Number(claimed.cost_usd || 0) + cost;
  const taskIn = Number(claimed.tokens_input || 0) + tokensIn;
  const taskOut = Number(claimed.tokens_output || 0) + tokensOut;

  // O agente respondeu com uma pergunta ao dono em vez de entregar?
  const oq = extractOwnerQuestion(output);
  // Tarefas irmãs rodam ao mesmo tempo: reconfere o limite de perguntas na hora de gravar.
  let canAskNow = ownerCtx.canAsk;
  if (oq && canAskNow) {
    const { count: askedNow } = await admin.from("squad_questions").select("id", { count: "exact", head: true }).eq("mission_id", mission.id);
    canAskNow = (askedNow || 0) < MAX_OWNER_QUESTIONS;
  }
  if (oq && canAskNow) {
    await logAiUsage(admin, { userId, provider: first.provider!, model: first.model!, tokensInput: tokensIn, tokensOutput: tokensOut, promptType: "squad" });
    const { data: qrow } = await admin.from("squad_questions").insert({
      mission_id: mission.id, squad_id: mission.squad_id, owner_id: mission.owner_id, task_id: claimed.id, agent_id: agent.id,
      question: oq.question, options: oq.options, why: oq.why || null,
    }).select("id").single();
    // A tarefa volta a "pending": roda de novo, já com a resposta do dono no contexto.
    await admin.from("squad_tasks").update({
      status: "pending", started_at: null, output: null, cost_usd: taskCost, tokens_input: taskIn, tokens_output: taskOut,
    }).eq("id", claimed.id);
    await admin.rpc("squad_add_mission_cost", { p_mission: mission.id, p_cost: cost, p_in: tokensIn, p_out: tokensOut });
    // Só "running" vira "awaiting_owner": não ressuscita uma missão que já falhou por causa de uma irmã.
    await admin.from("squad_missions").update({ status: "awaiting_owner" }).eq("id", mission.id).eq("status", "running");
    await emit(admin, mission, { type: "question_asked", agentId: agent.id, room: agent.room, text: oq.question, payload: { question_id: qrow?.id, options: oq.options } });
    await admin.from("notifications").insert({
      user_id: mission.owner_id, type: "info", title: "Seu squad tem uma pergunta",
      message: `${agent.name} precisa de uma decisão sua: ${oq.question.slice(0, 140)}`, link: `/squads/${mission.squad_id}`,
    });
    return { state: "awaiting_owner", taskId: claimed.id };
  }
  if (oq) {
    // Pergunta fora de hora (execução agendada ou limite atingido): descarta o bloco; sem conteúdo, falha com clareza.
    output = oq.cleaned;
    if (output.length < 200) return await failTask("O agente tentou perguntar ao dono quando não podia e não entregou o conteúdo. Tente de novo.");
  }

  const result = { ...first, output, tokensInput: tokensIn, tokensOutput: tokensOut };
  await admin.from("squad_tasks").update({
    status: "done", output: result.output, completed_at: new Date().toISOString(),
    cost_usd: taskCost, tokens_input: taskIn, tokens_output: taskOut, provider: result.provider, model: result.model,
    duration_ms: Date.now() - startedMs,
  }).eq("id", claimed.id);
  await logAiUsage(admin, { userId, provider: result.provider!, model: result.model!, tokensInput: result.tokensInput, tokensOutput: result.tokensOutput, promptType: "squad" });

  const spec = claimed.deliverable_spec as { title: string; kind: string; final?: boolean } | null;
  // Etapa de ajustes em que o autor respondeu "SEM AJUSTES": não gera entrega nova.
  const noChange = !!checks.onlyIfAdjusts && /^\W*SEM AJUSTES/i.test(result.output);
  if (spec && !noChange) {
    const { count } = await admin.from("squad_deliverables").select("id", { count: "exact", head: true }).eq("mission_id", mission.id).eq("title", spec.title);
    await admin.from("squad_deliverables").insert({
      mission_id: mission.id, squad_id: mission.squad_id, owner_id: mission.owner_id,
      agent_id: agent.id, task_id: claimed.id, title: spec.title, kind: spec.kind, version: (count || 0) + 1,
      status: spec.final ? "in_review" : "done", content: result.output, provider: result.provider, model: result.model,
    });
    await emit(admin, mission, { type: "deliverable_created", agentId: agent.id, room: agent.room, text: spec.title, payload: { kind: spec.kind, final: !!spec.final } });
  }

  // Custos: soma atômica no banco (tarefas em paralelo terminam ao mesmo tempo).
  const { data: sum } = await admin.rpc("squad_add_mission_cost", { p_mission: mission.id, p_cost: cost, p_in: result.tokensInput, p_out: result.tokensOutput });
  const row = Array.isArray(sum) ? sum[0] : sum;
  const newCost = Number(row?.cost_usd ?? Number(mission.cost_usd) + cost);
  const cap = Number(row?.cost_cap_usd ?? mission.cost_cap_usd);
  let crossedWarn = false;
  if (budgetState(newCost, cap) === "warn") {
    // Só uma das tarefas simultâneas consegue virar o aviso de 80% (false → true).
    const { data: flipped } = await admin.from("squad_missions").update({ warned_80: true }).eq("id", mission.id).eq("warned_80", false).select("id");
    crossedWarn = !!(flipped && flipped.length);
  }
  if (crossedWarn) {
    await emit(admin, mission, { type: "budget_warning", text: `80% do teto (US$ ${cap.toFixed(2)}) usado.`, payload: { cost_usd: newCost, cap_usd: cap } });
  }
  await emit(admin, mission, { type: "task_done", agentId: agent.id, room: agent.room, text: claimed.title, payload: { task_id: claimed.id, cost_usd: cost } });
  return { state: "task_done", taskId: claimed.id };
}

// ---------- Memória: sugestões aprendidas com o dono ----------

const MEMORY_CAPTURE_TIMEOUT_MS = 25_000;

/** Deixa a captura rodar depois da resposta ao dono (o Supabase mantém a função viva até ela terminar). */
function inBackground(p: Promise<unknown>) {
  const rt = (globalThis as any).EdgeRuntime;
  if (rt && typeof rt.waitUntil === "function") rt.waitUntil(p.catch(() => {}));
  else p.catch(() => {});
}

/**
 * Lê uma fala do dono (pedido de ajustes ou resposta a uma pergunta) e grava de 0 a 3 sugestões de memória.
 * Nunca derruba a ação do dono: qualquer falha só é registrada no log. Execuções agendadas não aprendem.
 */
export async function captureMemories(
  admin: SupabaseClient, mission: any, userId: string,
  input: { source: "changes" | "answer"; ownerText: string; about: string },
): Promise<number> {
  try {
    if (mission.trigger === "schedule" || input.ownerText.trim().length < 12) return 0;
    const { data: existingRows } = await admin.from("squad_memories").select("content")
      .eq("squad_id", mission.squad_id).eq("owner_id", userId).neq("status", "archived");
    const existing = (existingRows || []) as { content: string }[];
    const keys = await getOrderedKeysForUser(admin, userId);
    if (!keys.length) return 0;
    const prompt = buildMemoryExtractionPrompt({ ...input, existing });
    const res = await Promise.race([
      callWithFallback(admin, keys, {
        systemPrompt: prompt.system, messages: [{ role: "user", content: prompt.user }],
        temperature: 0.2, mode: "text", maxTokens: 800,
      }),
      new Promise<null>((r) => setTimeout(() => r(null), MEMORY_CAPTURE_TIMEOUT_MS)),
    ]);
    if (!res || !res.ok || !res.output) return 0;
    const cost = estimateCost(res.model!, res.tokensInput, res.tokensOutput);
    await admin.rpc("squad_add_mission_cost", { p_mission: mission.id, p_cost: cost, p_in: res.tokensInput, p_out: res.tokensOutput });
    await logAiUsage(admin, { userId, provider: res.provider!, model: res.model!, tokensInput: res.tokensInput, tokensOutput: res.tokensOutput, promptType: "squad" });
    const items = parseMemoryExtraction(res.output, existing);
    if (!items.length) return 0;
    // Limite por squad: não empilha sugestões sem revisão.
    const { count } = await admin.from("squad_memories").select("id", { count: "exact", head: true })
      .eq("squad_id", mission.squad_id).eq("owner_id", userId).eq("status", "suggested");
    const room = Math.max(0, 12 - (count || 0));
    const toInsert = items.slice(0, room);
    if (!toInsert.length) return 0;
    await admin.from("squad_memories").insert(toInsert.map((m) => ({
      squad_id: mission.squad_id, owner_id: userId, mission_id: mission.id, kind: m.kind, content: m.content, source: "auto", status: "suggested",
    })));
    await emit(admin, mission, { type: "memory_suggested", text: `${toInsert.length} sugestão(ões) de memória`, payload: { count: toInsert.length } });
    return toInsert.length;
  } catch (e) {
    console.warn("[squad] captureMemories failed:", (e as Error).message);
    return 0;
  }
}

// ---------- Aprovar ou pedir ajustes ----------

export async function decideMission(
  admin: SupabaseClient, missionId: string, userId: string, decision: "approve" | "changes", comment: string,
) {
  const mission = await loadOwnedMission(admin, missionId, userId);
  if (mission.status !== "awaiting_approval") throw new HttpError(409, "A missão não está aguardando a sua decisão");

  const { data: finalDeliv } = await admin
    .from("squad_deliverables").select("*").eq("mission_id", mission.id).eq("status", "in_review")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!finalDeliv) throw new HttpError(409, "Entrega final não encontrada");

  if (decision === "approve") {
    await admin.from("squad_deliverables").update({ status: "approved" }).eq("id", finalDeliv.id);
    await admin.from("squad_missions").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", mission.id);
    await emit(admin, mission, { type: "mission_approved", text: "Você aprovou a entrega final." });
    return { status: "completed" };
  }

  const text = comment.trim();
  if (!text) throw new HttpError(400, "Escreva o que precisa ser ajustado");
  if (text.length > 4000) throw new HttpError(400, "Comentário acima de 4000 caracteres");

  const { data: lastTask } = await admin.from("squad_tasks").select("position, agent_id, deliverable_spec").eq("mission_id", mission.id).order("position", { ascending: false }).limit(1).single();
  const spec = (lastTask.deliverable_spec as any) || { title: finalDeliv.title, kind: finalDeliv.kind, final: true };
  await admin.from("squad_deliverables").update({ status: "changes_requested" }).eq("id", finalDeliv.id);
  await admin.from("squad_tasks").insert({
    mission_id: mission.id, owner_id: userId, agent_id: lastTask.agent_id, position: lastTask.position + 1,
    depends_on_position: lastTask.position, title: "Ajustes pedidos pelo dono",
    instructions: buildRevisionInstructions(text, finalDeliv.content), deliverable_spec: { ...spec, final: true },
  });
  await admin.from("squad_missions").update({ status: "running" }).eq("id", mission.id);
  await emit(admin, mission, { type: "changes_requested", text: "Você pediu ajustes na entrega final.", payload: { comment: text } });
  inBackground(captureMemories(admin, mission, userId, { source: "changes", ownerText: text, about: finalDeliv.title }));
  return { status: "running" };
}

// ---------- Responder uma pergunta do squad ----------

export async function answerQuestion(admin: SupabaseClient, questionId: string, userId: string, answer: string) {
  const text = answer.trim();
  if (!text) throw new HttpError(400, "Escreva a sua resposta");
  if (text.length > 2000) throw new HttpError(400, "Resposta acima de 2000 caracteres");
  const { data: q } = await admin.from("squad_questions").select("*").eq("id", questionId).maybeSingle();
  if (!q || q.owner_id !== userId) throw new HttpError(404, "Pergunta não encontrada");
  if (q.status !== "open") throw new HttpError(409, "Esta pergunta já foi respondida");
  const mission = await loadOwnedMission(admin, q.mission_id, userId);
  await admin.from("squad_questions").update({ status: "answered", answer: text, answered_at: new Date().toISOString() }).eq("id", q.id);
  if (mission.status === "awaiting_owner") {
    const { count } = await admin.from("squad_questions").select("id", { count: "exact", head: true }).eq("mission_id", mission.id).eq("status", "open");
    if (!count) await admin.from("squad_missions").update({ status: "running" }).eq("id", mission.id);
  }
  await emit(admin, mission, { type: "question_answered", agentId: q.agent_id, text: text.slice(0, 120), payload: { question_id: q.id } });
  inBackground(captureMemories(admin, mission, userId, { source: "answer", ownerText: text, about: q.question }));
  return { status: "running" };
}
