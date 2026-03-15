import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DONE_STATUSES = new Set([
  "done",
  "call_ended",
  "recording_done",
  "completed",
  "analysis_done",
]);

const ERROR_STATUSES = new Set([
  "fatal",
  "error",
  "failed",
  "analysis_failed",
]);

const normalizeRecallStatus = (value: unknown): string => {
  if (!value) return "";
  return String(value).toLowerCase().trim().replace(/^bot\./, "");
};

const isDoneStatus = (status: string): boolean => {
  if (!status) return false;
  return (
    DONE_STATUSES.has(status) ||
    status.includes("call_ended") ||
    status.endsWith("_done") ||
    status === "left_call" ||
    status.includes("completed")
  );
};

const isErrorStatus = (status: string): boolean => {
  if (!status) return false;
  return (
    ERROR_STATUSES.has(status) ||
    status.includes("fatal") ||
    status.includes("error") ||
    status.includes("failed")
  );
};

const extractBotStatus = (botData: any): { status: string; history: string[] } => {
  const history = Array.isArray(botData?.status_changes)
    ? botData.status_changes
        .map((change: any) => normalizeRecallStatus(change?.code || change?.event || change?.status?.code))
        .filter(Boolean)
    : [];

  const latestHistoryStatus = history.length > 0 ? history[history.length - 1] : "";

  const candidates = [
    botData?.status?.code,
    botData?.status?.event,
    botData?.status,
    botData?.state,
    botData?.event,
    botData?.latest_status?.code,
    latestHistoryStatus,
  ]
    .map(normalizeRecallStatus)
    .filter(Boolean);

  return {
    status: candidates[0] || "",
    history,
  };
};

const fetchBotData = async (botId: string, recallApiKey: string): Promise<any | null> => {
  const urls = [
    `https://us-west-2.recall.ai/api/v1/bot/${botId}/`,
    `https://us-west-2.recall.ai/api/v1/bot/${botId}`,
  ];

  for (const url of urls) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Token ${recallApiKey}`,
      },
    });

    if (response.ok) {
      return await response.json();
    }

    const detail = await response.text();
    console.error(`[meeting-sync] Failed to fetch bot status [${response.status}] for ${botId} (${url}):`, detail);
  }

  return null;
};

const MAX_TRANSCRIBING_WAIT_MS = 15 * 60 * 1000;

const shouldRetryTranscribingNow = (updatedAt: string | null | undefined): boolean => {
  if (!updatedAt) return true;
  return Date.now() - new Date(updatedAt).getTime() > 20000;
};

const hasExceededTranscribingWait = (updatedAt: string | null | undefined): boolean => {
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() > MAX_TRANSCRIBING_WAIT_MS;
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
      .select("id, bot_id, status, created_at, updated_at")
      .eq("user_id", userId)
      .in("status", ["pending", "recording", "transcribing"])
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

      if (meeting.status === "transcribing" && hasExceededTranscribingWait(meeting.updated_at)) {
        const timeoutMinutes = Math.round(MAX_TRANSCRIBING_WAIT_MS / 60000);
        const { error: timeoutError } = await supabaseAdmin
          .from("meetings")
          .update({
            status: "error",
            error_message: `Transcrição indisponível no Recall.ai após ${timeoutMinutes} minutos. Tente novamente mais tarde.`,
          })
          .eq("id", meeting.id)
          .eq("status", "transcribing");

        if (timeoutError) {
          console.error(`[meeting-sync] Failed to mark timeout for meeting ${meeting.id}:`, timeoutError);
        } else {
          synced += 1;
        }

        continue;
      }

      if (meeting.status === "transcribing" && !shouldRetryTranscribingNow(meeting.updated_at)) {
        continue;
      }

      inspected += 1;

      const botData = await fetchBotData(meeting.bot_id, RECALL_API_KEY);
      if (!botData) {
        continue;
      }

      const { status: normalizedStatus, history } = extractBotStatus(botData);
      const finalStatus = normalizedStatus || (history.length > 0 ? history[history.length - 1] : "");

      const endedAt = botData?.ended_at || botData?.left_at || botData?.completed_at;
      const done = isDoneStatus(finalStatus) || (!isErrorStatus(finalStatus) && Boolean(endedAt));
      const error = isErrorStatus(finalStatus);

      if (!done && !error) {
        continue;
      }

      const webhookPayload = {
        bot_id: meeting.bot_id,
        status: {
          code: done ? "done" : "error",
          message: error
            ? botData?.status?.message || botData?.error || "Bot finalizado com erro"
            : undefined,
        },
        data: {
          bot_id: meeting.bot_id,
          status: {
            code: done ? "done" : "error",
            message: error
              ? botData?.status?.message || botData?.error || "Bot finalizado com erro"
              : undefined,
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
