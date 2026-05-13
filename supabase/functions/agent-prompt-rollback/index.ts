// Edge function: aprovar/rejeitar/reverter versões de prompt
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const { versionId, action } = await req.json();
    if (!versionId || !["activate", "reject"].includes(action)) {
      return json({ error: "versionId e action (activate|reject) obrigatórios" }, 400);
    }

    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: ver } = await svc.from("agent_prompt_versions").select("*").eq("id", versionId).maybeSingle();
    if (!ver) return json({ error: "version not found" }, 404);

    // Authorization
    const isAdmin = (await svc.rpc("has_role", { _user_id: user.id, _role: "admin" })).data === true;
    let allowed = isAdmin;
    if (!allowed && (ver as any).agent_type === "custom") {
      const { data: ag } = await svc.from("custom_agents").select("user_id").eq("id", (ver as any).agent_id).maybeSingle();
      if (ag && (ag as any).user_id === user.id) allowed = true;
    }
    if (!allowed) return json({ error: "forbidden" }, 403);

    if (action === "reject") {
      await svc.from("agent_prompt_versions").update({ status: "rejected" }).eq("id", versionId);
      return json({ ok: true });
    }

    // activate
    await svc.from("agent_prompt_versions")
      .update({ status: "archived" })
      .eq("agent_id", (ver as any).agent_id)
      .eq("agent_type", (ver as any).agent_type)
      .eq("status", "active");

    await svc.from("agent_prompt_versions")
      .update({ status: "active", activated_at: new Date().toISOString() })
      .eq("id", versionId);

    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
