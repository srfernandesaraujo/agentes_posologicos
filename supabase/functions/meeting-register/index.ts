import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !authUser?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = authUser.id;

    const { meet_link, title } = await req.json();
    if (!meet_link) {
      return new Response(JSON.stringify({ error: "meet_link is required" }), { status: 400, headers: corsHeaders });
    }

    const meetRegex = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/i;
    if (!meetRegex.test(meet_link.trim())) {
      return new Response(JSON.stringify({ error: "Invalid Google Meet link format" }), { status: 400, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: connection } = await supabaseAdmin
      .from("google_connections")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();

    if (!connection || connection.status !== "connected") {
      return new Response(JSON.stringify({ error: "google_not_connected" }), { status: 409, headers: corsHeaders });
    }

    const now = new Date().toISOString();
    const { data: meeting, error: insertError } = await supabaseAdmin
      .from("meetings")
      .insert({
        user_id: userId,
        meet_link: meet_link.trim(),
        title: title || `Reunião ${new Date().toLocaleDateString("pt-BR")}`,
        status: "pending",
        expected_start_at: now,
      })
      .select()
      .single();

    if (insertError) {
      console.error("meeting-register insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save meeting" }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ meeting }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("meeting-register error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
