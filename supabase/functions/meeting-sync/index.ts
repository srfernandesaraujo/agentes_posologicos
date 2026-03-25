import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DONE_STATUSES = new Set(["done", "call_ended", "recording_done", "completed", "analysis_done"]);
const ERROR_STATUSES = new Set(["fatal", "error", "failed", "analysis_failed"]);
const RETRYABLE_TRANSCRIPT_STATUS = new Set([404, 408, 409, 423, 425, 429, 500, 502, 503, 504]);
const FETCH_TIMEOUT_MS = 8000;
const MAX_TRANSCRIBING_WAIT_MS = 15 * 60 * 1000;

const normalizeRecallStatus = (value: unknown): string => {
  if (!value) return "";
  return String(value).toLowerCase().trim().replace(/^bot\./, "");
};

const isDoneStatus = (s: string): boolean => {
  if (!s) return false;
  return DONE_STATUSES.has(s) || s.includes("call_ended") || s.endsWith("_done") || s === "left_call" || s.includes("completed");
};

const isErrorStatus = (s: string): boolean => {
  if (!s) return false;
  return ERROR_STATUSES.has(s) || s.includes("fatal") || s.includes("error") || s.includes("failed");
};

const hasExceededWait = (updatedAt: string | null | undefined): boolean => {
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() > MAX_TRANSCRIBING_WAIT_MS;
};

const shouldRetryNow = (updatedAt: string | null | undefined): boolean => {
  if (!updatedAt) return true;
  return Date.now() - new Date(updatedAt).getTime() > 20000;
};

// ---------- Recall.ai helpers ----------

const fetchRecallJson = async (urls: string[], apiKey: string) => {
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Token ${apiKey}`, Accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (res.ok) return { ok: true as const, data: await res.json() };
      const msg = await res.text();
      console.error(`[meeting-sync] fetch ${res.status} ${url}:`, msg.slice(0, 200));
    } catch (e) {
      console.error(`[meeting-sync] fetch error ${url}:`, e instanceof Error ? e.message : e);
    }
  }
  return { ok: false as const };
};

const extractBotStatus = (botData: any): string => {
  const history = Array.isArray(botData?.status_changes)
    ? botData.status_changes.map((c: any) => normalizeRecallStatus(c?.code || c?.event || c?.status?.code)).filter(Boolean)
    : [];
  const candidates = [botData?.status?.code, botData?.status?.event, botData?.status, botData?.state, botData?.event, botData?.latest_status?.code, history[history.length - 1]]
    .map(normalizeRecallStatus).filter(Boolean);
  return candidates[0] || "";
};

const extractTranscriptShortcut = (botData: any): any | null => {
  const recordings = Array.isArray(botData?.recordings) ? botData.recordings : [];
  for (let i = recordings.length - 1; i >= 0; i--) {
    const sc = recordings[i]?.media_shortcuts?.transcript;
    if (sc) return sc;
  }
  return botData?.media_shortcuts?.transcript || null;
};

const fetchTranscript = async (botId: string, apiKey: string): Promise<{ ok: true; data: any } | { ok: false; retryable: boolean; message: string }> => {
  const botResult = await fetchRecallJson(
    [`https://us-west-2.recall.ai/api/v1/bot/${botId}/`, `https://us-west-2.recall.ai/api/v1/bot/${botId}`],
    apiKey
  );
  if (!botResult.ok) return { ok: false, retryable: true, message: "Failed to fetch bot data" };

  const shortcut = extractTranscriptShortcut(botResult.data);
  if (!shortcut) return { ok: false, retryable: true, message: "Transcript shortcut not available yet" };

  let downloadUrl = shortcut?.data?.download_url as string | undefined;
  const transcriptStatus = normalizeRecallStatus(shortcut?.status?.code);

  if (!downloadUrl && shortcut?.id) {
    const tResult = await fetchRecallJson(
      [`https://us-west-2.recall.ai/api/v1/transcript/${shortcut.id}/`, `https://us-west-2.recall.ai/api/v1/transcript/${shortcut.id}`],
      apiKey
    );
    if (tResult.ok) downloadUrl = tResult.data?.data?.download_url;
    else return { ok: false, retryable: true, message: "Transcript endpoint not ready" };
  }

  if (transcriptStatus && transcriptStatus !== "done") {
    return { ok: false, retryable: transcriptStatus !== "failed", message: `Transcript status: ${transcriptStatus}` };
  }

  if (!downloadUrl) return { ok: false, retryable: true, message: "No download URL yet" };

  // Fetch actual transcript data
  for (const withAuth of [false, true]) {
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (withAuth) headers.Authorization = `Token ${apiKey}`;
      const res = await fetch(downloadUrl, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (res.ok) return { ok: true, data: await res.json() };
      const detail = await res.text();
      if (!withAuth) continue; // try with auth
      const retryable = RETRYABLE_TRANSCRIPT_STATUS.has(res.status) || detail.toLowerCase().includes("not ready") || detail.toLowerCase().includes("pending");
      return { ok: false, retryable, message: detail.slice(0, 200) };
    } catch (e) {
      if (withAuth) return { ok: false, retryable: true, message: e instanceof Error ? e.message : "fetch error" };
    }
  }
  return { ok: false, retryable: true, message: "All transcript fetch attempts failed" };
};

