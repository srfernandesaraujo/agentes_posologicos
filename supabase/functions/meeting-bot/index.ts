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
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !authUser?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = authUser.id;

    const { meet_link, title } = await req.json();
    if (!meet_link) {
      return new Response(JSON.stringify({ error: "meet_link is required" }), { status: 400, headers: corsHeaders });
    }

    // Validate Google Meet link
    const meetRegex = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/i;
    if (!meetRegex.test(meet_link.trim())) {
      return new Response(JSON.stringify({ error: "Invalid Google Meet link format" }), { status: 400, headers: corsHeaders });
    }

    const RECALL_API_KEY = Deno.env.get("RECALL_API_KEY");
    if (!RECALL_API_KEY) {
      return new Response(JSON.stringify({ error: "RECALL_API_KEY is not configured" }), { status: 500, headers: corsHeaders });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

    // Create bot via Recall.ai
    const webhookUrl = `${SUPABASE_URL}/functions/v1/meeting-webhook`;

    const recallResponse = await fetch("https://us-west-2.recall.ai/api/v1/bot", {
      method: "POST",
      headers: {
        Authorization: `Token ${RECALL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        meeting_url: meet_link.trim(),
        bot_name: "Agentes Posológicos - Ata",
        status_changes_webhook_url: webhookUrl,
        recording_config: {
          transcript: {
            provider: {
              recallai_streaming: {
                mode: "prioritize_low_latency",
                language_code: "pt",
              },
            },
          },
        },
        automatic_leave: {
          waiting_room_timeout: 600,
          noone_joined_timeout: 1200,
          in_call_not_recording_timeout: 900,
          recording_permission_denied_timeout: 180,
        },
      }),
    });

    const recallData = await recallResponse.json();

    if (!recallResponse.ok) {
      console.error("Recall.ai error:", recallResponse.status, JSON.stringify(recallData));
      return new Response(
        JSON.stringify({ error: "Failed to create meeting bot", details: recallData }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Save meeting record using service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: meeting, error: insertError } = await supabaseAdmin
      .from("meetings")
      .insert({
        user_id: userId,
        meet_link: meet_link.trim(),
        title: title || `Reunião ${new Date().toLocaleDateString("pt-BR")}`,
        bot_id: recallData.id,
        status: "recording",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save meeting" }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ meeting }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("meeting-bot error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
