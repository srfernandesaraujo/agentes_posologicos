import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrderedKeysWithAdminFallback, callWithFallback } from "../_shared/llmProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { questions } = await req.json() as { questions: string[] };
    if (!Array.isArray(questions) || questions.length === 0) {
      return new Response(JSON.stringify({ summary: "Nenhuma dúvida ainda." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const orderedKeys = await getOrderedKeysWithAdminFallback(admin, null);

    const prompt = `Você recebeu uma lista de dúvidas anônimas de alunos durante uma aula. Agrupe-as por TEMA, eliminando duplicatas, e gere um resumo em pt-BR em formato Markdown com lista de tópicos curtos. Seja conciso (até 8 tópicos).\n\nDúvidas:\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`;

    const result = await callWithFallback(admin, orderedKeys, {
      systemPrompt: "Você organiza dúvidas de alunos para o professor.",
      messages: [{ role: "user", content: prompt }],
      mode: "text",
    });

    const summary = result?.output || "Sem resumo.";
    return new Response(JSON.stringify({ summary }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
