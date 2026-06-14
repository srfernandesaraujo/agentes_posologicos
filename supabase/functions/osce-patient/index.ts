import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { stationId, history, userMessage } = await req.json();
    if (!stationId || !userMessage) {
      return new Response(JSON.stringify({ error: "stationId e userMessage obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: station } = await supabase
      .from("osce_stations")
      .select("title,patient_persona,patient_symptoms,patient_omissions,scenario_brief")
      .eq("id", stationId)
      .maybeSingle();
    if (!station) {
      return new Response(JSON.stringify({ error: "Estação não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um PACIENTE em uma simulação clínica OSCE. Responda SEMPRE em pt-BR, em primeira pessoa, com linguagem coloquial e realista, como uma pessoa leiga.

REGRAS CRÍTICAS:
- NUNCA quebre o personagem. Você é o paciente, não a IA.
- NUNCA mencione que é uma simulação, IA, modelo, ou que existe rubrica/avaliação.
- Responda APENAS o que o profissional perguntar. Não despeje informação não solicitada.
- Se ele perguntar algo vago, peça esclarecimento de forma humana ("Como assim, doutor?").
- OMISSÕES REALISTAS: só revele os itens da lista de omissões se o profissional perguntar especificamente.
- Demonstre emoções coerentes (dor, ansiedade, vergonha quando aplicável).
- Respostas curtas (1-4 frases). Sem listas, sem markdown.

## Cenário
${station.scenario_brief}

## Sua persona
${station.patient_persona}

## Seus sintomas e história
${station.patient_symptoms}

## Informações que você SÓ revela se perguntado diretamente (omissões)
${station.patient_omissions || "(nenhuma omissão específica)"}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(Array.isArray(history) ? history : []).map((m: any) => ({
        role: m.role === "patient" ? "assistant" : "user",
        content: String(m.content || ""),
      })),
      { role: "user", content: String(userMessage) },
    ];

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, temperature: 0.85 }),
    });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      return new Response(JSON.stringify({ error: "Falha na IA", detail: t }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await aiRes.json();
    const reply = data?.choices?.[0]?.message?.content || "...";
    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});