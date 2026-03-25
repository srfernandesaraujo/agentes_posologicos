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
  "recording_permission_denied",
]);

const RETRYABLE_TRANSCRIPT_STATUS = new Set([404, 408, 409, 423, 425, 429, 500, 502, 503, 504]);
const MAX_TRANSCRIBING_WAIT_MS = 15 * 60 * 1000;

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

const hasTranscriptNotReadyMessage = (text: string): boolean => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return lower.includes("not ready") || lower.includes("pending") || lower.includes("processing");
};

const normalizeStatus = (value: unknown): string => {
  if (!value) return "";
  return String(value).toLowerCase().trim().replace(/^bot\./, "");
};

const normalizeSubCode = (value: unknown): string => {
  if (!value) return "";
  return String(value).toLowerCase().trim();
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
  if (rawMessage && !parts.some((part) => part.toLowerCase() === rawMessage.toLowerCase())) {
    parts.push(rawMessage);
  }

  if (
    ["call_ended_by_platform_waiting_room_timeout", "timeout_exceeded_waiting_room", "bot_kicked_from_waiting_room", "google_meet_bot_blocked", "recording_permission_denied", "timeout_exceeded_recording_permission_denied"].includes(subCode)
  ) {
    parts.push("Abra o Google Meet, aceite o bot rapidamente e, se o Meet solicitar, autorize a gravação.");
  }

  return parts.filter(Boolean).join(" ") || "Bot finalizado com erro no Recall.ai.";
};

const hasExceededTranscribingWait = (updatedAt: string | null | undefined): boolean => {
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() > MAX_TRANSCRIBING_WAIT_MS;
};

const FETCH_TIMEOUT_MS = 8000;

const fetchRecallJson = async (urls: string[], recallApiKey: string) => {
  let lastStatus = 0;
  let lastMessage = "";

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Token ${recallApiKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (response.ok) {
        return { ok: true as const, data: await response.json() };
      }

      lastStatus = response.status;
      lastMessage = await response.text();
    } catch (e) {
      console.error(`[meeting-webhook] fetch error for ${url}:`, e instanceof Error ? e.message : e);
      lastStatus = 408;
      lastMessage = e instanceof Error ? e.message : "Fetch timeout/error";
    }
  }

  return { ok: false as const, status: lastStatus, message: lastMessage };
};

const extractTranscriptShortcut = (botData: any): any | null => {
  const recordings = Array.isArray(botData?.recordings) ? botData.recordings : [];

  for (let i = recordings.length - 1; i >= 0; i -= 1) {
    const shortcut = recordings[i]?.media_shortcuts?.transcript;
    if (shortcut) return shortcut;
  }

  if (botData?.media_shortcuts?.transcript) {
    return botData.media_shortcuts.transcript;
  }

  return null;
};

