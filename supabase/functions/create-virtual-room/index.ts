import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { getActivePlanTier, PlanTier } from "../_shared/planTier.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROOM_AGENT_COST = 1;

// Rooms are open to every tier; only the *count* of active rooms is tier-limited
// (matches the pricing page's "Salas virtuais ilimitadas" claim for Institucional).
// Users with no active subscription (only credit packs) get the Básico cap.
const ROOM_LIMITS: Record<PlanTier, number> = {
  none: 3,
  basico: 3,
  pro: 10,
  institucional: Infinity,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
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
    const action: "create" | "link-agent" = body?.action === "link-agent" ? "link-agent" : "create";

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdminFlag } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const { data: unlimited } = await admin
      .from("unlimited_users").select("id").eq("email", user.email.toLowerCase()).eq("is_active", true).maybeSingle();
    const isAdmin = !!isAdminFlag || !!unlimited;

    if (action === "link-agent") {
      const roomId = String(body?.roomId || "");
      const agentId = String(body?.agentId || "");
      if (!roomId || !agentId) return json({ error: "roomId e agentId são obrigatórios" }, 400);

      const { data: room } = await admin.from("virtual_rooms").select("id, user_id").eq("id", roomId).maybeSingle();
      if (!room || room.user_id !== user.id) return json({ error: "Sala não encontrada" }, 404);

      if (!isAdmin) {
        try {
          await admin.rpc("spend_credits", {
            p_user_id: user.id,
            p_amount: ROOM_AGENT_COST,
            p_description: "Vincular agente a sala virtual (24h)",
          });
        } catch (e: any) {
          if (String(e?.message || "").includes("INSUFFICIENT_CREDITS")) {
            return json({ error: "Créditos insuficientes para vincular um agente à sala.", code: "INSUFFICIENT_CREDITS" }, 402);
          }
          throw e;
        }
      }

      const agentExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error: updErr } = await admin.from("virtual_rooms")
        .update({ agent_id: agentId, agent_expires_at: agentExpiresAt })
        .eq("id", roomId);
      if (updErr) {
        if (!isAdmin) {
          await admin.from("credits_ledger").insert({
            user_id: user.id, amount: ROOM_AGENT_COST, type: "admin",
            description: "Estorno: falha ao vincular agente à sala",
          });
        }
        return json({ error: updErr.message }, 500);
      }
      return json({ ok: true });
    }

    // action === "create"
    const name = String(body?.name || "").trim();
    const description = String(body?.description || "").trim();
    const agentId = body?.agentId && body.agentId !== "none" ? String(body.agentId) : null;
    const roomExpiresAt = body?.roomExpiresAt ? new Date(body.roomExpiresAt).toISOString() : null;
    const isActive = body?.isActive !== false;
    if (!name) return json({ error: "Nome é obrigatório" }, 400);

    let tier: PlanTier = "institucional";
    if (!isAdmin) {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
      tier = await getActivePlanTier(stripe, user.email);

      const { count } = await admin.from("virtual_rooms").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      const limit = ROOM_LIMITS[tier];
      if ((count || 0) >= limit) {
        return json({
          error: `Limite de salas do seu plano atingido (${limit}). Faça upgrade para criar mais salas virtuais.`,
          code: "ROOM_LIMIT_REACHED",
        }, 403);
      }
    }

    if (agentId && !isAdmin) {
      try {
        await admin.rpc("spend_credits", {
          p_user_id: user.id,
          p_amount: ROOM_AGENT_COST,
          p_description: "Vincular agente a sala virtual (24h)",
        });
      } catch (e: any) {
        if (String(e?.message || "").includes("INSUFFICIENT_CREDITS")) {
          return json({ error: "Créditos insuficientes para vincular um agente à sala.", code: "INSUFFICIENT_CREDITS" }, 402);
        }
        throw e;
      }
    }

    const { data: room, error: insErr } = await admin.from("virtual_rooms").insert({
      user_id: user.id,
      name,
      description,
      pin: generatePin(),
      agent_id: agentId,
      is_active: isActive,
      agent_expires_at: agentId ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
      room_expires_at: roomExpiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }).select().single();

    if (insErr) {
      if (agentId && !isAdmin) {
        await admin.from("credits_ledger").insert({
          user_id: user.id, amount: ROOM_AGENT_COST, type: "admin",
          description: "Estorno: falha ao criar sala virtual",
        });
      }
      return json({ error: insErr.message }, 500);
    }

    return json({ room });
  } catch (e: any) {
    console.error("create-virtual-room error:", e);
    return json({ error: e?.message || "Erro desconhecido" }, 500);
  }
});
