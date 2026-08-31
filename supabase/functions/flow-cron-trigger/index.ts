import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runFlowHeadless, postFlowResultToRoom } from "../_shared/flowRunner.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const MIN_INTERVAL_MS: Record<string, number> = {
  hourly: 50 * 60 * 1000,
  daily: 20 * 60 * 60 * 1000,
  weekly: 6 * 24 * 60 * 60 * 1000,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authVal = req.headers.get("Authorization") || "";
    const authorized =
      (!!cronSecret && req.headers.get("x-cron-secret") === cronSecret) ||
      (!!anonKey && authVal === `Bearer ${anonKey}`);

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: triggers, error } = await supabase
      .from("agent_flow_triggers")
      .select("id, flow_id, frequency, run_hour, run_day_of_week, last_run_at, default_input, room_id, agent_flows!inner(user_id, name)")
      .eq("trigger_type", "cron")
      .eq("enabled", true);

    if (error) throw error;

    const now = new Date();
    const results: any[] = [];

    for (const t of triggers || []) {
      const minMs = MIN_INTERVAL_MS[t.frequency || "daily"] ?? MIN_INTERVAL_MS.daily;
      if (t.last_run_at) {
        const elapsedMs = now.getTime() - new Date(t.last_run_at).getTime();
        if (elapsedMs < minMs) continue;
      }
      if (t.frequency !== "hourly" && t.run_hour != null && now.getUTCHours() !== t.run_hour) continue;
      if (t.frequency === "weekly" && t.run_day_of_week != null && now.getUTCDay() !== t.run_day_of_week) continue;

      const ownerId = (t as any).agent_flows?.user_id;
      const flowName = (t as any).agent_flows?.name || "Fluxo";
      try {
        if (!ownerId) throw new Error("Fluxo sem dono resolvido");
        const run = await runFlowHeadless(supabase, supabaseUrl, serviceKey, t.flow_id, ownerId, t.default_input || "");
        results.push({ trigger_id: t.id, flow_id: t.flow_id, status: run.error ? "error" : "completed" });
        if (!run.error && t.room_id) {
          await postFlowResultToRoom(supabase, {
            roomId: t.room_id, ownerId, flowName, executionId: run.execution_id, output: run.final_output,
          });
        }
      } catch (e: any) {
        console.error("[flow-cron-trigger] flow", t.flow_id, "failed:", e.message);
        results.push({ trigger_id: t.id, flow_id: t.flow_id, status: "error", error: e.message });
      }

      // Sempre atualiza last_run_at, mesmo em erro, para não gerar retry storm.
      await supabase.from("agent_flow_triggers").update({ last_run_at: now.toISOString() }).eq("id", t.id);
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[flow-cron-trigger] error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
