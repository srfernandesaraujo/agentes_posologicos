// Motor do Escritório de Agentes. Ações (POST JSON, sempre autenticado como o dono do squad):
//   list_templates                                   → templates e seus formulários
//   create_squad   { templateSlug, name? }           → cria o squad e os agentes a partir do template
//   start_mission  { squadId, formData, costCapUsd? }→ valida o formulário, cria missão e tarefas
//   run_next       { missionId }                     → executa UMA tarefa (job curto, estado salvo ao fim)
//   run_all        { missionId }                     → encadeia tarefas até o limite de tempo; devolve hasMore
//   raise_cap      { missionId, costCapUsd }         → aumenta o teto e retoma uma missão pausada
//   decide         { missionId, decision, comment? } → "approve" ou "changes" na entrega final
//   answer_question{ questionId, answer }            → responde uma pergunta do squad e retoma a missão
//   update_memory  { squadId, memory }               → memória/preferências do squad
//   memory_add     { squadId, content, kind? }       → item de memória manual (já ativo)
//   memory_update  { memoryId, content?, kind?, pinned?, status? } → confirma/descarta sugestão, edita, fixa, arquiva
//   set_schedule   { squadId, ... }                  → agendamento de squads contínuos
// Cada passo grava eventos em squad_events; o escritório visual só lê esses eventos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkForm, clampCap, screenInput, maskPii, isDuplicateMemory, MEMORY_KINDS, MEMORY_MAX_CHARS, type MemoryKind } from "../_shared/squadCore.ts";
import { getTemplate, listTemplates } from "../_shared/squadTemplates.ts";
import { HttpError, answerQuestion, createMission, decideMission, emit, loadOwnedMission, runNext } from "../_shared/squadRunner.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RUN_ALL_BUDGET_MS = 100_000; // folga sob o limite de tempo da edge function
const MAX_MEMORY_CHARS = 6000;
const MAX_MEMORY_ITEMS = 100;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    const loadOwnedSquad = async (squadId: string) => {
      const { data: squad } = await admin.from("squads").select("*").eq("id", squadId).maybeSingle();
      if (!squad || squad.owner_id !== user.id) throw new HttpError(404, "Squad não encontrado");
      const template = getTemplate(squad.template_slug);
      if (!template) throw new HttpError(400, "Template do squad não existe mais");
      return { squad, template };
    };

    if (action === "list_templates") {
      return json({
        templates: listTemplates().map((t) => ({
          slug: t.slug, name: t.name, kind: t.kind, sensitivity: t.sensitivity, environment: t.environment,
          defaultCapUsd: t.defaultCapUsd, maxCapUsd: t.maxCapUsd, estimatedCostUsd: t.estimatedCostUsd,
          formFields: t.formFields,
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
      const { squad, template } = await loadOwnedSquad(String(body?.squadId || ""));
      const form = checkForm(template.formFields, (body?.formData && typeof body.formData === "object" ? body.formData : {}) as Record<string, unknown>);
      if (!form.ok) throw new HttpError(400, `Preencha: ${form.missing.join(", ")}`);

      // Squads de saúde: mascara identificadores antes de qualquer envio a modelo.
      const piiFindings: { type: string; count: number }[] = [];
      const maskedBrief = screenInput(form.briefing, squad.sensitivity);
      piiFindings.push(...maskedBrief.findings);
      const formData: Record<string, string> = {};
      for (const [k, v] of Object.entries(form.clean)) {
        const m = screenInput(v, squad.sensitivity);
        formData[k] = m.text;
        if (!template.formFields.find((f) => f.key === k)?.isBriefing) piiFindings.push(...m.findings);
      }

      const cap = clampCap(body?.costCapUsd ?? squad.default_cost_cap_usd, template);
      const mission = await createMission(admin, { squad, template, userId: user.id, briefing: maskedBrief.text, formData, capUsd: cap, trigger: "manual" });
      if (piiFindings.length) {
        await emit(admin, mission, { type: "pii_masked", text: "Dados pessoais foram mascarados antes do envio ao modelo.", payload: { findings: piiFindings } });
      }
      return json({ mission, piiFindings });
    }

    if (action === "run_next") {
      return json(await runNext(admin, String(body?.missionId || ""), user.id));
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
      const { template } = await loadOwnedSquad(mission.squad_id);
      const newCap = clampCap(body?.costCapUsd, template);
      if (newCap <= Number(mission.cost_usd)) throw new HttpError(400, "O novo teto precisa ser maior que o custo já gasto");
      await admin.from("squad_missions").update({
        cost_cap_usd: newCap, warned_80: false, ...(mission.status === "paused" ? { status: "running" } : {}),
      }).eq("id", mission.id);
      await emit(admin, mission, { type: "budget_raised", text: `Teto ajustado para US$ ${newCap.toFixed(2)}.`, payload: { cap_usd: newCap } });
      return json({ ok: true, costCapUsd: newCap });
    }

    if (action === "decide") {
      const decision = body?.decision === "approve" ? "approve" : body?.decision === "changes" ? "changes" : null;
      if (!decision) throw new HttpError(400, "Decisão inválida");
      return json(await decideMission(admin, String(body?.missionId || ""), user.id, decision, String(body?.comment || "")));
    }

    if (action === "answer_question") {
      return json(await answerQuestion(admin, String(body?.questionId || ""), user.id, String(body?.answer || "")));
    }

    if (action === "update_memory") {
      const { squad } = await loadOwnedSquad(String(body?.squadId || ""));
      const memory = String(body?.memory ?? "").slice(0, MAX_MEMORY_CHARS);
      await admin.from("squads").update({ memory }).eq("id", squad.id);
      return json({ ok: true });
    }

    const cleanMemory = (v: unknown): string => maskPii(String(v ?? "")).text.replace(/\s+/g, " ").trim().slice(0, MEMORY_MAX_CHARS);
    const cleanKind = (v: unknown): MemoryKind => ((MEMORY_KINDS as string[]).includes(String(v)) ? (String(v) as MemoryKind) : "preference");

    if (action === "memory_add") {
      const { squad } = await loadOwnedSquad(String(body?.squadId || ""));
      const content = cleanMemory(body?.content);
      if (content.length < 3) throw new HttpError(400, "Escreva o item da memória");
      const { data: existing } = await admin.from("squad_memories").select("content").eq("squad_id", squad.id).neq("status", "archived");
      if ((existing || []).length >= MAX_MEMORY_ITEMS) throw new HttpError(400, `Limite de ${MAX_MEMORY_ITEMS} itens. Arquive algum antes de adicionar.`);
      if (isDuplicateMemory(content, existing || [])) throw new HttpError(409, "Esse item já está na memória");
      const { data: row, error } = await admin.from("squad_memories").insert({
        squad_id: squad.id, owner_id: user.id, kind: cleanKind(body?.kind), content, source: "manual", status: "active",
      }).select().single();
      if (error) throw error;
      return json({ memory: row });
    }

    if (action === "memory_update") {
      const { data: mem } = await admin.from("squad_memories").select("*").eq("id", String(body?.memoryId || "")).maybeSingle();
      if (!mem || mem.owner_id !== user.id) throw new HttpError(404, "Item de memória não encontrado");
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body?.content !== undefined) {
        const content = cleanMemory(body.content);
        if (content.length < 3) throw new HttpError(400, "O item não pode ficar vazio");
        patch.content = content;
      }
      if (body?.kind !== undefined) patch.kind = cleanKind(body.kind);
      if (typeof body?.pinned === "boolean") patch.pinned = body.pinned;
      if (body?.status !== undefined) {
        if (!["active", "archived"].includes(String(body.status))) throw new HttpError(400, "Estado inválido");
        patch.status = body.status;
      }
      const { data: row, error } = await admin.from("squad_memories").update(patch).eq("id", mem.id).select().single();
      if (error) throw error;
      // Sugestão confirmada: o escritório mostra a diretora anotando na memória.
      if (mem.status === "suggested" && patch.status === "active" && mem.mission_id) {
        const { data: mission } = await admin.from("squad_missions").select("id, squad_id, owner_id").eq("id", mem.mission_id).maybeSingle();
        if (mission) await emit(admin, mission, { type: "memory_saved", text: "Anotado na memória" });
      }
      return json({ memory: row });
    }

    if (action === "set_schedule") {
      const { squad, template } = await loadOwnedSquad(String(body?.squadId || ""));
      if (template.kind !== "continuous") throw new HttpError(400, "Só squads contínuos têm agendamento");
      const frequency = body?.frequency === "daily" ? "daily" : "weekly";
      const hour = Number(body?.runHour);
      if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new HttpError(400, "Hora inválida (0 a 23, horário de Brasília)");
      const dow = frequency === "weekly" ? Number(body?.runDayOfWeek) : null;
      if (frequency === "weekly" && (!Number.isInteger(dow) || (dow as number) < 0 || (dow as number) > 6)) throw new HttpError(400, "Dia da semana inválido");
      const form = checkForm(template.formFields, (body?.formData && typeof body.formData === "object" ? body.formData : {}) as Record<string, unknown>);
      if (!form.ok) throw new HttpError(400, `Preencha: ${form.missing.join(", ")}`);
      const monthly = Math.min(Math.max(Number(body?.monthlyCapUsd) || 20, 1), 200);
      const { data: sched, error } = await admin.from("squad_schedules").upsert({
        squad_id: squad.id, owner_id: user.id, enabled: body?.enabled !== false, frequency, run_hour: hour,
        run_day_of_week: dow, form_data: form.clean, cost_cap_usd: clampCap(body?.costCapUsd, template), monthly_cap_usd: monthly,
      }, { onConflict: "squad_id" }).select().single();
      if (error) throw error;
      return json({ schedule: sched });
    }

    throw new HttpError(400, "Ação desconhecida");
  } catch (e: any) {
    if (e instanceof HttpError) return json({ error: e.message, code: e.code }, e.status);
    console.error("[squad-engine] error:", e);
    return json({ error: e?.message || "Erro interno" }, 500);
  }
});
