import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrderedKeysWithAdminFallback, callWithFallback, logAiUsage } from "./llmProvider.ts";
import { getValidAccessToken, exportDocAsText } from "./googleOAuth.ts";

const MAX_TRANSCRIBING_WAIT_MS = 15 * 60 * 1000;

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
    .in("status", ["matched", "transcribing", "summarizing"]);
  if (error) throw error;
  if (!meetings || meetings.length === 0) return { synced: 0, total: 0 };

  let synced = 0;

  for (const meeting of meetings.filter((m: any) => m.status === "matched")) {
    if (await transcribeMatchedMeeting(supabaseAdmin, meeting)) synced++;
  }

  for (const meeting of meetings.filter((m: any) => m.status === "summarizing")) {
    if (await summarizeMeeting(supabaseAdmin, userId, meeting)) synced++;
  }

  return { synced, total: meetings.length };
}
