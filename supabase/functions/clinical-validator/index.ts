import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrderedKeysWithAdminFallback, callWithFallback } from "../_shared/llmProvider.ts";
import { deriveClinicalFacts, type ClinicalFact, type LabelSections } from "../_shared/drugLabelFacts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cap the number of drugs analyzed per request to bound fan-out to openFDA (pairwise
// interaction checks are O(n^2) in the number of drugs).
const MAX_DRUGS = 5;

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

// Fetches the official FDA-approved label sections for a drug (openFDA, sourced from
// DailyMed SPLs) — this is the primary source of truth for clinical facts; the LLM is
// only used to extract entity names (below) and to translate/condense this raw text.
async function fetchOpenFdaLabel(drug: string): Promise<LabelSections | null> {
  try {
    const q = encodeURIComponent(
      `openfda.generic_name:"${drug}" OR openfda.brand_name:"${drug}" OR openfda.substance_name:"${drug}"`,
    );
    const r = await fetch(`https://api.fda.gov/drug/label.json?search=${q}&limit=1`);
    if (!r.ok) return null;
    const j = await r.json();
    const result = j?.results?.[0];
    if (!result) return null;
    const setId: string | undefined = result.set_id || result?.openfda?.spl_set_id?.[0];
    const join = (field: string[] | undefined) => (field || []).join(" ");
    return {
      drug,
      contraindications: join(result.contraindications),
      drugInteractions: join(result.drug_interactions),
      warnings: join(result.warnings || result.warnings_and_cautions),
      boxedWarning: join(result.boxed_warning),
      pregnancy: join(result.pregnancy),
      setId,
    };
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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const orderedKeys = await getOrderedKeysWithAdminFallback(admin, null);

    // Step 1 — LLM used only for entity extraction (which drugs are mentioned), never for
    // clinical judgement. Kept as a small, narrow tool-call schema to minimize hallucination
    // surface: the model can misidentify a drug name, but it can no longer invent an alert.
    const extractionSchema = {
      type: "object",
      properties: {
        drugs: {
          type: "array",
          items: { type: "string" },
          description: "Princípios ativos mencionados no texto, em inglês (nome genérico/USAN), sem duplicatas.",
        },
      },
      required: ["drugs"],
    };
    const extraction = orderedKeys.length > 0
      ? await callWithFallback(admin, orderedKeys, {
        systemPrompt: "Você extrai apenas nomes de princípios ativos (drogas) mencionados em textos clínicos. Não avalie segurança, não gere alertas, não julgue doses — apenas identifique entidades. Retorne nomes em inglês (genérico/USAN) sempre que possível, sem duplicatas.",
        messages: [{ role: "user", content: `Extraia os princípios ativos mencionados neste texto:\n\n${text}` }],
        mode: "tools",
        tools: [{ type: "function", function: { name: "respond", parameters: extractionSchema } }],
        toolChoice: { type: "function", function: { name: "respond" } },
      })
      : null;

    const drugs: string[] = Array.isArray(extraction?.toolCallArgs?.drugs)
      ? extraction!.toolCallArgs.drugs.filter((d: unknown): d is string => typeof d === "string" && d.trim().length > 0)
      : [];
    const distinctDrugs = Array.from(new Set(drugs.map((d) => d.trim()))).slice(0, MAX_DRUGS);

    // Step 2 — deterministic lookup: fetch the official FDA label for each extracted drug.
    const sections = (await Promise.all(distinctDrugs.map((d) => fetchOpenFdaLabel(d))))
      .filter((s): s is LabelSections => s !== null);

    // Step 3 — deterministic fact derivation (interactions, contraindications, boxed
    // warnings, pregnancy risk) straight from the label text, no LLM involved.
    let facts: ClinicalFact[] = deriveClinicalFacts(sections);

    // Step 4 — optional LLM synthesis: translate/condense the raw (English) label excerpts
    // into concise Portuguese clinical text. The model is only allowed to paraphrase what
    // was already extracted, never to add new facts. If unavailable or it fails, the raw
    // excerpt is used as-is — the feature still returns real facts without any AI provider.
    if (facts.length > 0 && orderedKeys.length > 0) {
      const synthesisSchema = {
        type: "object",
        properties: {
          translations: {
            type: "array",
            items: { type: "string" },
            description: "Tradução/resumo em português clínico conciso (1-2 frases) de cada trecho, na mesma ordem, sem adicionar nenhuma informação nova.",
          },
        },
        required: ["translations"],
      };
      const excerptsList = facts.map((f, i) => `${i + 1}. ${f.detail}`).join("\n");
      const synthesis = await callWithFallback(admin, orderedKeys, {
        systemPrompt: "Você traduz e resume trechos de bulas de medicamentos (em inglês) para português clínico conciso. Traduza/resuma SOMENTE o que foi fornecido — não adicione fatos, doses ou julgamentos novos. Uma tradução por trecho, na mesma ordem, mesma quantidade de itens da lista recebida.",
        messages: [{ role: "user", content: `Trechos de bula:\n${excerptsList}` }],
        mode: "tools",
        tools: [{ type: "function", function: { name: "respond", parameters: synthesisSchema } }],
        toolChoice: { type: "function", function: { name: "respond" } },
      });
      const translations = synthesis?.toolCallArgs?.translations;
      if (Array.isArray(translations) && translations.length === facts.length) {
        facts = facts.map((f, i) => (typeof translations[i] === "string" && translations[i].trim() ? { ...f, detail: translations[i] } : f));
      }
    }

    // Enrich with OpenFDA adverse-event counts (unchanged — separate, already-deterministic
    // data source: post-marketing event reports rather than label text).
    const fdaEventResults = await Promise.all(distinctDrugs.map((d) => openFdaLookup(d)));
    const fdaItems: ClinicalFact[] = distinctDrugs.map((d, i) => fdaEventResults[i] ? {
      level: "yellow",
      category: "outro",
      label: `${d}: ${fdaEventResults[i]}`,
      detail: `Consulte OpenFDA para detalhes de farmacovigilância pós-comercialização de ${d}.`,
      source: `OpenFDA|https://open.fda.gov/apis/drug/event/searchable-fields/`,
    } : null).filter((x): x is ClinicalFact => x !== null);

    return new Response(JSON.stringify({
      drugs: distinctDrugs,
      items: [...facts, ...fdaItems],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("clinical-validator error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro desconhecido", items: [] }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
