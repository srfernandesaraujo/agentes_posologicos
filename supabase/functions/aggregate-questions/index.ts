import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const prompt = `Você recebeu uma lista de dúvidas anônimas de alunos durante uma aula. Agrupe-as por TEMA, eliminando duplicatas, e gere um resumo em pt-BR em formato Markdown com lista de tópicos curtos. Seja conciso (até 8 tópicos).\n\nDúvidas:\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você organiza dúvidas de alunos para o professor." },
          { role: "user", content: prompt },
        ],
      }),
    });
    const j = await r.json();
    const summary = j?.choices?.[0]?.message?.content || "Sem resumo.";
    return new Response(JSON.stringify({ summary }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});