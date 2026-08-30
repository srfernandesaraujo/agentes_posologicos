import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrderedKeysWithAdminFallback, callWithFallback, logAiUsage } from "./llmProvider.ts";
import {
  getValidAccessToken,
  findMeetRecordingsFolderId,
  listRecentMeetDocs,
  exportDocAsText,
  GoogleNotConnectedError,
  GoogleReauthRequiredError,
} from "./googleOAuth.ts";

const MAX_PENDING_WAIT_MS = 60 * 60 * 1000; // give up matching a Drive doc after 1h
const MATCH_WINDOW_MS = 30 * 60 * 1000; // tolerance around expected_start_at
const MAX_TRANSCRIBING_WAIT_MS = 15 * 60 * 1000;
const MAX_DOC_LOOKBACK_MS = 48 * 60 * 60 * 1000; // only consider docs created in the last 48h

const NOT_FOUND_ERROR_MESSAGE =
  "Não encontramos a ata do Gemini para esta reunião no Google Drive em até 1h. Confirme se \"Fazer anotações com o Gemini\" e \"Transcrever a reunião\" estavam ativados no Meet e se você era o organizador da chamada.";

const MEETING_MINUTES_PROMPT = `Você é um assistente especializado em criar atas de reunião profissionais.
Analise a transcrição fornecida e gere uma ata estruturada com:

## Ata da Reunião

### Participantes
### Resumo Executivo
### Pontos Discutidos
### Decisões Tomadas
### Tarefas e Próximos Passos
### Observações Adicionais

Use formatação Markdown. Seja conciso mas completo.`;

function hasExceededWait(sinceIso: string | null | undefined, maxMs: number): boolean {
  if (!sinceIso) return false;
  return Date.now() - new Date(sinceIso).getTime() > maxMs;
}

async function markPendingAsError(supabaseAdmin: SupabaseClient, meetingId: string) {
  await supabaseAdmin
    .from("meetings")
    .update({ status: "error", error_message: NOT_FOUND_ERROR_MESSAGE })
    .eq("id", meetingId)
    .eq("status", "pending");
}

async function matchPendingMeetings(supabaseAdmin: SupabaseClient, userId: string, pending: any[]): Promise<number> {
  let synced = 0;
  let accessToken: string;

  try {
    accessToken = await getValidAccessToken(supabaseAdmin, userId);
  } catch (e) {
    // Not connected or reauth required: only fail meetings that have already timed out —
    // leave fresher ones pending in case the user reconnects in time.
    if (!(e instanceof GoogleNotConnectedError) && !(e instanceof GoogleReauthRequiredError)) throw e;
    for (const m of pending) {
      if (hasExceededWait(m.created_at, MAX_PENDING_WAIT_MS)) {
        await supabaseAdmin
          .from("meetings")
          .update({
            status: "error",
            error_message: "Conexão com o Google indisponível. Reconecte sua conta em Reuniões e registre novamente.",
          })
          .eq("id", m.id)
          .eq("status", "pending");
        synced++;
      }
    }
    return synced;
  }

  const folderId = await findMeetRecordingsFolderId(supabaseAdmin, userId, accessToken);
  if (!folderId) {
    for (const m of pending) {
      if (hasExceededWait(m.created_at, MAX_PENDING_WAIT_MS)) {
        await markPendingAsError(supabaseAdmin, m.id);
        synced++;
      }
    }
    return synced;
  }

  const sinceIso = new Date(Date.now() - MAX_DOC_LOOKBACK_MS).toISOString();
  const docs = await listRecentMeetDocs(folderId, accessToken, sinceIso);

  const { data: usedRows } = await supabaseAdmin
    .from("meetings")
    .select("drive_file_id")
    .eq("user_id", userId)
    .not("drive_file_id", "is", null);
  const usedIds = new Set((usedRows || []).map((r: any) => r.drive_file_id as string));
  const candidates = docs.filter((d) => d.startedAt && !usedIds.has(d.id));

  for (const meeting of pending) {
    const anchor = meeting.expected_start_at
      ? new Date(meeting.expected_start_at).getTime()
      : new Date(meeting.created_at).getTime();

    let best: { doc: (typeof candidates)[number]; diff: number } | null = null;
    for (const doc of candidates) {
      if (usedIds.has(doc.id)) continue;
      const diff = Math.abs(doc.startedAt!.getTime() - anchor);
      if (diff <= MATCH_WINDOW_MS && (!best || diff < best.diff)) best = { doc, diff };
    }

    if (best) {
      // Conditional update guards against the client-side poller and the cron racing each other.
      const { data: updated } = await supabaseAdmin
        .from("meetings")
        .update({ status: "matched", drive_file_id: best.doc.id, matched_at: new Date().toISOString(), error_message: null })
        .eq("id", meeting.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (updated) {
        usedIds.add(best.doc.id);
        synced++;
      }
      continue;
    }

    if (hasExceededWait(meeting.created_at, MAX_PENDING_WAIT_MS)) {
      await markPendingAsError(supabaseAdmin, meeting.id);
      synced++;
    }
  }

  return synced;
}

async function transcribeMatchedMeeting(supabaseAdmin: SupabaseClient, meeting: any): Promise<boolean> {
  if (hasExceededWait(meeting.matched_at || meeting.updated_at, MAX_TRANSCRIBING_WAIT_MS)) {
    await supabaseAdmin
      .from("meetings")
      .update({ status: "error", error_message: "Não foi possível ler o documento no Google Drive após várias tentativas." })
      .eq("id", meeting.id)
      .eq("status", "matched");
    return true;
  }
  if (!meeting.drive_file_id) return false;

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(supabaseAdmin, meeting.user_id);
  } catch {
    return false; // retry next cycle
  }

  const text = await exportDocAsText(meeting.drive_file_id, accessToken);
  if (!text || text.trim().length < 10) return false; // doc might not be fully written yet — retry

  const maxChars = 80000;
  const truncated = text.length > maxChars ? text.slice(0, maxChars) + "\n\n[...transcrição truncada]" : text;

  const { data: updated } = await supabaseAdmin
    .from("meetings")
    .update({ transcript: truncated, status: "summarizing", error_message: null })
    .eq("id", meeting.id)
    .eq("status", "matched")
    .select("id")
    .maybeSingle();
  return Boolean(updated);
}

