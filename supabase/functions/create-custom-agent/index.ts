import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { getActivePlanTier, tierAtLeast } from "../_shared/planTier.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AGENT_CREATION_COST = 5;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user?.email) return json({ error: "Não autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const mode: "manual" | "ai" = body?.mode === "ai" ? "ai" : "manual";
    const name = String(body?.name || "").trim();
    const description = String(body?.description || "").trim();
    const aiPrompt = String(body?.aiPrompt || "").trim();

    if (mode === "manual" && !name) return json({ error: "Nome é obrigatório" }, 400);
    if (mode === "ai" && !aiPrompt) return json({ error: "Descreva o que seu agente deve fazer" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    // Admin / unlimited users bypass both the plan-tier gate and the credit cost.
    const { data: isAdminFlag } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const { data: unlimited } = await admin
      .from("unlimited_users").select("id").eq("email", user.email.toLowerCase()).eq("is_active", true).maybeSingle();
    const hasFreeAccess = !!isAdminFlag || !!unlimited;

    if (!hasFreeAccess) {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
      const tier = await getActivePlanTier(stripe, user.email);
      if (!tierAtLeast(tier, "pro")) {
        return json({ error: "Agentes personalizados são exclusivos dos planos Pro e Institucional. Faça upgrade para criar o seu.", code: "PLAN_REQUIRED" }, 403);
      }
    }

    let systemPrompt = "";
    let finalName = name;
    let finalDescription = description;

    if (mode === "ai") {
      const r = await fetch(`${supabaseUrl}/functions/v1/agent-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ agentId: "__generate_prompt__", input: aiPrompt, userId: user.id }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.output) return json({ error: "Falha ao gerar agente com IA" }, 502);
      systemPrompt = String(data.output || "");
      const meta = data.agent_meta || {};
      finalName = (meta.name || name || aiPrompt.slice(0, 60)).trim();
      finalDescription = (meta.description || description || aiPrompt).trim();
    }

    if (!hasFreeAccess) {
      try {
        await admin.rpc("spend_credits", {
          p_user_id: user.id,
          p_amount: AGENT_CREATION_COST,
          p_description: mode === "ai" ? "Criação de agente personalizado (IA)" : "Criação de agente personalizado",
          p_type: "usage",
        });
      } catch (e: any) {
        const msg = String(e?.message || "");
        if (msg.includes("INSUFFICIENT_CREDITS")) {
          return json({ error: `Créditos insuficientes. Criar um agente custa ${AGENT_CREATION_COST} créditos.`, code: "INSUFFICIENT_CREDITS", required: AGENT_CREATION_COST }, 402);
        }
        throw e;
      }
    }

    const insertPayload: Record<string, unknown> = { user_id: user.id, name: finalName, description: finalDescription };
    if (mode === "ai") insertPayload.system_prompt = systemPrompt;

    const { data: agent, error: insErr } = await admin.from("custom_agents").insert(insertPayload).select().single();
    if (insErr) {
      // Compensate: the debit already landed, but the agent was never created.
      if (!hasFreeAccess) {
        await admin.from("credits_ledger").insert({
          user_id: user.id, amount: AGENT_CREATION_COST, type: "admin",
          description: "Estorno: falha ao criar agente personalizado",
        });
      }
      return json({ error: insErr.message }, 500);
    }

    return json({ agent });
  } catch (e: any) {
    console.error("create-custom-agent error:", e);
    return json({ error: e?.message || "Erro desconhecido" }, 500);
  }
});
