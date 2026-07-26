import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INSTALL_COST = 5;
const AUTHOR_ROYALTY = 2;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { flowId } = await req.json();
    if (!flowId) return new Response(JSON.stringify({ error: "flowId é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: flow, error: flowErr } = await admin.from("agent_flows").select("*").eq("id", flowId).single();
    if (flowErr || !flow) return new Response(JSON.stringify({ error: "Fluxo não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!flow.published) return new Response(JSON.stringify({ error: "Fluxo não está publicado" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (flow.user_id === user.id) return new Response(JSON.stringify({ error: "Você é o autor deste fluxo" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Already installed?
    const { data: existing } = await admin.from("flow_installs").select("id, installed_flow_id").eq("buyer_id", user.id).eq("source_flow_id", flowId).maybeSingle();
    if (existing) return new Response(JSON.stringify({ error: "Você já instalou este fluxo", installed_flow_id: existing.installed_flow_id }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Debit buyer first (atomic — see spend_credits migration) so the copy below can
    // never be handed out for free, even under concurrent installs.
    try {
      await admin.rpc("spend_credits", {
        p_user_id: user.id,
        p_amount: INSTALL_COST,
        p_description: `Instalação do fluxo "${flow.name}" do Marketplace`,
        p_reference_id: `flow-install-${flowId}`,
      });
    } catch (e: any) {
      if (String(e?.message || "").includes("INSUFFICIENT_CREDITS")) {
        return new Response(JSON.stringify({ error: `Créditos insuficientes. Precisa de ${INSTALL_COST}.` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw e;
    }

    try {
      // Deep copy flow
      const { data: newFlow, error: newFlowErr } = await admin.from("agent_flows").insert({
        user_id: user.id,
        name: `${flow.name} (cópia)`,
        description: flow.description,
        status: "draft",
        execution_mode: flow.execution_mode,
        input_type: flow.input_type,
        category: flow.category,
        forked_from: flow.id,
        published: false,
      }).select().single();
      if (newFlowErr) throw newFlowErr;

      const { data: nodes } = await admin.from("agent_flow_nodes").select("*").eq("flow_id", flowId);
      const idMap: Record<string, string> = {};
      if (nodes && nodes.length) {
        for (const n of nodes) {
          const { id: oldId, flow_id: _f, created_at: _c, ...rest } = n as any;
          const { data: ins, error: insErr } = await admin.from("agent_flow_nodes").insert({ ...rest, flow_id: newFlow.id }).select("id").single();
          if (insErr) throw insErr;
          idMap[oldId] = ins.id;
        }
      }
      const { data: edges } = await admin.from("agent_flow_edges").select("*").eq("flow_id", flowId);
      if (edges && edges.length) {
        const toInsert = edges.map((e: any) => ({
          flow_id: newFlow.id,
          source_node_id: idMap[e.source_node_id],
          target_node_id: idMap[e.target_node_id],
          branch_key: e.branch_key,
        })).filter((e: any) => e.source_node_id && e.target_node_id);
        if (toInsert.length) {
          const { error: edgeErr } = await admin.from("agent_flow_edges").insert(toInsert);
          if (edgeErr) throw edgeErr;
        }
      }

      // Credit author, record install, bump counter — the buyer already has their copy
      // at this point, so failures here are logged but don't fail the buyer's request.
      const { error: royaltyErr } = await admin.from("credits_ledger").insert({
        user_id: flow.user_id, amount: AUTHOR_ROYALTY, type: "bonus",
        description: `Royalty - instalação do fluxo "${flow.name}"`,
        reference_id: `flow-royalty-${flowId}-${user.id}`,
      });
      if (royaltyErr) console.error("[install-flow] royalty insert failed:", royaltyErr);

      const { error: installErr } = await admin.from("flow_installs").insert({
        source_flow_id: flowId, installed_flow_id: newFlow.id,
        buyer_id: user.id, seller_id: flow.user_id, credits_spent: INSTALL_COST,
      });
      if (installErr) console.error("[install-flow] flow_installs insert failed:", installErr);

      const { error: counterErr } = await admin.from("agent_flows").update({
        installs_count: (flow.installs_count || 0) + 1,
        creator_earnings: (flow.creator_earnings || 0) + AUTHOR_ROYALTY,
      }).eq("id", flowId);
      if (counterErr) console.error("[install-flow] counter update failed:", counterErr);

      return new Response(JSON.stringify({ success: true, installed_flow_id: newFlow.id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (copyError: any) {
      // The buyer paid but never got a working copy — refund immediately.
      await admin.from("credits_ledger").insert({
        user_id: user.id, amount: INSTALL_COST, type: "admin",
        description: `Estorno: falha ao instalar o fluxo "${flow.name}"`,
      });
      throw copyError;
    }
  } catch (e: any) {
    console.error("[install-flow] error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});