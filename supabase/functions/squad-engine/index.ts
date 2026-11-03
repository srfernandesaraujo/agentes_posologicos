// Motor do Escritório de Agentes (Fase 0).
// Ações (POST JSON, sempre autenticado como o dono do squad):
//   list_templates                          → templates disponíveis
//   create_squad   { templateSlug, name? }  → cria o squad e seus agentes a partir do template
//   start_mission  { squadId, briefing, formData?, costCapUsd? } → cria missão + tarefas
//   run_next       { missionId }            → executa UMA tarefa (job curto, estado salvo ao fim)
//   run_all        { missionId }            → encadeia tarefas até o limite de tempo; devolve hasMore
//   raise_cap      { missionId, costCapUsd }→ aumenta o teto e retoma uma missão pausada
// Cada passo grava eventos em squad_events; o escritório visual só lê esses eventos.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrderedKeysForUser, callWithFallback, estimateCost, logAiUsage } from "../_shared/llmProvider.ts";
import {
  planTasks, pickNextTask, budgetState, clampCap, screenInput, buildTaskUserMessage,
  type PreviousOutput,
} from "../_shared/squadCore.ts";
import { getTemplate, listTemplates } from "../_shared/squadTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RUN_ALL_BUDGET_MS = 100_000; // folga sob o limite de tempo da edge function
const STALE_TASK_MS = 5 * 60 * 1000;
const MAX_BRIEFING_CHARS = 8000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

async function emit(
  admin: SupabaseClient,
  mission: { id: string; squad_id: string; owner_id: string },
  ev: { type: string; text?: string; agentId?: string | null; room?: string | null; payload?: Record<string, unknown> },
) {
  const { error } = await admin.from("squad_events").insert({
    mission_id: mission.id, squad_id: mission.squad_id, owner_id: mission.owner_id,
    agent_id: ev.agentId ?? null, type: ev.type, text: ev.text ?? null, room: ev.room ?? null, payload: ev.payload ?? {},
  });
  if (error) console.warn("[squad-engine] emit failed:", error.message);
}

async function loadOwnedMission(admin: SupabaseClient, missionId: string, userId: string) {
  const { data: mission } = await admin.from("squad_missions").select("*").eq("id", missionId).maybeSingle();
  if (!mission || mission.owner_id !== userId) throw new HttpError(404, "Missão não encontrada");
  return mission;
}

type StepState = "task_done" | "awaiting_approval" | "paused" | "failed" | "busy" | "closed";

async function failMission(admin: SupabaseClient, mission: any, message: string) {
  await admin.from("squad_missions").update({ status: "failed", error: message, completed_at: new Date().toISOString() }).eq("id", mission.id);
  await emit(admin, mission, { type: "mission_failed", text: message });
}

