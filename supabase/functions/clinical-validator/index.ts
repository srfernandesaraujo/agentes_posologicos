const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function openFdaLookup(drug: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`patient.drug.medicinalproduct:"${drug}"`);
    const r = await fetch(`https://api.fda.gov/drug/event.json?search=${q}&limit=1`);
    if (!r.ok) return null;
    const j = await r.json();
    const total = j?.meta?.results?.total;
    if (!total) return null;
    const reaction = j?.results?.[0]?.patient?.reaction?.[0]?.reactionmeddrapt;
    return `${total} eventos OpenFDA${reaction ? ` (ex: ${reaction})` : ""}`;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length < 15) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (text.length > 5000) {
      return new Response(JSON.stringify({ error: "Texto longo demais" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const schema = {
      type: "object",
      properties: {
        drugs: { type: "array", items: { type: "string" }, description: "Princípios ativos detectados (nome genérico em inglês quando possível)" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              level: { type: "string", enum: ["green", "yellow", "red"] },
              category: { type: "string", enum: ["interacao", "dose", "renal", "hepatico", "alergia", "gestacao", "outro"] },
              label: { type: "string", description: "Resumo curto (max 80 chars)" },
              detail: { type: "string", description: "Explicação clínica em 1-2 frases" },
              source: { type: "string", description: "Fonte/diretriz (Micromedex, UpToDate, Sanford, ANVISA, etc.) ou 'LLM'" },
            },
            required: ["level", "category", "label", "detail", "source"],
          },
        },
      },
      required: ["drugs", "items"],
    };

    const r = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um validador clínico de segurança. Analise prescrições/condutas e identifique: interações graves, doses fora de faixa, ajustes renais/hepáticos, contraindicações, alergias e alertas. Use níveis: red=risco grave/imediato, yellow=atenção/verificar, green=ok ou informativo positivo. Seja conciso. Não invente. Se não houver problemas, retorne items vazio. Português." },
          { role: "user", content: `Analise este texto clínico:\n\n${text}` },
        ],
        tools: [{ type: "function", function: { name: "respond", parameters: schema } }],
        tool_choice: { type: "function", function: { name: "respond" } },
      }),
    });
    if (r.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições. Aguarde." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (r.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos da plataforma esgotados." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Gateway ${r.status}: ${t.slice(0, 200)}`);
    }
    const j = await r.json();
    const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { drugs: [], items: [] };

    // Enrich with OpenFDA (top 3 drugs)
    const drugs = (parsed.drugs || []).slice(0, 3);
    const fdaResults = await Promise.all(drugs.map((d: string) => openFdaLookup(d)));
    const fdaItems = drugs.map((d: string, i: number) => fdaResults[i] ? {
      level: "yellow",
      category: "outro",
      label: `${d}: ${fdaResults[i]}`,
      detail: `Consulte OpenFDA para detalhes de farmacovigilância pós-comercialização de ${d}.`,
      source: `OpenFDA|https://open.fda.gov/apis/drug/event/searchable-fields/`,
    } : null).filter(Boolean);

    return new Response(JSON.stringify({
      drugs,
      items: [...(parsed.items || []), ...fdaItems],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("clinical-validator error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro desconhecido", items: [] }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});