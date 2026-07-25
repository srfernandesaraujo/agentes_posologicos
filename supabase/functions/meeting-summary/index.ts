import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrderedKeysForUser, callWithFallback, logAiUsage } from "../_shared/llmProvider.ts";

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

    const { meeting_id, custom_prompt } = await req.json();
    if (!meeting_id) {
      return new Response(JSON.stringify({ error: "meeting_id is required" }), { status: 400, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get meeting (verify ownership)
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from("meetings")
      .select("*")
      .eq("id", meeting_id)
      .eq("user_id", userId)
      .single();

    if (meetingError || !meeting) {
      return new Response(JSON.stringify({ error: "Meeting not found" }), { status: 404, headers: corsHeaders });
    }

    if (!meeting.transcript || meeting.transcript.trim().length < 10) {
      return new Response(JSON.stringify({ error: "No transcript available" }), { status: 400, headers: corsHeaders });
    }

    await supabaseAdmin.from("meetings").update({ status: "summarizing" }).eq("id", meeting_id);

    const systemPrompt = custom_prompt || `Você é um assistente especializado em criar atas de reunião profissionais.
Analise a transcrição fornecida e gere uma ata estruturada com:

## Ata da Reunião

### Participantes
### Resumo Executivo
### Pontos Discutidos
### Decisões Tomadas
### Tarefas e Próximos Passos
### Observações Adicionais

Use formatação Markdown. Seja conciso mas completo.`;

    const orderedKeys = await getOrderedKeysForUser(supabaseAdmin, userId);
    const result = await callWithFallback(supabaseAdmin, orderedKeys, {
      systemPrompt,
      messages: [{ role: "user", content: `Gere a ata da seguinte reunião:\n\n${meeting.transcript}` }],
      mode: "text",
    });

    if (!result) {
      console.error("meeting-summary: all providers failed");
      await supabaseAdmin.from("meetings").update({ status: "done" }).eq("id", meeting_id);
      return new Response(JSON.stringify({ error: "Failed to generate summary" }), { status: 500, headers: corsHeaders });
    }

    const summary = result.output || "Não foi possível gerar a ata.";
    await logAiUsage(supabaseAdmin, {
      userId,
      provider: result.provider!,
      model: result.model!,
      tokensInput: result.tokensInput,
      tokensOutput: result.tokensOutput,
      promptType: "meeting-summary",
    });

    await supabaseAdmin.from("meetings").update({ status: "done", summary }).eq("id", meeting_id);

    return new Response(JSON.stringify({ summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("meeting-summary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
