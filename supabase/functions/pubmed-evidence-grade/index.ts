// Deterministic (non-LLM) evidence-grade classification for PubMed citations
// already present in a chat message. Given a list of PMIDs, looks up each
// article's publication type from NCBI and maps it to a 5-tier evidence
// hierarchy, so the frontend can render a grade badge next to citation links
// without asking the model to self-report (and possibly hallucinate) a grade.

import { classifyEvidence, type EvidenceGrade } from "../_shared/evidenceGrade.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PMIDS = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { pmids } = await req.json();
    const distinctPmids = Array.from(new Set((Array.isArray(pmids) ? pmids : []).filter((p) => typeof p === "string" && /^\d+$/.test(p)))).slice(0, MAX_PMIDS);

    if (distinctPmids.length === 0) {
      return new Response(JSON.stringify({ grades: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const esummaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${distinctPmids.join(",")}&retmode=json`;
    const resp = await fetch(esummaryUrl);
    const data = await resp.json();

    const grades: Record<string, EvidenceGrade> = {};
    for (const pmid of distinctPmids) {
      const article = data?.result?.[pmid];
      grades[pmid] = classifyEvidence(article?.pubtype || []);
    }

    return new Response(JSON.stringify({ grades }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("pubmed-evidence-grade error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro desconhecido", grades: {} }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
