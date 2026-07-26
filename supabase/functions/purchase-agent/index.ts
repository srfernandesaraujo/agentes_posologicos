import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check with anon client
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { agentId } = await req.json();
    if (!agentId) {
      return new Response(JSON.stringify({ error: "agentId é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use service role for all DB operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get agent info
    const { data: agent, error: agentError } = await adminClient
      .from("custom_agents")
      .select("id, user_id, name, published_to_marketplace, status")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      return new Response(JSON.stringify({ error: "Agente não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!agent.published_to_marketplace || agent.status !== "published") {
      return new Response(JSON.stringify({ error: "Agente não está disponível no marketplace" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (agent.user_id === user.id) {
      return new Response(JSON.stringify({ error: "Você não pode comprar seu próprio agente" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Check if already purchased
    const { data: existing } = await adminClient
      .from("purchased_agents")
      .select("id")
      .eq("buyer_id", user.id)
      .eq("agent_id", agentId)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "Você já adquiriu este agente" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3+4. Debit buyer atomically (-5) — checks balance and debits in one transaction
    // (see spend_credits migration), closing the race the old check-then-insert had.
    try {
      await adminClient.rpc("spend_credits", {
        p_user_id: user.id,
        p_amount: 5,
        p_description: `Compra do agente "${agent.name}" no Marketplace`,
        p_reference_id: `purchase-${agentId}`,
      });
    } catch (e: any) {
      if (String(e?.message || "").includes("INSUFFICIENT_CREDITS")) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Você precisa de 5 créditos." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw e;
    }

    try {
      // 5. Credit seller (+3)
      const { error: creditError } = await adminClient.from("credits_ledger").insert({
        user_id: agent.user_id,
        amount: 3,
        type: "bonus",
        description: `Venda do agente "${agent.name}" no Marketplace`,
        reference_id: `sale-${agentId}-${user.id}`,
      });
      if (creditError) throw creditError;

      // 6. Record purchase
      const { error: purchaseError } = await adminClient.from("purchased_agents").insert({
        buyer_id: user.id,
        agent_id: agentId,
        seller_id: agent.user_id,
      });
      if (purchaseError) throw purchaseError;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (postDebitError: any) {
      // The buyer paid but never got the purchase recorded (or the seller wasn't
      // credited) — refund the buyer immediately rather than leaving them shortchanged.
      await adminClient.from("credits_ledger").insert({
        user_id: user.id, amount: 5, type: "admin",
        description: `Estorno: falha ao concluir compra do agente "${agent.name}"`,
      });
      throw postDebitError;
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