const fetchTranscriptPayload = async (downloadUrl: string, recallApiKey: string) => {
  try {
    const directResponse = await fetch(downloadUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (directResponse.ok) {
      return { ok: true as const, data: await directResponse.json() };
    }
  } catch (e) {
    console.error("[meeting-webhook] transcript direct fetch error:", e instanceof Error ? e.message : e);
  }

  try {
    const authenticatedResponse = await fetch(downloadUrl, {
      headers: {
        Authorization: `Token ${recallApiKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (authenticatedResponse.ok) {
      return { ok: true as const, data: await authenticatedResponse.json() };
    }

    const detail = await authenticatedResponse.text();
    const retryable = RETRYABLE_TRANSCRIPT_STATUS.has(authenticatedResponse.status) || hasTranscriptNotReadyMessage(detail);

    return {
      ok: false as const,
      status: authenticatedResponse.status,
      message: detail,
      retryable,
    };
  } catch (e) {
    console.error("[meeting-webhook] transcript auth fetch error:", e instanceof Error ? e.message : e);
    return {
      ok: false as const,
      status: 408,
      message: e instanceof Error ? e.message : "Fetch timeout/error",
      retryable: true,
    };
  }
};

const fetchTranscript = async (botId: string, recallApiKey: string) => {
  const botResult = await fetchRecallJson(
    [
      `https://us-west-2.recall.ai/api/v1/bot/${botId}/`,
      `https://us-west-2.recall.ai/api/v1/bot/${botId}`,
    ],
    recallApiKey
  );

  if (!botResult.ok) {
    return {
      ok: false as const,
      status: botResult.status,
      message: botResult.message,
      retryable: RETRYABLE_TRANSCRIPT_STATUS.has(botResult.status),
    };
  }

  const transcriptShortcut = extractTranscriptShortcut(botResult.data);
  if (!transcriptShortcut) {
    return {
      ok: false as const,
      status: 404,
      message: "Transcript shortcut not available in bot recordings yet",
      retryable: true,
    };
  }

  let transcriptStatus = normalizeStatus(transcriptShortcut?.status?.code);
  let downloadUrl = transcriptShortcut?.data?.download_url as string | undefined;

  if (!downloadUrl && transcriptShortcut?.id) {
    const transcriptResult = await fetchRecallJson(
      [
        `https://us-west-2.recall.ai/api/v1/transcript/${transcriptShortcut.id}/`,
        `https://us-west-2.recall.ai/api/v1/transcript/${transcriptShortcut.id}`,
      ],
      recallApiKey
    );

    if (transcriptResult.ok) {
      downloadUrl = transcriptResult.data?.data?.download_url;
      transcriptStatus = normalizeStatus(transcriptResult.data?.status?.code || transcriptStatus);
    } else {
      const retryable = RETRYABLE_TRANSCRIPT_STATUS.has(transcriptResult.status) || hasTranscriptNotReadyMessage(transcriptResult.message);
      return {
        ok: false as const,
        status: transcriptResult.status,
        message: transcriptResult.message,
        retryable,
      };
    }
  }

  if (transcriptStatus && transcriptStatus !== "done") {
    return {
      ok: false as const,
      status: transcriptStatus === "failed" ? 422 : 409,
      message: `Transcript status is ${transcriptStatus}`,
      retryable: transcriptStatus !== "failed",
    };
  }

  if (!downloadUrl) {
    return {
      ok: false as const,
      status: 404,
      message: "Transcript download URL not available yet",
      retryable: true,
    };
  }

  return await fetchTranscriptPayload(downloadUrl, recallApiKey);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    console.log("Webhook payload:", JSON.stringify(payload).slice(0, 500));

    const RECALL_API_KEY = Deno.env.get("RECALL_API_KEY");
    if (!RECALL_API_KEY) {
      return new Response(JSON.stringify({ error: "RECALL_API_KEY not configured" }), { status: 500, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const botId = payload.data?.bot_id || payload.bot_id || payload.id;
    const rawStatus = payload.data?.status?.code || payload.status?.code || payload.event || payload.type;
    const status = normalizeStatus(rawStatus);

    if (!botId) {
      console.log("No bot_id found in payload, ignoring");
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
    }

    const { data: meeting } = await supabase
      .from("meetings")
      .select("*")
      .eq("bot_id", botId)
      .maybeSingle();

    if (!meeting) {
      console.log("No meeting found for bot_id:", botId);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
    }

    if (isDoneStatus(status)) {
      const alreadyTranscribing = meeting.status === "transcribing";
      const transcribingSince = alreadyTranscribing ? meeting.updated_at : new Date().toISOString();

      if (!alreadyTranscribing || meeting.error_message) {
        await supabase.from("meetings").update({ status: "transcribing", error_message: null }).eq("id", meeting.id);
      }

      const transcriptResult = await fetchTranscript(botId, RECALL_API_KEY);

      if (!transcriptResult.ok) {
        if (transcriptResult.retryable) {
          if (hasExceededTranscribingWait(transcribingSince)) {
            const timeoutMinutes = Math.round(MAX_TRANSCRIBING_WAIT_MS / 60000);
            await supabase.from("meetings").update({
              status: "error",
              error_message: `Transcrição indisponível no Recall.ai após ${timeoutMinutes} minutos. Tente novamente mais tarde.`,
            }).eq("id", meeting.id);

            return new Response(
              JSON.stringify({ ok: true, transcript_timeout: true, detail: transcriptResult.message }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          return new Response(
            JSON.stringify({ ok: true, pending_transcript: true, detail: transcriptResult.message }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const suffix = transcriptResult.status ? ` (${transcriptResult.status})` : "";
        await supabase.from("meetings").update({
          status: "error",
          error_message: `Falha ao buscar transcrição no Recall.ai${suffix}`,
        }).eq("id", meeting.id);

        console.error("Failed to fetch transcript:", transcriptResult.status, transcriptResult.message);

        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
      }

      const transcriptData = transcriptResult.data;

      let transcript = "";
      if (Array.isArray(transcriptData)) {
        transcript = transcriptData
          .map((segment: any) => {
            const participantName = segment?.participant?.name;
            const speaker = participantName || segment?.speaker || "Speaker";
            const words = Array.isArray(segment?.words)
              ? segment.words.map((w: any) => w?.text).filter(Boolean).join(" ")
              : segment?.text || "";
            return `${speaker}: ${words}`;
          })
          .join("\n\n");
      } else if (typeof transcriptData === "string") {
        transcript = transcriptData;
      } else {
        transcript = JSON.stringify(transcriptData);
      }

      if (!transcript || transcript.trim().length < 10) {
        await supabase.from("meetings").update({
          status: "error",
          transcript: transcript || "",
          error_message: "Transcrição vazia ou muito curta. Verifique se houve áudio na reunião.",
        }).eq("id", meeting.id);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
      }

      const maxChars = 80000;
      const truncatedTranscript = transcript.length > maxChars ? transcript.slice(0, maxChars) + "\n\n[...transcrição truncada]" : transcript;

      await supabase.from("meetings").update({
        transcript: truncatedTranscript,
        status: "summarizing",
        error_message: null,
      }).eq("id", meeting.id);

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        await supabase.from("meetings").update({
          status: "done",
          summary: "Ata não gerada: LOVABLE_API_KEY não configurada. Transcrição disponível.",
        }).eq("id", meeting.id);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
      }

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `Você é um assistente especializado em criar atas de reunião profissionais. 
Analise a transcrição fornecida e gere uma ata estruturada com:

## Ata da Reunião

### Participantes
- Liste os participantes identificados

### Resumo Executivo
- Um parágrafo resumindo os principais pontos

### Pontos Discutidos
- Liste os principais tópicos abordados com detalhes relevantes

### Decisões Tomadas
- Liste as decisões que foram tomadas durante a reunião

### Tarefas e Próximos Passos
- Liste as tarefas atribuídas, responsáveis e prazos mencionados

### Observações Adicionais
- Qualquer informação relevante adicional

Use formatação Markdown. Seja conciso mas completo.`,
            },
            {
              role: "user",
              content: `Gere a ata da seguinte reunião:\n\n${truncatedTranscript}`,
            },
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI Gateway error:", aiResponse.status, errText);
        await supabase.from("meetings").update({
          status: "done",
          summary: "Erro ao gerar ata automaticamente. Transcrição disponível para consulta manual.",
        }).eq("id", meeting.id);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
      }

      const aiData = await aiResponse.json();
      const summary = aiData.choices?.[0]?.message?.content || "Não foi possível gerar a ata.";

      await supabase.from("meetings").update({
        status: "done",
        summary,
        error_message: null,
      }).eq("id", meeting.id);

    } else if (isErrorStatus(status)) {
      const botResult = await fetchRecallJson(
        [
          `https://us-west-2.recall.ai/api/v1/bot/${botId}/`,
          `https://us-west-2.recall.ai/api/v1/bot/${botId}`,
        ],
        RECALL_API_KEY
      );

      const botData = botResult.ok ? botResult.data : payload.data?.bot || payload.bot || null;
      const latestStatusChange = Array.isArray(botData?.status_changes) && botData.status_changes.length > 0
        ? botData.status_changes[botData.status_changes.length - 1]
        : null;

      const statusCode = normalizeStatus(
        payload.data?.status?.code || payload.status?.code || botData?.status?.code || latestStatusChange?.code || status
      );
      const subCode = normalizeSubCode(
        payload.data?.status?.sub_code || payload.status?.sub_code || botData?.status?.sub_code || latestStatusChange?.sub_code
      );
      const rawMessage =
        payload.data?.status?.message ||
        payload.status?.message ||
        botData?.status?.message ||
        latestStatusChange?.message ||
        botData?.error ||
        "Erro no bot da reunião";

      const errorMessage = buildHelpfulErrorMessage(statusCode, subCode, rawMessage);

      console.error("meeting-webhook bot error details:", JSON.stringify({ botId, statusCode, subCode, rawMessage }).slice(0, 500));

      await supabase.from("meetings").update({
        status: "error",
        error_message: errorMessage,
      }).eq("id", meeting.id);
    } else {
      console.log("Ignoring non-terminal status:", status || "unknown");
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("meeting-webhook error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