async function runNext(admin: SupabaseClient, missionId: string, userId: string): Promise<{ state: StepState; taskId?: string; message?: string }> {
  let mission = await loadOwnedMission(admin, missionId, userId);
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
    .from("squad_tasks")
    .select("id, position, status, depends_on_position, started_at")
    .eq("mission_id", mission.id)
    .order("position");
  const next = pickNextTask((tasks || []) as any[]);

  if (next.kind === "failed") { await failMission(admin, mission, "Uma tarefa falhou."); return { state: "failed" }; }
  if (next.kind === "busy") {
    // Tarefa "running" há muito tempo = a função anterior morreu no meio. Falha explícita em vez de travar.
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
    .from("squad_tasks")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", next.task.id).eq("status", "pending")
    .select("*").maybeSingle();
  if (!claimed) return { state: "busy" };

  const { data: agent } = await admin.from("squad_agents").select("*").eq("id", claimed.agent_id).single();
  await emit(admin, mission, { type: "task_started", agentId: agent.id, room: agent.room, text: claimed.title, payload: { task_id: claimed.id, position: claimed.position } });

  const failTask = async (msg: string) => {
    await admin.from("squad_tasks").update({ status: "failed", error: msg, completed_at: new Date().toISOString() }).eq("id", claimed.id);
    await emit(admin, mission, { type: "task_failed", agentId: agent.id, room: agent.room, text: msg });
    await failMission(admin, mission, msg);
    return { state: "failed" as StepState, taskId: claimed.id, message: msg };
  };

  // Contexto: o que o time já entregou.
  const { data: doneTasks } = await admin
    .from("squad_tasks").select("title, output, agent_id, position")
    .eq("mission_id", mission.id).eq("status", "done").order("position");
  const { data: allAgents } = await admin.from("squad_agents").select("id, name").eq("squad_id", mission.squad_id);
  const nameById = new Map((allAgents || []).map((a: any) => [a.id, a.name]));
  const previous: PreviousOutput[] = (doneTasks || []).map((t: any) => ({
    agentName: nameById.get(t.agent_id) || "Colega", title: t.title, output: t.output || "",
  }));

  const keys = await getOrderedKeysForUser(admin, userId);
  if (!keys.length) return await failTask("Nenhuma chave de API configurada. Adicione uma em Configurações para o squad trabalhar.");

  const userMessage = buildTaskUserMessage({
    briefing: mission.briefing, formData: mission.form_data || {},
    step: { title: claimed.title, instructions: claimed.instructions }, previous,
  });

  const result = await callWithFallback(admin, keys, {
    systemPrompt: agent.system_prompt,
    messages: [{ role: "user", content: userMessage }],
    temperature: 0.6,
    mode: "text",
  });
  if (!result || !result.ok || !result.output) return await failTask("Nenhum provedor de IA respondeu. Tente novamente em instantes.");

  const cost = estimateCost(result.model!, result.tokensInput, result.tokensOutput);
  await admin.from("squad_tasks").update({ status: "done", output: result.output, completed_at: new Date().toISOString() }).eq("id", claimed.id);
  await logAiUsage(admin, { userId, provider: result.provider!, model: result.model!, tokensInput: result.tokensInput, tokensOutput: result.tokensOutput, promptType: "squad" });

  const spec = claimed.deliverable_spec as { title: string; kind: string; final?: boolean } | null;
  if (spec) {
    await admin.from("squad_deliverables").insert({
      mission_id: mission.id, squad_id: mission.squad_id, owner_id: mission.owner_id,
      agent_id: agent.id, task_id: claimed.id, title: spec.title, kind: spec.kind,
      status: spec.final ? "in_review" : "done", content: result.output,
    });
    await emit(admin, mission, { type: "deliverable_created", agentId: agent.id, room: agent.room, text: spec.title, payload: { kind: spec.kind, final: !!spec.final } });
  }

  // Custos da missão (execução sequencial: ler-e-somar é seguro aqui).
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "list_templates") {
      return json({
        templates: listTemplates().map((t) => ({
          slug: t.slug, name: t.name, kind: t.kind, sensitivity: t.sensitivity, environment: t.environment,
          defaultCapUsd: t.defaultCapUsd, maxCapUsd: t.maxCapUsd, estimatedCostUsd: t.estimatedCostUsd,
          agents: t.agents.map((a) => ({ slug: a.slug, name: a.name, role: a.role, room: a.room })),
        })),
      });
    }

    if (action === "create_squad") {
      const template = getTemplate(String(body?.templateSlug || ""));
      if (!template) throw new HttpError(400, "Template inexistente");
      const name = String(body?.name || template.name).trim().slice(0, 80) || template.name;
      const { data: squad, error } = await admin.from("squads").insert({
        owner_id: user.id, template_slug: template.slug, name, kind: template.kind,
        sensitivity: template.sensitivity, environment: template.environment, default_cost_cap_usd: template.defaultCapUsd,
      }).select().single();
      if (error) throw error;
      const { error: agErr } = await admin.from("squad_agents").insert(
        template.agents.map((a, i) => ({
          squad_id: squad.id, owner_id: user.id, slug: a.slug, name: a.name, role: a.role, room: a.room,
          system_prompt: a.systemPrompt, sort_order: i,
        })),
      );
      if (agErr) { await admin.from("squads").delete().eq("id", squad.id); throw agErr; }
      return json({ squad });
    }

    if (action === "start_mission") {
      const { data: squad } = await admin.from("squads").select("*").eq("id", String(body?.squadId || "")).maybeSingle();
      if (!squad || squad.owner_id !== user.id) throw new HttpError(404, "Squad não encontrado");
      const template = getTemplate(squad.template_slug);
      if (!template) throw new HttpError(400, "Template do squad não existe mais");

      let briefing = String(body?.briefing || "").trim();
      if (!briefing) throw new HttpError(400, "Descreva a missão");
      if (briefing.length > MAX_BRIEFING_CHARS) throw new HttpError(400, `Briefing acima de ${MAX_BRIEFING_CHARS} caracteres`);

      // Squads de saúde: mascara identificadores antes de qualquer envio a modelo.
      const piiFindings: { type: string; count: number }[] = [];
      const maskedBrief = screenInput(briefing, squad.sensitivity);
      briefing = maskedBrief.text; piiFindings.push(...maskedBrief.findings);
      const formData: Record<string, unknown> = {};
      for (const [k, v] of Object.entries((body?.formData && typeof body.formData === "object" ? body.formData : {}) as Record<string, unknown>)) {
        if (typeof v === "string") {
          const m = screenInput(v, squad.sensitivity);
          formData[k] = m.text; piiFindings.push(...m.findings);
        } else formData[k] = v;
      }

      const cap = clampCap(body?.costCapUsd ?? squad.default_cost_cap_usd, template);
      const { data: mission, error } = await admin.from("squad_missions").insert({
        squad_id: squad.id, owner_id: user.id, briefing, form_data: formData, cost_cap_usd: cap, status: "running",
      }).select().single();
      if (error) throw error;

      const { data: agents } = await admin.from("squad_agents").select("id, slug").eq("squad_id", squad.id);
      const idBySlug = new Map((agents || []).map((a: any) => [a.slug, a.id]));
      const planned = planTasks(template);
      const { error: tErr } = await admin.from("squad_tasks").insert(
        planned.map((t) => ({
          mission_id: mission.id, owner_id: user.id, agent_id: idBySlug.get(t.agentSlug), position: t.position,
          depends_on_position: t.dependsOnPosition, title: t.title, instructions: t.instructions, deliverable_spec: t.deliverable,
        })),
      );
      if (tErr) { await admin.from("squad_missions").delete().eq("id", mission.id); throw tErr; }

      await emit(admin, mission, { type: "mission_started", text: "Missão iniciada", payload: { cost_cap_usd: cap, tasks: planned.length } });
      if (piiFindings.length) {
        await emit(admin, mission, { type: "pii_masked", text: "Dados pessoais foram mascarados antes do envio ao modelo.", payload: { findings: piiFindings } });
      }
      return json({ mission, piiFindings });
    }

    if (action === "run_next") {
      const r = await runNext(admin, String(body?.missionId || ""), user.id);
      return json(r);
    }

    if (action === "run_all") {
      const missionId = String(body?.missionId || "");
      const started = Date.now();
      let last = await runNext(admin, missionId, user.id);
      let ran = last.state === "task_done" ? 1 : 0;
      while (last.state === "task_done" && Date.now() - started < RUN_ALL_BUDGET_MS) {
        last = await runNext(admin, missionId, user.id);
        if (last.state === "task_done") ran++;
      }
      // hasMore: ainda há tarefas a executar (o chamador deve chamar run_all de novo).
      return json({ ...last, tasksRun: ran, hasMore: last.state === "task_done" });
    }

    if (action === "raise_cap") {
      const mission = await loadOwnedMission(admin, String(body?.missionId || ""), user.id);
      const { data: squad } = await admin.from("squads").select("template_slug").eq("id", mission.squad_id).single();
      const template = getTemplate(squad!.template_slug);
      if (!template) throw new HttpError(400, "Template do squad não existe mais");
      const newCap = clampCap(body?.costCapUsd, template);
      if (newCap <= Number(mission.cost_usd)) throw new HttpError(400, "O novo teto precisa ser maior que o custo já gasto");
      await admin.from("squad_missions").update({
        cost_cap_usd: newCap, warned_80: false, ...(mission.status === "paused" ? { status: "running" } : {}),
      }).eq("id", mission.id);
      await emit(admin, mission, { type: "budget_raised", text: `Teto ajustado para US$ ${newCap.toFixed(2)}.`, payload: { cap_usd: newCap } });
      return json({ ok: true, costCapUsd: newCap });
    }

    throw new HttpError(400, "Ação desconhecida");
  } catch (e: any) {
    if (e instanceof HttpError) return json({ error: e.message, code: e.code }, e.status);
    console.error("[squad-engine] error:", e);
    return json({ error: e?.message || "Erro interno" }, 500);
  }
});
