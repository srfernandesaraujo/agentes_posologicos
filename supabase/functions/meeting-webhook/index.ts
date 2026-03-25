import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DONE_STATUSES = new Set(["done", "call_ended", "recording_done", "completed", "analysis_done"]);
const ERROR_STATUSES = new Set(["fatal", "error", "failed", "analysis_failed", "recording_permission_denied"]);

const normalizeStatus = (value: unknown): string => {
  if (!value) return "";
  return String(value).toLowerCase().trim().replace(/^bot\./, "");
};

const normalizeSubCode = (value: unknown): string => {
  if (!value) return "";
  return String(value).toLowerCase().trim();
};

const isDoneStatus = (status: string): boolean => {
  if (!status) return false;
  return DONE_STATUSES.has(status) || status.includes("call_ended") || status.endsWith("_done") || status === "left_call" || status.includes("completed");
};

const isErrorStatus = (status: string): boolean => {
  if (!status) return false;
  return ERROR_STATUSES.has(status) || status.includes("fatal") || status.includes("error") || status.includes("failed");
};

const FRIENDLY_ERROR_MESSAGES: Record<string, string> = {
  call_ended_by_platform_waiting_room_timeout: "O bot ficou tempo demais na sala de espera do Google Meet e não foi admitido a tempo.",
  timeout_exceeded_waiting_room: "O bot ficou na sala de espera por muito tempo e saiu automaticamente.",
  bot_kicked_from_waiting_room: "O bot foi removido da sala de espera pelo organizador.",
  bot_kicked_from_call: "O bot foi removido da reunião pelo organizador.",
  timeout_exceeded_recording_permission_denied: "A gravação não foi autorizada a tempo no Google Meet.",
  recording_permission_denied: "A permissão de gravação foi negada na reunião.",
  meeting_not_started: "A reunião ainda não havia começado quando o bot tentou entrar.",
  google_meet_bot_blocked: "O Google Meet bloqueou a entrada do bot nesta reunião.",
  google_meet_sign_in_failed: "O Recall.ai não conseguiu autenticar o bot do Google Meet.",
  google_meet_sign_in_captcha_failed: "O Google exigiu captcha para o bot entrar na reunião.",
  failed_to_launch_in_time: "O Recall.ai demorou demais para iniciar o bot.",
  bot_errored: "O bot encontrou um erro interno no Recall.ai.",
  fatal: "O bot encontrou um erro fatal antes de concluir a reunião.",
  error: "O bot finalizou com erro no provedor de reunião.",
};

const buildHelpfulErrorMessage = (statusCode: string, subCode: string, rawMessage: string) => {
  const parts: string[] = [];
  const friendly = FRIENDLY_ERROR_MESSAGES[subCode] || FRIENDLY_ERROR_MESSAGES[statusCode];
  if (friendly) parts.push(friendly);
  if (rawMessage && !parts.some((p) => p.toLowerCase() === rawMessage.toLowerCase())) parts.push(rawMessage);
  if (["call_ended_by_platform_waiting_room_timeout", "timeout_exceeded_waiting_room", "bot_kicked_from_waiting_room", "google_meet_bot_blocked", "recording_permission_denied", "timeout_exceeded_recording_permission_denied"].includes(subCode)) {
    parts.push("Abra o Google Meet, aceite o bot rapidamente e, se o Meet solicitar, autorize a gravação.");
  }
  return parts.filter(Boolean).join(" ") || "Bot finalizado com erro no Recall.ai.";
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    console.log("[meeting-webhook] Payload:", JSON.stringify(payload).slice(0, 500));

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const botId = payload.data?.bot_id || payload.bot_id || payload.id;
    const rawStatus = payload.data?.status?.code || payload.status?.code || payload.event || payload.type;
    const status = normalizeStatus(rawStatus);

    if (!botId) {
      console.log("[meeting-webhook] No bot_id, ignoring");
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
    }

    const { data: meeting } = await supabase.from("meetings").select("*").eq("bot_id", botId).maybeSingle();
    if (!meeting) {
      console.log("[meeting-webhook] No meeting for bot_id:", botId);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
    }

    if (isDoneStatus(status)) {
      // Simply mark as "transcribing" — meeting-sync will handle the rest
      console.log(`[meeting-webhook] Bot ${botId} done -> marking meeting ${meeting.id} as transcribing`);
      await supabase.from("meetings").update({ status: "transcribing", error_message: null }).eq("id", meeting.id);
    } else if (isErrorStatus(status)) {
      const botData = payload.data?.bot || payload.bot || null;
      const latestStatusChange = Array.isArray(botData?.status_changes) && botData.status_changes.length > 0
        ? botData.status_changes[botData.status_changes.length - 1] : null;

      const statusCode = normalizeStatus(payload.data?.status?.code || payload.status?.code || botData?.status?.code || latestStatusChange?.code || status);
      const subCode = normalizeSubCode(payload.data?.status?.sub_code || payload.status?.sub_code || botData?.status?.sub_code || latestStatusChange?.sub_code);
      const rawMessage = payload.data?.status?.message || payload.status?.message || botData?.status?.message || latestStatusChange?.message || botData?.error || "Erro no bot da reunião";
      const errorMessage = buildHelpfulErrorMessage(statusCode, subCode, rawMessage);

      console.error("[meeting-webhook] Error:", JSON.stringify({ botId, statusCode, subCode }).slice(0, 300));
      await supabase.from("meetings").update({ status: "error", error_message: errorMessage }).eq("id", meeting.id);
    } else {
      console.log("[meeting-webhook] Non-terminal status:", status || "unknown");
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[meeting-webhook] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
