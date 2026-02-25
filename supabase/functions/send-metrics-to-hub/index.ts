import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const hubServiceKey = Deno.env.get("HUB_SERVICE_KEY");
    const hubServiceId = Deno.env.get("HUB_SERVICE_ID");

    if (!hubServiceKey || !hubServiceId) {
      throw new Error("Missing HUB_SERVICE_KEY or HUB_SERVICE_ID secrets");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Total users (profiles)
    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    // Active users last 30 days (users who sent messages)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: activeSessions } = await supabase
      .from("chat_sessions")
      .select("user_id")
      .gte("created_at", thirtyDaysAgo);
    const activeUsers = new Set(activeSessions?.map((s) => s.user_id) || []).size;

    // AI requests today (messages with role='user' created today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: aiRequests } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("role", "user")
      .gte("created_at", todayStart.toISOString());

    // Total tokens used today
    const { data: todayMessages } = await supabase
      .from("messages")
      .select("tokens_used")
      .eq("role", "assistant")
      .gte("created_at", todayStart.toISOString());
    const aiTokensUsed = todayMessages?.reduce((sum, m) => sum + (m.tokens_used || 0), 0) || 0;

    const payload = {
      service_id: hubServiceId,
      total_users: totalUsers || 0,
      active_users: activeUsers,
      subscribers: 0,
      ai_requests: aiRequests || 0,
      ai_tokens_used: aiTokensUsed,
      ai_cost_usd: 0,
      revenue_usd: 0,
      mrr_usd: 0,
    };

    console.log("Sending metrics to hub:", JSON.stringify(payload));

    const hubResponse = await fetch(
      "https://slmnpcabhjsqithkmkxn.supabase.co/functions/v1/report-metrics",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-service-key": hubServiceKey,
        },
        body: JSON.stringify(payload),
      }
    );

    const hubBody = await hubResponse.text();

    if (!hubResponse.ok) {
      console.error(`Hub responded with ${hubResponse.status}: ${hubBody}`);
      throw new Error(`Hub error: ${hubResponse.status}`);
    }

    console.log("Metrics sent successfully:", hubBody);

    return new Response(JSON.stringify({ success: true, payload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending metrics:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
