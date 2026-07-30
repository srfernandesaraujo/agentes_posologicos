import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { attemptId, items, feedback } = await req.json();
    if (!attemptId) return json({ error: "attemptId obrigatório" }, 400);
    if (!Array.isArray(items) || items.length === 0) return json({ error: "items obrigatório" }, 400);

    const authHeader = req.headers.get("Authorization") || "";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);

    const { data: attempt } = await admin
      .from("osce_attempts")
      .select("id, station_id")
      .eq("id", attemptId)
      .maybeSingle();
    if (!attempt) return json({ error: "Tentativa não encontrada" }, 404);

    const { data: station } = await admin
      .from("osce_stations")
      .select("user_id")
      .eq("id", attempt.station_id)
      .maybeSingle();
    const { data: isGlobalAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const isStationOwner = station?.user_id === user.id;
    if (!isStationOwner && !isGlobalAdmin) {
      return json({ error: "Apenas o dono da estação (ou um admin) pode avaliar esta tentativa" }, 403);
    }

    const score = items.reduce((s: number, i: any) => s + (Number(i.score) || 0), 0);
    const maxScore = items.reduce((s: number, i: any) => s + (Number(i.max_score) || 0), 0);

    const { data: rating, error } = await admin.from("osce_attempt_ratings").insert({
      attempt_id: attemptId,
      rater_id: user.id,
      rater_type: "human",
      items,
      score,
      max_score: maxScore,
      feedback: String(feedback || ""),
    }).select().single();
    if (error) return json({ error: error.message }, 500);

    return json({ rating });
  } catch (e: any) {
    console.error("osce-submit-rating error:", e);
    return json({ error: e?.message || "Erro desconhecido" }, 500);
  }
});