async function summarizeMeeting(supabaseAdmin: SupabaseClient, userId: string, meeting: any): Promise<boolean> {
  if (!meeting.transcript || meeting.transcript.trim().length < 10) {
    await supabaseAdmin.from("meetings").update({ status: "error", error_message: "Sem transcrição para gerar ata." }).eq("id", meeting.id);
    return true;
  }

  try {
    const orderedKeys = await getOrderedKeysWithAdminFallback(supabaseAdmin, userId);
    const result = await callWithFallback(supabaseAdmin, orderedKeys, {
      systemPrompt: MEETING_MINUTES_PROMPT,
      messages: [{ role: "user", content: `Gere a ata da seguinte reunião:\n\n${meeting.transcript}` }],
      mode: "text",
    });

    if (!result) {
      console.error("[meetingSyncCore] all AI providers failed");
      await supabaseAdmin
        .from("meetings")
        .update({ status: "done", summary: "Ata não gerada: nenhum provedor de IA disponível. Transcrição disponível para consulta manual." })
        .eq("id", meeting.id);
      return true;
    }

    await logAiUsage(supabaseAdmin, {
      userId,
      provider: result.provider!,
      model: result.model!,
      tokensInput: result.tokensInput,
      tokensOutput: result.tokensOutput,
      promptType: "meeting-sync",
    });

    await supabaseAdmin
      .from("meetings")
      .update({ status: "done", summary: result.output || "Não foi possível gerar a ata.", error_message: null })
      .eq("id", meeting.id);
    return true;
  } catch (e) {
    console.error("[meetingSyncCore] AI call failed:", e instanceof Error ? e.message : e);
    return false; // let next cycle retry
  }
}

export async function syncMeetingsForUser(supabaseAdmin: SupabaseClient, userId: string): Promise<{ synced: number; total: number }> {
  const { data: meetings, error } = await supabaseAdmin
    .from("meetings")
    .select("id, status, transcript, summary, drive_file_id, expected_start_at, matched_at, created_at, updated_at, user_id")
    .eq("user_id", userId)
    .in("status", ["pending", "matched", "transcribing", "summarizing"]);
  if (error) throw error;
  if (!meetings || meetings.length === 0) return { synced: 0, total: 0 };

  let synced = 0;

  const pending = meetings.filter((m: any) => m.status === "pending");
  if (pending.length > 0) synced += await matchPendingMeetings(supabaseAdmin, userId, pending);

  for (const meeting of meetings.filter((m: any) => m.status === "matched")) {
    if (await transcribeMatchedMeeting(supabaseAdmin, meeting)) synced++;
  }

  for (const meeting of meetings.filter((m: any) => m.status === "summarizing")) {
    if (await summarizeMeeting(supabaseAdmin, userId, meeting)) synced++;
  }

  return { synced, total: meetings.length };
}
