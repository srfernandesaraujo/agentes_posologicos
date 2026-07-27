import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { getActivePlanTier } from "../_shared/planTier.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdminFlag } = await admin.rpc("has_role", { _user_id: caller.id, _role: "admin" });
    if (!isAdminFlag) return json({ error: "Sem permissão" }, 403);

    const targetUserId = String((await req.json().catch(() => ({})))?.userId || "");
    if (!targetUserId) return json({ error: "userId é obrigatório" }, 400);

    const { data: targetUserData, error: userErr } = await admin.auth.admin.getUserById(targetUserId);
    if (userErr || !targetUserData?.user) return json({ error: "Usuário não encontrado" }, 404);
    const targetUser = targetUserData.user;

    const [
      { data: ledger },
      { count: agentsCount },
      { count: roomsCount },
      { data: apiKeys },
      { data: recentUsage },
      { data: unlimited },
      { data: roleRow },
    ] = await Promise.all([
      admin.from("credits_ledger").select("amount").eq("user_id", targetUserId),
      admin.from("custom_agents").select("id", { count: "exact", head: true }).eq("user_id", targetUserId),
      admin.from("virtual_rooms").select("id", { count: "exact", head: true }).eq("user_id", targetUserId),
      admin.from("user_api_keys").select("provider, key_expires_at").eq("user_id", targetUserId),
      admin.from("ai_usage_log").select("provider, model, prompt_type, tokens_input, tokens_output, estimated_cost_usd, created_at")
        .eq("user_id", targetUserId).order("created_at", { ascending: false }).limit(10),
      admin.from("unlimited_users").select("id").eq("email", (targetUser.email || "").toLowerCase()).eq("is_active", true).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", targetUserId).eq("role", "admin").maybeSingle(),
    ]);

    const balance = (ledger || []).reduce((s: number, r: any) => s + Number(r.amount), 0);

    let planTier: string = "none";
    try {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
      planTier = await getActivePlanTier(stripe, targetUser.email || "");
    } catch (e) {
      console.warn("[admin-user-diagnostics] plan tier lookup failed:", e);
    }

    return json({
      email: targetUser.email,
      created_at: targetUser.created_at,
      last_sign_in_at: targetUser.last_sign_in_at,
      is_admin: !!roleRow,
      is_unlimited: !!unlimited,
      plan_tier: planTier,
      credits_balance: balance,
      custom_agents_count: agentsCount ?? 0,
      virtual_rooms_count: roomsCount ?? 0,
      api_keys: (apiKeys || []).map((k: any) => ({ provider: k.provider, expires_at: k.key_expires_at })),
      recent_ai_usage: recentUsage || [],
    });
  } catch (e: any) {
    console.error("admin-user-diagnostics error:", e);
    return json({ error: e?.message || "Erro desconhecido" }, 500);
  }
});
