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

    // Handle status change webhook from Recall.ai
    const botId = payload.data?.bot_id || payload.bot_id || payload.id;
    const status = payload.data?.status?.code || payload.status?.code || payload.event;

    if (!botId) {
      console.log("No bot_id found in payload, ignoring");
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
    }

    // Find meeting by bot_id
    const { data: meeting } = await supabase
      .from("meetings")
      .select("*")
      .eq("bot_id", botId)
      .single();

    if (!meeting) {
      console.log("No meeting found for bot_id:", botId);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
    }

    // If bot is done / call ended, fetch transcript
    if (status === "done" || status === "call_ended" || status === "recording_done") {
      // Update status to transcribing
      await supabase.from("meetings").update({ status: "transcribing" }).eq("id", meeting.id);

      // Fetch transcript from Recall.ai
      const transcriptRes = await fetch(`https://us-west-2.recall.ai/api/v1/bot/${botId}/transcript`, {
        headers: { Authorization: `Token ${RECALL_API_KEY}` },
      });

      if (!transcriptRes.ok) {
        const errText = await transcriptRes.text();
        console.error("Failed to fetch transcript:", transcriptRes.status, errText);
        await supabase.from("meetings").update({
          status: "error",
          error_message: `Failed to fetch transcript: ${transcriptRes.status}`,
        }).eq("id", meeting.id);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
      }

      const transcriptData = await transcriptRes.json();

      // Format transcript text
      let transcript = "";
      if (Array.isArray(transcriptData)) {
        transcript = transcriptData
          .map((segment: any) => {
            const speaker = segment.speaker || "Speaker";
            const words = segment.words?.map((w: any) => w.text).join(" ") || segment.text || "";
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

      // Truncate if too long
      const maxChars = 80000;
      const truncatedTranscript = transcript.length > maxChars ? transcript.slice(0, maxChars) + "\n\n[...transcrição truncada]" : transcript;

      // Update transcript and status
      await supabase.from("meetings").update({
        transcript: truncatedTranscript,
        status: "summarizing",
      }).eq("id", meeting.id);

      // Generate summary via Lovable AI Gateway
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
      }).eq("id", meeting.id);

    } else if (status === "fatal" || status === "error") {
      await supabase.from("meetings").update({
        status: "error",
        error_message: payload.data?.status?.message || "Erro no bot da reunião",
      }).eq("id", meeting.id);
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
