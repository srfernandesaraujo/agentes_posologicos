// Núcleo de execução do motor de squads, compartilhado entre `squad-engine` (chamado pelo dono)
// e `squad-cron-tick` (chamado pelo agendador). Toda gravação usa a service role; quem chama é
// responsável por provar que o usuário é o dono (aqui, loadOwnedMission confere owner_id).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrderedKeysForUser, callWithFallback, estimateCost, logAiUsage } from "./llmProvider.ts";
import {
  planTasks, pickNextTask, budgetState, buildTaskUserMessage, formDisplay, buildRevisionInstructions,
  measureScript, parseDurationRange, durationNote, reviewRequestsAdjustments,
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
  await admin.from("squad_missions").update({ status: "failed", error: message, completed_at: new Date().toISOString() }).eq("id", mission.id);
  await emit(admin, mission, { type: "mission_failed", text: message });
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
  let context = (p.squad.memory || "").trim();
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
      depends_on_position: t.dependsOnPosition, title: t.title, instructions: t.instructions, deliverable_spec: t.deliverable,
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

export type StepState = "task_done" | "awaiting_approval" | "paused" | "failed" | "busy" | "closed";

export async function runNext(admin: SupabaseClient, missionId: string, userId: string): Promise<{ state: StepState; taskId?: string; message?: string }> {
  const mission = await loadOwnedMission(admin, missionId, userId);
  if (mission.status === "paused") return { state: "paused" };
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
    .from("squad_tasks").select("id, position, status, depends_on_position, started_at")
    .eq("mission_id", mission.id).order("position");
  const next = pickNextTask((tasks || []) as any[]);

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

  // Reserva a tarefa (só uma chamada concorrente consegue virar pending → running).
  const { data: claimed } = await admin
    .from("squad_tasks").update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", next.task.id).eq("status", "pending").select("*").maybeSingle();
  if (!claimed) return { state: "busy" };

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

  const keys = await getOrderedKeysForUser(admin, userId);
  if (!keys.length) return await failTask("Nenhuma chave de API configurada. Adicione uma em Configurações para o squad trabalhar.");

  // Medição de duração por código: o modelo recebe o número, não precisa estimar.
  const notes: string[] = [];
  if (checks.measureDuration) {
    const src = [...(doneTasks || [])].reverse().find((t: any) => checks.measureDuration!.sourceTitles.includes(t.title) && !/^Não necessário/.test(t.output || ""));
    const limit = parseDurationRange((mission.form_data || {})[checks.measureDuration.formKey]);
    if (src && limit) notes.push(durationNote(measureScript(src.output || ""), limit, src.title));
  }

  const userMessage = buildTaskUserMessage({
    briefing: mission.briefing, formData: formForPrompt, context: mission.context,
    step: { title: claimed.title, instructions: claimed.instructions }, previous,
    team: (allAgents || []).map((a: any) => ({ name: a.name, role: a.role })), notes,
  });

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
  const result = { ...first, output, tokensInput: tokensIn, tokensOutput: tokensOut };
  await admin.from("squad_tasks").update({ status: "done", output: result.output, completed_at: new Date().toISOString() }).eq("id", claimed.id);
  await logAiUsage(admin, { userId, provider: result.provider!, model: result.model!, tokensInput: result.tokensInput, tokensOutput: result.tokensOutput, promptType: "squad" });

  const spec = claimed.deliverable_spec as { title: string; kind: string; final?: boolean } | null;
  if (spec) {
    const { count } = await admin.from("squad_deliverables").select("id", { count: "exact", head: true }).eq("mission_id", mission.id).eq("title", spec.title);
    await admin.from("squad_deliverables").insert({
      mission_id: mission.id, squad_id: mission.squad_id, owner_id: mission.owner_id,
      agent_id: agent.id, task_id: claimed.id, title: spec.title, kind: spec.kind, version: (count || 0) + 1,
      status: spec.final ? "in_review" : "done", content: result.output, provider: result.provider, model: result.model,
    });
    await emit(admin, mission, { type: "deliverable_created", agentId: agent.id, room: agent.room, text: spec.title, payload: { kind: spec.kind, final: !!spec.final } });
  }

  // Custos (tarefas rodam em sequência, então ler-e-somar é seguro).
  const newCost = Number(mission.cost_usd) + cost;
  const cap = Number(mission.cost_cap_usd);
  const crossedWarn = !mission.warned_80 && budgetState(newCost, cap) === "warn";
  await admin.from("squad_missions").update({
    cost_usd: newCost,
    tokens_input: Number(mission.tokens_input) + result.tokensInput,
    tokens_output: Number(mission.tokens_output) + result.tokensOutput,
    ...(crossedWarn ? { warned_80: true } : {}),
  }).eq("id", mission.id);
  if (crossedWarn) {
    await emit(admin, mission, { type: "budget_warning", text: `80% do teto (US$ ${cap.toFixed(2)}) usado.`, payload: { cost_usd: newCost, cap_usd: cap } });
  }
  await emit(admin, mission, { type: "task_done", agentId: agent.id, room: agent.room, text: claimed.title, payload: { task_id: claimed.id, cost_usd: cost } });
  return { state: "task_done", taskId: claimed.id };
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
  return { status: "running" };
}
