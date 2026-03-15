import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const userId = claimsData.claims.sub as string;
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const meetingId = body?.meeting_id as string | undefined;

    const RECALL_API_KEY = Deno.env.get("RECALL_API_KEY");
    if (!RECALL_API_KEY) {
      return new Response(JSON.stringify({ error: "RECALL_API_KEY is not configured" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let meetingsQuery = supabaseAdmin
      .from("meetings")
      .select("id, bot_id, status")
      .eq("user_id", userId)
      .in("status", ["pending", "recording"])
      .not("bot_id", "is", null);

    if (meetingId) {
      meetingsQuery = meetingsQuery.eq("id", meetingId);
    }

    const { data: meetings, error: meetingsError } = await meetingsQuery;
    if (meetingsError) {
      throw meetingsError;
    }

    let inspected = 0;
    let synced = 0;

    for (const meeting of meetings || []) {
      if (!meeting.bot_id) continue;
      inspected += 1;

      const botResponse = await fetch(`https://us-west-2.recall.ai/api/v1/bot/${meeting.bot_id}`, {
        headers: {
          Authorization: `Token ${RECALL_API_KEY}`,
        },
      });

      if (!botResponse.ok) {
        const detail = await botResponse.text();
        console.error(`Failed to fetch bot status [${botResponse.status}] for ${meeting.bot_id}:`, detail);
        continue;
      }

      const botData = await botResponse.json();
      const rawStatus = botData?.status?.code || botData?.status || botData?.state || "";
      const normalizedStatus = String(rawStatus).toLowerCase();

      const isDone = ["done", "call_ended", "recording_done", "completed"].includes(normalizedStatus);
      const isError = ["fatal", "error", "failed"].includes(normalizedStatus);

      if (!isDone && !isError) {
        continue;
      }

      const webhookPayload = {
        bot_id: meeting.bot_id,
        status: {
          code: isDone ? "done" : "error",
          message: isError ? botData?.status?.message || "Bot finalizado com erro" : undefined,
        },
        data: {
          bot_id: meeting.bot_id,
          status: {
            code: isDone ? "done" : "error",
            message: isError ? botData?.status?.message || "Bot finalizado com erro" : undefined,
          },
        },
      };

      const webhookResponse = await fetch(`${SUPABASE_URL}/functions/v1/meeting-webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload),
      });

      if (!webhookResponse.ok) {
        const detail = await webhookResponse.text();
        console.error(`Webhook sync failed [${webhookResponse.status}] for ${meeting.bot_id}:`, detail);
        continue;
      }

      synced += 1;
    }

    return new Response(JSON.stringify({ ok: true, inspected, synced }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("meeting-sync error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