const parseTranscriptText = (data: any): string => {
  if (Array.isArray(data)) {
    return data.map((seg: any) => {
      const speaker = seg?.participant?.name || seg?.speaker || "Speaker";
      const words = Array.isArray(seg?.words) ? seg.words.map((w: any) => w?.text).filter(Boolean).join(" ") : seg?.text || "";
      return `${speaker}: ${words}`;
    }).join("\n\n");
  }
  if (typeof data === "string") return data;
  return JSON.stringify(data);
};

// ---------- Main handler ----------

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
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const meetingId = body?.meeting_id as string | undefined;

    const RECALL_API_KEY = Deno.env.get("RECALL_API_KEY");
    if (!RECALL_API_KEY) {
      return new Response(JSON.stringify({ error: "RECALL_API_KEY not configured" }), { status: 500, headers: corsHeaders });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Query meetings in all active statuses
    let query = supabaseAdmin
      .from("meetings")
      .select("id, bot_id, status, transcript, summary, created_at, updated_at, user_id")
      .eq("user_id", userId)
      .in("status", ["pending", "recording", "transcribing", "summarizing"])
      .not("bot_id", "is", null);

    if (meetingId) query = query.eq("id", meetingId);

    const { data: meetings, error: meetingsError } = await query;
    if (meetingsError) throw meetingsError;

    let synced = 0;

    for (const meeting of meetings || []) {
      if (!meeting.bot_id) continue;

      // ---- PENDING / RECORDING: check bot status from Recall ----
      if (meeting.status === "pending" || meeting.status === "recording") {
        const botResult = await fetchRecallJson(
          [`https://us-west-2.recall.ai/api/v1/bot/${meeting.bot_id}/`, `https://us-west-2.recall.ai/api/v1/bot/${meeting.bot_id}`],
          RECALL_API_KEY
        );
        if (!botResult.ok) continue;

        const status = extractBotStatus(botResult.data);
        const endedAt = botResult.data?.ended_at || botResult.data?.left_at || botResult.data?.completed_at;
        const done = isDoneStatus(status) || (!isErrorStatus(status) && Boolean(endedAt));
        const error = isErrorStatus(status);

        if (done) {
          await supabaseAdmin.from("meetings").update({ status: "transcribing", error_message: null }).eq("id", meeting.id);
          synced++;
        } else if (error) {
          const msg = botResult.data?.status?.message || botResult.data?.error || "Bot finalizado com erro";
          await supabaseAdmin.from("meetings").update({ status: "error", error_message: msg }).eq("id", meeting.id);
          synced++;
        }
        continue; // Only one API call per meeting per cycle
      }

      // ---- TRANSCRIBING: fetch transcript from Recall ----
      if (meeting.status === "transcribing") {
        if (hasExceededWait(meeting.updated_at)) {
          await supabaseAdmin.from("meetings").update({
            status: "error",
            error_message: "Transcrição indisponível no Recall.ai após 15 minutos. Tente novamente mais tarde.",
          }).eq("id", meeting.id);
          synced++;
          continue;
        }

        if (!shouldRetryNow(meeting.updated_at)) continue;

        const result = await fetchTranscript(meeting.bot_id, RECALL_API_KEY);

        if (!result.ok) {
          if (!result.retryable) {
            await supabaseAdmin.from("meetings").update({
              status: "error",
              error_message: `Falha na transcrição: ${result.message}`,
            }).eq("id", meeting.id);
            synced++;
          }
          // If retryable, just skip — next cycle will try again
          continue;
        }

        const transcript = parseTranscriptText(result.data);

        if (!transcript || transcript.trim().length < 10) {
          await supabaseAdmin.from("meetings").update({
            status: "error",
            transcript: transcript || "",
            error_message: "Transcrição vazia ou muito curta. Verifique se houve áudio na reunião.",
          }).eq("id", meeting.id);
          synced++;
          continue;
        }

        const maxChars = 80000;
        const truncated = transcript.length > maxChars ? transcript.slice(0, maxChars) + "\n\n[...transcrição truncada]" : transcript;

        await supabaseAdmin.from("meetings").update({
          transcript: truncated,
          status: "summarizing",
          error_message: null,
        }).eq("id", meeting.id);
        synced++;
        continue; // Done for this cycle — summary will happen in next cycle
      }

      // ---- SUMMARIZING: generate summary via AI ----
      if (meeting.status === "summarizing") {
        if (!meeting.transcript || meeting.transcript.trim().length < 10) {
          await supabaseAdmin.from("meetings").update({ status: "error", error_message: "Sem transcrição para gerar ata." }).eq("id", meeting.id);
          synced++;
          continue;
        }

        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (!LOVABLE_API_KEY) {
          await supabaseAdmin.from("meetings").update({
            status: "done",
            summary: "Ata não gerada: LOVABLE_API_KEY não configurada. Transcrição disponível.",
          }).eq("id", meeting.id);
          synced++;
          continue;
        }

        try {
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
### Resumo Executivo
### Pontos Discutidos
### Decisões Tomadas
### Tarefas e Próximos Passos
### Observações Adicionais

Use formatação Markdown. Seja conciso mas completo.`,
                },
                {
                  role: "user",
                  content: `Gere a ata da seguinte reunião:\n\n${meeting.transcript}`,
                },
              ],
            }),
            signal: AbortSignal.timeout(30000),
          });

          if (!aiResponse.ok) {
            const errText = await aiResponse.text();
            console.error("[meeting-sync] AI error:", aiResponse.status, errText.slice(0, 200));
            await supabaseAdmin.from("meetings").update({
              status: "done",
              summary: "Erro ao gerar ata automaticamente. Transcrição disponível para consulta manual.",
            }).eq("id", meeting.id);
            synced++;
            continue;
          }

          const aiData = await aiResponse.json();
          const summary = aiData.choices?.[0]?.message?.content || "Não foi possível gerar a ata.";

          await supabaseAdmin.from("meetings").update({
            status: "done",
            summary,
            error_message: null,
          }).eq("id", meeting.id);
          synced++;
        } catch (e) {
          console.error("[meeting-sync] AI call failed:", e instanceof Error ? e.message : e);
          // Don't mark as error — just let next cycle retry
        }
        continue;
      }
    }

    return new Response(JSON.stringify({ ok: true, synced, total: meetings?.length || 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[meeting-sync] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
