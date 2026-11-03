// Agendador dos squads. Chamado pelo pg_cron a cada poucos minutos, autenticado por
// SQUAD_CRON_SECRET (header x-cron-secret). Faz duas coisas:
//   1. Dispara execuções de squads contínuos cujo agendamento venceu (respeitando teto mensal).
//   2. Avança missões "running" (agendadas ou abandonadas com a página fechada), uma tarefa por vez.
// Nunca aprova nada: as entregas finais ficam aguardando a decisão do dono.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkForm, clampCap, isScheduleDue, monthStartIso, screenInput } from "../_shared/squadCore.ts";
import { getTemplate } from "../_shared/squadTemplates.ts";
import { createMission, runNext } from "../_shared/squadRunner.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const TIME_BUDGET_MS = 110_000;
const MAX_MISSIONS_PER_TICK = 10;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const secret = Deno.env.get("SQUAD_CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "Unauthorized" }, 401);

  const started = Date.now();
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = new Date();
  const report: any = { started: [], skipped: [], advanced: [] };

  try {
    // 1) Agendamentos vencidos
    const { data: schedules } = await admin.from("squad_schedules").select("*").eq("enabled", true);
    for (const s of schedules || []) {
      if (!isScheduleDue(s as any, now)) continue;
      // Marca a execução ANTES de começar: evita disparo duplicado se o tick seguinte chegar rápido.
      await admin.from("squad_schedules").update({ last_run_at: now.toISOString() }).eq("id", s.id);
      try {
        const { data: squad } = await admin.from("squads").select("*").eq("id", s.squad_id).maybeSingle();
        const template = squad ? getTemplate(squad.template_slug) : null;
        if (!squad || !template || template.kind !== "continuous") { report.skipped.push({ schedule: s.id, reason: "squad inválido" }); continue; }

        const { data: spent } = await admin.from("squad_missions").select("cost_usd").eq("squad_id", squad.id).gte("created_at", monthStartIso(now));
        const monthTotal = (spent || []).reduce((a: number, m: any) => a + Number(m.cost_usd), 0);
        if (monthTotal >= Number(s.monthly_cap_usd)) { report.skipped.push({ schedule: s.id, reason: "teto mensal atingido" }); continue; }

        const form = checkForm(template.formFields, s.form_data || {});
        if (!form.ok) { report.skipped.push({ schedule: s.id, reason: "formulário incompleto" }); continue; }
        const brief = screenInput(form.briefing, squad.sensitivity);
        const formData: Record<string, string> = {};
        for (const [k, v] of Object.entries(form.clean)) formData[k] = screenInput(v, squad.sensitivity).text;

        const mission = await createMission(admin, {
          squad, template, userId: squad.owner_id, briefing: brief.text, formData,
          capUsd: clampCap(s.cost_cap_usd, template), trigger: "schedule",
        });
        report.started.push({ schedule: s.id, mission: mission.id });
      } catch (e: any) {
        console.error("[squad-cron-tick] schedule", s.id, e?.message);
        report.skipped.push({ schedule: s.id, reason: e?.message || "erro" });
      }
    }

    // 2) Avançar missões em andamento
    const { data: running } = await admin
      .from("squad_missions").select("id, owner_id, squad_id").eq("status", "running")
      .order("created_at").limit(MAX_MISSIONS_PER_TICK);
    for (const m of running || []) {
      let ran = 0;
      let state = "";
      while (Date.now() - started < TIME_BUDGET_MS) {
        const r = await runNext(admin, m.id, m.owner_id);
        state = r.state;
        if (r.state !== "task_done") break;
        ran++;
      }
      report.advanced.push({ mission: m.id, tasksRun: ran, state });
      if (Date.now() - started >= TIME_BUDGET_MS) break;
    }

    return json(report);
  } catch (e: any) {
    console.error("[squad-cron-tick] error:", e);
    return json({ error: e?.message || "Erro interno", report }, 500);
  }
});
