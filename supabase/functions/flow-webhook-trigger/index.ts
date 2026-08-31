import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runFlowHeadless, postFlowResultToRoom } from "../_shared/flowRunner.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-flow-webhook-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = req.headers.get("x-flow-webhook-token") || url.searchParams.get("token");

    if (!token) {
      return new Response(JSON.stringify({ error: "Token do webhook ausente" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: trigger, error } = await supabase
      .from("agent_flow_triggers")
      .select("id, flow_id, default_input, room_id, agent_flows!inner(user_id, name)")
      .eq("trigger_type", "webhook")
      .eq("enabled", true)
      .eq("webhook_token", token)
      .maybeSingle();

    if (error) throw error;
    if (!trigger) {
      return new Response(JSON.stringify({ error: "Token inválido ou gatilho desabilitado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let initialInput = "";
    const rawBody = await req.text();
    if (rawBody) {
      try {
        const json = JSON.parse(rawBody);
        initialInput = (typeof json === "object" && json !== null && (json.input || json.initial_input)) || "";
        if (!initialInput && typeof json === "string") initialInput = json;
      } catch {
        initialInput = rawBody;
      }
    }
    if (!initialInput) initialInput = trigger.default_input || "";

    if (!initialInput) {
      return new Response(JSON.stringify({ error: "Nenhum input fornecido e o gatilho não tem input padrão" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ownerId = (trigger as any).agent_flows?.user_id;
    const flowName = (trigger as any).agent_flows?.name || "Fluxo";
    if (!ownerId) throw new Error("Fluxo sem dono resolvido");

    const result = await runFlowHeadless(supabase, supabaseUrl, serviceKey, trigger.flow_id, ownerId, initialInput);

    if (!result.error && trigger.room_id) {
      await postFlowResultToRoom(supabase, {
        roomId: trigger.room_id, ownerId, flowName, executionId: result.execution_id, output: result.final_output,
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[flow-webhook-trigger] error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
